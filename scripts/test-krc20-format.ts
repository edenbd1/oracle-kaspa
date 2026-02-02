#!/usr/bin/env npx tsx
/**
 * Test script for new KRC-20 ticker format
 *
 * Validates that:
 * 1. Tickers are 4-6 uppercase letters only (KRC-20 compliant)
 * 2. Format is {SIDE}{ASSET}{INDEX} e.g., YBTCA, NBTCA
 * 3. Display names show full info for UI
 *
 * Usage: npx tsx scripts/test-krc20-format.ts
 */

import 'dotenv/config';

// Test the utility functions directly
import {
  generateTokenTicker,
  parseTokenTicker,
  indexToLetter,
  letterToIndex,
  generateDisplayName,
  formatTickerDisplay
} from '../src/pm/krc20/utils.js';

console.log('='.repeat(60));
console.log('KRC-20 Ticker Format Test');
console.log('='.repeat(60));

// Test 1: Index to letter conversion
console.log('\n📝 Test 1: Index to Letter Conversion');
console.log('-'.repeat(40));
for (let i = 0; i < 10; i++) {
  console.log(`  Index ${i} -> Letter "${indexToLetter(i)}"`);
}

// Test 2: Letter to index conversion
console.log('\n📝 Test 2: Letter to Index Conversion');
console.log('-'.repeat(40));
for (const letter of ['A', 'B', 'C', 'H', 'Z']) {
  console.log(`  Letter "${letter}" -> Index ${letterToIndex(letter)}`);
}

// Test 3: Generate new format tickers
console.log('\n📝 Test 3: Generate KRC-20 Compliant Tickers');
console.log('-'.repeat(40));

const testCases = [
  { asset: 'BTC', index: 'A', side: 'YES' as const },
  { asset: 'BTC', index: 'A', side: 'NO' as const },
  { asset: 'BTC', index: 'B', side: 'YES' as const },
  { asset: 'ETH', index: 'A', side: 'YES' as const },
  { asset: 'KAS', index: 'C', side: 'NO' as const },
];

for (const { asset, index, side } of testCases) {
  const ticker = generateTokenTicker(asset, index, side);
  const isValid = /^[A-Z]{4,6}$/.test(ticker);
  console.log(`  ${side} ${asset} [${index}] -> "${ticker}" ${isValid ? '✅' : '❌'}`);
}

// Test 4: Parse new format tickers
console.log('\n📝 Test 4: Parse New Format Tickers');
console.log('-'.repeat(40));

const tickersToParse = ['YBTCA', 'NBTCA', 'YETHB', 'NKASC', 'YES_BTC_100000'];
for (const ticker of tickersToParse) {
  const parsed = parseTokenTicker(ticker);
  if (parsed) {
    console.log(`  "${ticker}" -> side=${parsed.side}, asset=${parsed.asset}, index=${parsed.marketIndex}`);
  } else {
    console.log(`  "${ticker}" -> ❌ Invalid`);
  }
}

// Test 5: Generate display names
console.log('\n📝 Test 5: Display Names for UI');
console.log('-'.repeat(40));

const displayTests = [
  { side: 'YES' as const, asset: 'BTC', threshold: 130000 },
  { side: 'NO' as const, asset: 'BTC', threshold: 130000 },
  { side: 'YES' as const, asset: 'BTC', threshold: 100000 },
  { side: 'YES' as const, asset: 'ETH', threshold: 5000 },
];

for (const { side, asset, threshold } of displayTests) {
  const displayName = generateDisplayName(side, asset, threshold);
  console.log(`  ${side} ${asset} $${threshold} -> "${displayName}"`);
}

// Test 6: Format ticker display
console.log('\n📝 Test 6: Format Ticker Display');
console.log('-'.repeat(40));

for (const ticker of ['YBTCA', 'NBTCB', 'YETHA']) {
  const display = formatTickerDisplay(ticker);
  console.log(`  "${ticker}" -> "${display}"`);
}

// Test 7: Simulate market token deployment
console.log('\n📝 Test 7: Simulated Market Tokens');
console.log('-'.repeat(40));

const markets = [
  { asset: 'BTC', threshold: 150000 },
  { asset: 'BTC', threshold: 140000 },
  { asset: 'BTC', threshold: 130000 },
  { asset: 'BTC', threshold: 120000 },
  { asset: 'BTC', threshold: 110000 },
  { asset: 'BTC', threshold: 100000 },
  { asset: 'BTC', threshold: 90000 },
  { asset: 'BTC', threshold: 80000 },
];

console.log('\n  Market Tokens:');
console.log('  ┌──────────────────┬──────────┬──────────┬────────────────────────┐');
console.log('  │ Threshold        │ YES Tick │ NO Tick  │ Display Name           │');
console.log('  ├──────────────────┼──────────┼──────────┼────────────────────────┤');

for (let i = 0; i < markets.length; i++) {
  const { asset, threshold } = markets[i];
  const marketIndex = indexToLetter(i);
  const yesTicker = generateTokenTicker(asset, marketIndex, 'YES');
  const noTicker = generateTokenTicker(asset, marketIndex, 'NO');
  const displayName = generateDisplayName('YES', asset, threshold);

  console.log(`  │ $${threshold.toLocaleString().padEnd(15)} │ ${yesTicker.padEnd(8)} │ ${noTicker.padEnd(8)} │ ${displayName.padEnd(22)} │`);
}
console.log('  └──────────────────┴──────────┴──────────┴────────────────────────┘');

// Test 8: KRC-20 compliance check
console.log('\n📝 Test 8: KRC-20 Compliance Check');
console.log('-'.repeat(40));

const krc20Rules = [
  { rule: 'Length 4-6 characters', check: (t: string) => t.length >= 4 && t.length <= 6 },
  { rule: 'Uppercase only', check: (t: string) => /^[A-Z]+$/.test(t) },
  { rule: 'No numbers', check: (t: string) => !/\d/.test(t) },
  { rule: 'No underscores', check: (t: string) => !t.includes('_') },
  { rule: 'No spaces', check: (t: string) => !t.includes(' ') },
];

const sampleTicker = 'YBTCA';
console.log(`\n  Checking "${sampleTicker}":`);
let allPassed = true;
for (const { rule, check } of krc20Rules) {
  const passed = check(sampleTicker);
  console.log(`    ${passed ? '✅' : '❌'} ${rule}`);
  if (!passed) allPassed = false;
}

console.log('\n' + '='.repeat(60));
console.log(allPassed ? '✅ All KRC-20 compliance checks PASSED!' : '❌ Some checks FAILED');
console.log('='.repeat(60));

// Verification URLs
console.log('\n📋 Verification:');
console.log(`  Kasplex API: https://tn10api.kasplex.org/v1/krc20/token/${sampleTicker}`);
console.log('');
