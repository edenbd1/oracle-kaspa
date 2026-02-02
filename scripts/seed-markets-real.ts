#!/usr/bin/env tsx
/**
 * Seed Markets with Real KRC-20 Tokens
 *
 * Creates a demo event with BTC price threshold markets and
 * deploys real KRC-20 tokens on-chain via Kasplex inscriptions.
 *
 * NEW: Uses month-based tickers (e.g., YBTCBA = YES BTC February market A)
 * This allows redeploying tokens with correct parameters without conflicts.
 *
 * COST: ~2006 KAS per market (1003 KAS for YES token, 1003 KAS for NO token)
 * Kasplex requires burning 1000 KAS per deploy as protocol fee.
 *
 * Usage:
 *   USE_REAL_KRC20=true npx tsx scripts/seed-markets-real.ts
 *
 * Options:
 *   --single   Only create 1 market (for testing, ~2006 KAS)
 */

import 'dotenv/config';
import '../src/pm/store/index.js';
import {
  resetStore,
  getEvents,
  getMarketsForEvent,
  addEvent,
  addMarket,
  addPricePoint,
  saveStore
} from '../src/pm/store/index.js';
import { createEvent, createMarket } from '../src/pm/models/index.js';
import { deployMarketTokens, isRealMode, isRealModeAvailable } from '../src/pm/krc20/service.js';
import { generateTokenTickerWithMonth } from '../src/pm/krc20/utils.js';
import * as kasplex from '../src/pm/krc20/kasplex.js';

async function main() {
  console.log('=== Seeding Prediction Markets (Real KRC-20) ===\n');

  // Check environment
  if (!isRealMode()) {
    console.error('ERROR: USE_REAL_KRC20 is not set to true');
    console.error('Run with: USE_REAL_KRC20=true npx tsx scripts/seed-markets-real.ts');
    process.exit(1);
  }

  const available = await isRealModeAvailable();
  if (!available) {
    console.error('ERROR: Kasplex dependencies not available');
    console.error('Run: npm install KaffinPX/KasplexBuilder && npm run setup:kaspa');
    process.exit(1);
  }

  // Check platform balance
  const balance = await kasplex.getPlatformBalance();
  console.log(`Platform wallet balance: ${balance.toFixed(2)} KAS`);

  const singleMode = process.argv.includes('--single');
  const thresholds = singleMode ? [100000] : [150000, 140000, 130000, 120000, 110000, 100000, 90000, 80000];
  // Kasplex requires burning ~1000 KAS per deploy, so ~2006 KAS per market (YES + NO)
  // Commit: 1003 KAS → Reveal: 3 KAS (burns 1000 KAS as protocol fee)
  const requiredKas = thresholds.length * 2010; // ~2006 + buffer

  if (balance < requiredKas) {
    console.error(`\nERROR: Insufficient balance. Need ~${requiredKas} KAS, have ${balance.toFixed(2)} KAS`);
    console.error('Fund the platform wallet first.');
    process.exit(1);
  }

  console.log(`\nWill create ${thresholds.length} market(s), estimated cost: ~${requiredKas} KAS`);
  console.log('Thresholds:', thresholds.map(t => `$${t.toLocaleString()}`).join(', '));
  console.log('\nStarting in 3 seconds... (Ctrl+C to cancel)\n');
  await new Promise(r => setTimeout(r, 3000));

  // Reset store
  console.log('Resetting store...');
  resetStore();

  // Create demo event with deadline determining the month letter
  // March deadline = month C in ticker format
  const deadline = new Date('2026-03-01T00:00:00Z').getTime();
  const event = createEvent(
    'Bitcoin Price Prediction',
    'What price will Bitcoin hit before March 1, 2026?',
    'BTC',
    deadline
  );
  addEvent(event);

  // Show what tickers will be generated
  const eventDate = new Date(deadline);
  const sampleYes = generateTokenTickerWithMonth('BTC', 'A', 'YES', eventDate);
  const sampleNo = generateTokenTickerWithMonth('BTC', 'A', 'NO', eventDate);
  console.log(`\nCreated event: ${event.title} (${event.id})`);
  console.log(`Ticker format: ${sampleYes}/${sampleNo} (month derived from deadline: March = C)`);

  // Create markets with real KRC-20 tokens
  const liquidityB = 200;
  const feeBps = 100; // 1% fee

  for (let i = 0; i < thresholds.length; i++) {
    const threshold = thresholds[i];
    const marketIndex = String.fromCharCode(65 + i); // A, B, C...

    console.log(`\n--- Market ${i + 1}/${thresholds.length}: BTC >= $${threshold.toLocaleString()} ---`);

    // Create market with month-based tickers (derived from event deadline)
    const market = createMarket(event.id, threshold, '>=', liquidityB, feeBps, event.asset, marketIndex, deadline);
    addMarket(market);
    addPricePoint(market.id, 0.5);

    // Deploy real KRC-20 tokens
    console.log(`Deploying YES/NO tokens for market ${market.id}...`);
    try {
      const tokens = await deployMarketTokens(market, event);
      console.log(`  YES: ${tokens.yes_token.ticker} (txid: ${tokens.yes_token.deployed_txid.slice(0, 16)}...)`);
      console.log(`  NO:  ${tokens.no_token.ticker} (txid: ${tokens.no_token.deployed_txid.slice(0, 16)}...)`);
    } catch (error) {
      console.error(`  ERROR deploying tokens:`, error);
      console.log(`  Continuing with next market...`);
    }

    // Small delay between markets to avoid UTXO conflicts
    if (i < thresholds.length - 1) {
      console.log('  Waiting 2s before next market...');
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Save final state
  saveStore();

  // Print summary
  console.log('\n=== Summary ===\n');

  const events = getEvents();
  for (const evt of events) {
    console.log(`Event: ${evt.title}`);
    console.log(`  ID: ${evt.id}`);
    console.log(`  Asset: ${evt.asset}`);
    console.log(`  Deadline: ${new Date(evt.deadline).toISOString()}`);

    const markets = getMarketsForEvent(evt.id);
    console.log(`  Markets (${markets.length}):`);
    for (const market of markets) {
      const dir = market.direction === '>=' ? '≥' : '≤';
      console.log(`    - BTC ${dir} $${market.threshold_price.toLocaleString()}`);
      console.log(`      ID: ${market.id}`);
      console.log(`      YES Token: ${market.yes_token_ticker || 'N/A'}`);
      console.log(`      NO Token: ${market.no_token_ticker || 'N/A'}`);
    }
    console.log('');
  }

  const finalBalance = await kasplex.getPlatformBalance();
  console.log(`Platform balance after seeding: ${finalBalance.toFixed(2)} KAS`);
  console.log(`Total spent: ~${(balance - finalBalance).toFixed(2)} KAS`);

  console.log('\nDone! Start the prediction market server with: npm run pm');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
