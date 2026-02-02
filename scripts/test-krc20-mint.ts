#!/usr/bin/env npx tsx
/**
 * Test KRC-20 Mint Flow
 *
 * Simulates the full mint flow:
 * 1. User sends KAS to platform (no mint fee)
 * 2. Platform mints KRC-20 tokens (platform pays gas)
 * 3. Tokens tracked locally with new format
 *
 * Usage: npx tsx scripts/test-krc20-mint.ts
 */

import 'dotenv/config';
import {
  loadStore,
  getMarkets,
  getKRC20TokensByMarket,
  getAllKRC20Tokens,
} from '../src/pm/store/index.js';
import { isRealMode, isRealModeAvailable, mint, getToken } from '../src/pm/krc20/service.js';

const PLATFORM_ADDRESS = process.env.KASPA_ADDRESS || 'kaspatest:qr...platform';
const TEST_USER = 'kaspatest:qr9q23p0ljmd8eu860fpz44edhqr4f4pwrxl7hjmg4ze5564djwyvk9yv33cc';

async function main() {
  console.log('='.repeat(60));
  console.log('KRC-20 Mint Flow Test');
  console.log('='.repeat(60));

  // Load store
  loadStore();

  // Check configuration
  console.log('\n📋 Configuration:');
  console.log('-'.repeat(40));
  console.log(`  USE_REAL_KRC20: ${process.env.USE_REAL_KRC20}`);
  console.log(`  Real Mode: ${isRealMode()}`);
  console.log(`  Real Mode Available: ${await isRealModeAvailable()}`);
  console.log(`  Platform Address: ${PLATFORM_ADDRESS}`);
  console.log(`  Test User: ${TEST_USER}`);

  // Get markets
  const markets = getMarkets();
  console.log(`\n📊 Markets: ${markets.length}`);

  if (markets.length === 0) {
    console.log('  ❌ No markets found. Run: npm run pm:seed:reset');
    return;
  }

  // Show current tokens
  console.log('\n🪙 Current KRC-20 Tokens:');
  console.log('-'.repeat(40));

  const allTokens = getAllKRC20Tokens();
  console.log(`  Total tokens: ${allTokens.length}\n`);

  // Group by market
  for (const market of markets.slice(0, 3)) {
    const tokens = getKRC20TokensByMarket(market.id);
    console.log(`  Market: BTC >= $${market.threshold_price.toLocaleString()}`);
    for (const token of tokens) {
      const isNewFormat = /^[YN][A-Z]{3}[A-Z]$/.test(token.ticker);
      console.log(`    ${token.ticker} (${token.display_name || 'no display name'}) ${isNewFormat ? '✅' : '❌ OLD FORMAT'}`);
    }
    console.log('');
  }

  // Verify ticker format
  console.log('\n🔍 Ticker Format Verification:');
  console.log('-'.repeat(40));

  let oldFormat = 0;
  let newFormat = 0;

  for (const token of allTokens) {
    if (/^[YN][A-Z]{3}[A-Z]$/.test(token.ticker)) {
      newFormat++;
    } else {
      oldFormat++;
      console.log(`  ❌ Old format: ${token.ticker}`);
    }
  }

  console.log(`\n  New format (YBTCA): ${newFormat}`);
  console.log(`  Old format (YES_BTC_*): ${oldFormat}`);

  if (oldFormat > 0) {
    console.log('\n  ⚠️  Some tokens still use old format!');
    console.log('  Run: npm run pm:seed:reset');
  } else {
    console.log('\n  ✅ All tokens use new KRC-20 compliant format!');
  }

  // Simulate mint
  console.log('\n📦 Simulated Mint Operation:');
  console.log('-'.repeat(40));

  const market = markets[0];
  const yesTicker = market.yes_token_ticker!;
  const token = getToken(yesTicker);

  if (!token) {
    console.log(`  ❌ Token ${yesTicker} not found`);
    return;
  }

  console.log(`  Market: BTC >= $${market.threshold_price.toLocaleString()}`);
  console.log(`  YES Ticker: ${yesTicker}`);
  console.log(`  Display Name: ${token.display_name}`);
  console.log(`  Current Supply: ${token.total_supply}`);

  // Simulate a 10 KAS trade (user pays 10 KAS, platform pays mint fee)
  const tradeAmount = 10;
  const sharesToMint = tradeAmount * 2; // Simplified: 2 shares per KAS

  console.log(`\n  Trade: ${tradeAmount} KAS -> ${sharesToMint} shares`);
  console.log(`  User pays: ${tradeAmount} KAS (NO mint fee)`);
  console.log(`  Platform pays mint gas internally`);

  // Actually mint (will use mock if real mode unavailable)
  const result = await mint(yesTicker, TEST_USER, sharesToMint, 'test_trade_001');

  console.log(`\n  Result:`);
  console.log(`    Success: ${result.success ? '✅' : '❌'}`);
  console.log(`    Ticker: ${result.ticker}`);
  console.log(`    Amount: ${result.amount}`);
  console.log(`    New Supply: ${result.new_supply}`);
  console.log(`    TxID: ${result.txid.slice(0, 16)}...`);

  if (result.error) {
    console.log(`    Error: ${result.error}`);
  }

  // Show Kasplex verification URL
  console.log('\n📋 Verification URLs:');
  console.log('-'.repeat(40));
  console.log(`  Token Info: https://tn10api.kasplex.org/v1/krc20/token/${yesTicker}`);
  console.log(`  All BTC tokens:`);
  for (let i = 0; i < Math.min(8, markets.length); i++) {
    const m = markets[i];
    console.log(`    - ${m.yes_token_ticker}: https://tn10api.kasplex.org/v1/krc20/token/${m.yes_token_ticker}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test Complete!');
  console.log('='.repeat(60));
}

main().catch(console.error);
