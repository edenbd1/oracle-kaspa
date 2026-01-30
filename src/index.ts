import 'dotenv/config';
import { loadConfig } from './config.js';
import { initCollector, fetchAllPrices } from './collector/index.js';
import { aggregate } from './aggregator/index.js';
import { createBundle, hashBundle, storeBundle } from './proofs/index.js';
import { KaspaAnchor } from './kaspa-anchor/index.js';
import { AnchorPayload } from './types.js';

function jitter(seconds: number): number {
  return (Math.random() * 2 - 1) * seconds * 1000; // ±seconds in ms
}

async function main() {
  const config = loadConfig();
  const anchor = new KaspaAnchor();

  console.log('Starting Kaspa Spot Oracle...');
  console.log(`Network: ${config.network}`);
  console.log(`Interval: ${config.anchorIntervalSeconds}s (±${config.jitterSeconds}s jitter)`);

  // Initialize collector (loads API keys from env)
  initCollector(config);

  const privateKey = process.env.KASPA_PRIVATE_KEY;
  if (!privateKey) {
    console.error('KASPA_PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  await anchor.connect(config.rpcUrl, privateKey, config.network);

  async function tick() {
    const tickStart = Date.now();
    console.log(`\n[TICK] ${new Date().toISOString()}`);

    // 1. Fetch prices
    const responses = await fetchAllPrices(config);
    const okCount = responses.filter(r => r.ok).length;
    console.log(`  Providers: ${okCount}/${responses.length} OK`);
    responses.forEach(r => {
      console.log(`    ${r.provider}: ${r.ok ? `$${r.price?.toFixed(2)}` : `ERROR: ${r.error}`}`);
    });

    // 2. Aggregate
    const index = aggregate(responses, config.aggregation);
    console.log(`  Index: $${index.price.toFixed(2)} [${index.status}]`);

    // 3. Create and store proof
    const bundle = createBundle(responses, index, config);
    const hash = hashBundle(bundle);
    storeBundle(bundle, hash);
    console.log(`  Bundle: ${hash.slice(0, 16)}...`);

    // 4. Anchor if OK
    if (index.status === 'OK') {
      // Payload contains only: d, h, n, p (alphabetically sorted for deterministic CBOR)
      const payload: AnchorPayload = {
        d: Math.round(index.dispersion * 10000) / 10000,
        h: hash.slice(0, 16),
        n: index.num_sources,
        p: Math.round(index.price * 100) / 100,
      };
      const txId = await anchor.anchor(payload);
      if (txId) {
        console.log(`  TX: ${txId}`);
      } else {
        console.log(`  TX: FAILED`);
      }
    } else {
      console.log(`  SKIPPED (${index.status})`);
    }

    console.log(`  Done in ${Date.now() - tickStart}ms`);

    // Schedule next tick with jitter
    const nextDelay = config.anchorIntervalSeconds * 1000 + jitter(config.jitterSeconds);
    setTimeout(tick, nextDelay);
  }

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await anchor.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nShutting down...');
    await anchor.disconnect();
    process.exit(0);
  });

  // Start first tick
  tick();
}

main().catch(console.error);
