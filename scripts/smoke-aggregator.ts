import { aggregate } from '../src/aggregator/index.js';
import { ProviderResponse, Config } from '../src/types.js';

const mockConfig: Config['aggregation'] = {
  outlierThresholdRatio: 0.01,
  minValidSources: 2
};

function runTest(name: string, responses: ProviderResponse[], expected: { status: string; priceApprox?: number }) {
  console.log(`\nTest: ${name}`);
  const result = aggregate(responses, mockConfig);
  console.log('  Result:', JSON.stringify(result, null, 2));

  const statusOk = result.status === expected.status;
  const priceOk = !expected.priceApprox || Math.abs(result.price - expected.priceApprox) < 1;

  if (statusOk && priceOk) {
    console.log('  ✓ PASS');
  } else {
    console.log(`  ✗ FAIL (expected status=${expected.status}, priceApprox=${expected.priceApprox})`);
  }
}

function main() {
  console.log('=== Aggregator Smoke Test ===');

  // Test 1: Two valid sources, close prices
  runTest('Two valid sources (close prices)', [
    { provider: 'coingecko', price: 97500, timestamp_local: Date.now(), ok: true, error: null },
    { provider: 'coinmarketcap', price: 97510, timestamp_local: Date.now(), ok: true, error: null }
  ], { status: 'OK', priceApprox: 97505 });

  // Test 2: One source failed
  runTest('One source failed', [
    { provider: 'coingecko', price: 97500, timestamp_local: Date.now(), ok: true, error: null },
    { provider: 'coinmarketcap', price: null, timestamp_local: Date.now(), ok: false, error: 'Network error' }
  ], { status: 'STALE', priceApprox: 97500 });

  // Test 3: All sources failed
  runTest('All sources failed', [
    { provider: 'coingecko', price: null, timestamp_local: Date.now(), ok: false, error: 'Network error' },
    { provider: 'coinmarketcap', price: null, timestamp_local: Date.now(), ok: false, error: 'Rate limited' }
  ], { status: 'STALE', priceApprox: 0 });

  // Test 4: Outlier detection (>1% difference)
  runTest('Outlier detection (5% difference)', [
    { provider: 'coingecko', price: 97500, timestamp_local: Date.now(), ok: true, error: null },
    { provider: 'coinmarketcap', price: 102375, timestamp_local: Date.now(), ok: true, error: null } // 5% higher
  ], { status: 'STALE' }); // Both filtered as outliers relative to median

  // Test 5: Edge case - exactly 1% difference (should pass)
  runTest('Exactly 1% difference (should pass)', [
    { provider: 'coingecko', price: 100000, timestamp_local: Date.now(), ok: true, error: null },
    { provider: 'coinmarketcap', price: 101000, timestamp_local: Date.now(), ok: true, error: null } // exactly 1%
  ], { status: 'OK', priceApprox: 100500 });

  console.log('\n=== Aggregator Smoke Test Complete ===');
}

main();
