#!/usr/bin/env tsx
/**
 * Seed Demo Markets
 *
 * Creates a demo event with multiple BTC price threshold markets.
 */

import '../src/pm/store/index.js';
import {
  resetStore,
  seedDemoData,
  getEvents,
  getMarketsForEvent,
  deposit
} from '../src/pm/store/index.js';

console.log('=== Seeding Prediction Markets ===\n');

// Option to reset
const shouldReset = process.argv.includes('--reset');
if (shouldReset) {
  console.log('Resetting store...');
  resetStore();
}

// Seed demo data
seedDemoData();

// Create some demo users with balances
const demoUsers = [
  'kaspatest:qzalice0001demo0001',
  'kaspatest:qzbob0002demo0002',
  'kaspatest:qzcharlie0003demo0003'
];

for (const wallet of demoUsers) {
  deposit(wallet, 1000);
  console.log(`Deposited 1000 KAS to ${wallet.slice(0, 20)}...`);
}

// Print summary
console.log('\n=== Summary ===\n');

const events = getEvents();
for (const event of events) {
  console.log(`Event: ${event.title}`);
  console.log(`  ID: ${event.id}`);
  console.log(`  Asset: ${event.asset}`);
  console.log(`  Deadline: ${new Date(event.deadline).toISOString()}`);

  const markets = getMarketsForEvent(event.id);
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

console.log('Demo users created:');
for (const wallet of demoUsers) {
  console.log(`  ${wallet}`);
}

console.log('\nDone! Start the prediction market server with: npm run pm');
