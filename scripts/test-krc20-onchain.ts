#!/usr/bin/env npx tsx
/**
 * Test KRC-20 On-Chain Operations
 *
 * Tests the full commit-reveal inscription flow:
 * 1. Check platform balance
 * 2. Deploy a test token (optional)
 * 3. Mint tokens
 *
 * Usage:
 *   npx tsx scripts/test-krc20-onchain.ts          # Test mint only
 *   npx tsx scripts/test-krc20-onchain.ts --deploy # Deploy a new token first
 *
 * Required env vars:
 *   PLATFORM_PRIVATE_KEY - Hex private key for platform wallet
 *   USE_REAL_KRC20=true
 */

import 'dotenv/config';
import * as kasplex from '../src/pm/krc20/kasplex.js';

const TEST_TICKER = 'YBTCA'; // Use existing token from seed

async function main() {
  console.log('='.repeat(60));
  console.log('KRC-20 On-Chain Test');
  console.log('='.repeat(60));

  // Check dependencies
  console.log('\n📋 Checking dependencies...');
  const available = await kasplex.isAvailable();

  if (!available) {
    console.error('❌ Dependencies not available');
    console.error('   Run: npm install KaffinPX/KasplexBuilder && npm run setup:kaspa');
    process.exit(1);
  }
  console.log('✅ Dependencies loaded');

  // Check platform balance
  console.log('\n💰 Platform wallet balance:');
  const balance = await kasplex.getPlatformBalance();
  console.log(`   ${balance.toFixed(4)} KAS`);

  if (balance < 2) {
    console.error('❌ Insufficient balance for testing (need at least 2 KAS)');
    console.error('   Fund your platform wallet first');
    process.exit(1);
  }
  console.log('✅ Sufficient balance');

  // Check if we should deploy
  const shouldDeploy = process.argv.includes('--deploy');

  if (shouldDeploy) {
    // Deploy a test token
    const testTicker = `TEST${Date.now().toString(36).slice(-3).toUpperCase()}`;
    console.log(`\n🚀 Deploying test token: ${testTicker}`);
    console.log('   This will cost ~1 KAS...');

    const deployResult = await kasplex.deployToken(
      testTicker,
      1_000_000_000, // 1 billion max supply
      1_000_000      // 1 million mint limit
    );

    if (deployResult.success) {
      console.log('✅ Deploy successful!');
      console.log(`   Commit TX: ${deployResult.commitTxid}`);
      console.log(`   Reveal TX: ${deployResult.revealTxid}`);
      console.log(`   View on Kasplex: https://tn10api.kasplex.org/v1/krc20/token/${testTicker}`);
    } else {
      console.error('❌ Deploy failed:', deployResult.error);
    }
  }

  // Test mint
  console.log(`\n🔨 Testing mint for ${TEST_TICKER}...`);
  console.log('   This will cost ~1 KAS...');

  const mintResult = await kasplex.mintToken(
    TEST_TICKER,
    'kaspatest:qzl4n53hhqgxu0qlzc6xpjzh2hk9x9vsavg3c856j2h7l0m0k80j6y7xml9vq' // Platform address
  );

  if (mintResult.success) {
    console.log('✅ Mint successful!');
    console.log(`   Commit TX: ${mintResult.commitTxid}`);
    console.log(`   Reveal TX: ${mintResult.revealTxid}`);
  } else {
    console.error('❌ Mint failed:', mintResult.error);
  }

  // Final balance check
  console.log('\n💰 Final platform balance:');
  const finalBalance = await kasplex.getPlatformBalance();
  console.log(`   ${finalBalance.toFixed(4)} KAS`);
  console.log(`   Spent: ${(balance - finalBalance).toFixed(4)} KAS`);

  console.log('\n' + '='.repeat(60));
  console.log('Test Complete!');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
