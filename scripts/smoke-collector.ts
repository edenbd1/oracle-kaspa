import 'dotenv/config';
import { loadConfig } from '../src/config.js';
import { initCollector, fetchAllPrices, fetchCoinGecko } from '../src/collector/index.js';

async function main() {
  console.log('=== Collector Smoke Test ===\n');

  // Test CoinGecko directly (no API key needed)
  console.log('Testing CoinGecko...');
  const cgResult = await fetchCoinGecko();
  console.log('CoinGecko result:', JSON.stringify(cgResult, null, 2));

  // Test full collector with config
  console.log('\n--- Full Collector Test ---');
  const config = loadConfig();

  try {
    initCollector(config);
    console.log('Collector initialized');

    const responses = await fetchAllPrices(config);
    console.log('\nAll responses:');
    responses.forEach(r => {
      console.log(`  ${r.provider}: ${r.ok ? `$${r.price?.toFixed(2)}` : `ERROR: ${r.error}`}`);
    });

    const okCount = responses.filter(r => r.ok).length;
    console.log(`\nResult: ${okCount}/${responses.length} providers OK`);

    if (okCount === 0) {
      console.log('\nWARNING: No providers returned valid data');
      console.log('- CoinGecko may be rate-limited');
      console.log('- CoinMarketCap requires API key in CMC_API_KEY env var');
    }
  } catch (err) {
    console.error('Collector test failed:', err);
    process.exit(1);
  }
}

main();
