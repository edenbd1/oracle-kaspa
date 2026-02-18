import 'dotenv/config';
import { loadConfig } from './config.js';
import { initCollector, fetchAllPrices, fetchDisplayPrices } from './collector/index.js';
import { aggregate } from './aggregator/index.js';
import { createBundle, hashBundle, storeBundle, updateLatest } from './proofs/index.js';
import { KaspaAnchor } from './kaspa-anchor/index.js';
import { startApiServer, setAnchor } from './api/index.js';
import { updateOracleState } from './state.js';
import { AnchorPayload } from './types.js';

function jitter(seconds: number): number {
  return (Math.random() * 2 - 1) * seconds * 1000; // ±seconds in ms
}

export async function main() {
  const config = loadConfig();
  const anchor = new KaspaAnchor();
  let anchorConnected = false;

  console.log('Starting Kaspa Spot Oracle...');
  console.log(`Network: ${config.network}`);
  console.log(`Interval: ${config.anchorIntervalSeconds}s (±${config.jitterSeconds}s jitter)`);

  // Initialize collector (loads API keys from env)
  initCollector(config);

  const privateKey = process.env.KASPA_PRIVATE_KEY;
  // Use env var if explicitly set (even if empty → use Resolver), otherwise fall back to config
  const rpcUrl = process.env.KASPA_RPC_URL !== undefined ? process.env.KASPA_RPC_URL : config.rpcUrl;

  if (!privateKey) {
    console.warn('KASPA_PRIVATE_KEY not set — running without on-chain anchoring');
  } else {
    try {
      // If rpcUrl is empty/undefined, KaspaAnchor uses public Resolver (auto-discovery)
      await anchor.connect(rpcUrl || undefined, privateKey, config.network);
      anchorConnected = true;
      console.log('Kaspa connected — on-chain anchoring enabled');
    } catch (err) {
      console.warn('Failed to connect to Kaspa — running without on-chain anchoring:', err);
    }
  }

  // Initialize oracle state
  updateOracleState({ network: config.network });

  // Start API server for bundle access (with anchor reference for health checks)
  if (anchorConnected) setAnchor(anchor);
  startApiServer();

  async function tick() {
    const tickStart = Date.now();
    console.log(`\n[TICK] ${new Date().toISOString()}`);

    // 1. Fetch prices (BTC oracle + ETH/KAS display in parallel)
    const [responses, display] = await Promise.all([
      fetchAllPrices(config),
      fetchDisplayPrices()
    ]);
    const okCount = responses.filter(r => r.ok).length;
    console.log(`  Providers: ${okCount}/${responses.length} OK`);
    responses.forEach(r => {
      console.log(`    ${r.provider}: ${r.ok ? `$${r.price?.toFixed(2)}` : `ERROR: ${r.error}`}`);
    });
    console.log(`  ETH: ${display.eth !== null ? `$${display.eth.toFixed(2)}` : 'N/A'}  |  KAS: ${display.kas !== null ? `$${display.kas.toFixed(4)}` : 'N/A'}`)

    // 2. Aggregate
    const index = aggregate(responses, config.aggregation);
    console.log(`  Index: $${index.price.toFixed(2)} [${index.status}]`);

    // 3. Create bundle and compute hash
    const bundle = createBundle(responses, index, config);
    const hash = hashBundle(bundle);
    const h = hash.slice(0, 16);
    console.log(`  Bundle: ${h}...`);

    // 4. Anchor if at least 1 source is valid (OK or DEGRADED); skip only on STALE (0 sources)
    let txId: string | null = null;
    if (index.status === 'OK' || index.status === 'DEGRADED') {
      if (index.status === 'DEGRADED' && index.note) {
        console.log(`  Note: ${index.note}`);
      }
      if (anchorConnected) {
        // Payload contains only: d, h, n, p (alphabetically sorted for deterministic CBOR)
        const payload: AnchorPayload = {
          d: Math.round(index.dispersion * 10000) / 10000,
          h,
          n: index.num_sources,
          p: Math.round(index.price * 100) / 100,
        };
        txId = await anchor.anchor(payload);
        if (txId) {
          console.log(`  TX: ${txId}`);
        } else {
          console.log(`  TX: FAILED`);
        }
      } else {
        console.log(`  TX: skipped (no RPC connection)`);
      }
    } else {
      // STALE: 0 valid sources — nothing to anchor
      console.log(`  SKIPPED (${index.status})`);
    }

    // 5. Store bundle with txid and update latest
    storeBundle(bundle, hash, txId || undefined);
    updateLatest(hash, txId);

    // 6. Update oracle state for health endpoint
    updateOracleState({
      last_tick_id: bundle.tick_id,
      last_updated_at: new Date().toISOString(),
      last_txid: txId,
      last_hash: h,
      last_price: index.price,
      providers_ok: okCount,
      providers_total: responses.length,
      last_index_status: index.status
    });

    console.log(`  Done in ${Date.now() - tickStart}ms`);

    // Schedule next tick with jitter
    const nextDelay = config.anchorIntervalSeconds * 1000 + jitter(config.jitterSeconds);
    setTimeout(tick, nextDelay);
  }

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[Oracle] Shutting down...');
    if (anchorConnected) await anchor.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[Oracle] Shutting down...');
    if (anchorConnected) await anchor.disconnect();
    process.exit(0);
  });

  // Start first tick
  tick();
}

// Allow running standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
