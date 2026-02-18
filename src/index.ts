import 'dotenv/config';
import { loadConfig } from './config.js';
import { initCollector, fetchAllPrices } from './collector/index.js';
import { aggregate } from './aggregator/index.js';
import { createBundle, hashBundle, storeBundle, updateLatest } from './proofs/index.js';
import { KaspaAnchor } from './kaspa-anchor/index.js';
import { startApiServer, setAnchor } from './api/index.js';
import { updateOracleState } from './state.js';
import { AnchorPayload } from './types.js';

function jitter(seconds: number): number {
  return (Math.random() * 2 - 1) * seconds * 1000;
}

function fmtIndex(idx: ReturnType<typeof aggregate>): string {
  if (idx.status === 'STALE') return 'N/A [STALE]';
  const decimals = idx.asset === 'KAS' ? 4 : 2;
  return `$${idx.price.toFixed(decimals)} [${idx.status}]`;
}

export async function main() {
  const config = loadConfig();
  const anchor = new KaspaAnchor();
  let anchorConnected = false;

  console.log('Starting Kaspa Spot Oracle...');
  console.log(`Network: ${config.network}`);
  console.log(`Interval: ${config.anchorIntervalSeconds}s (±${config.jitterSeconds}s jitter)`);

  initCollector(config);

  const privateKey = process.env.KASPA_PRIVATE_KEY;
  const rpcUrl = process.env.KASPA_RPC_URL !== undefined ? process.env.KASPA_RPC_URL : config.rpcUrl;

  if (!privateKey) {
    console.warn('KASPA_PRIVATE_KEY not set — running without on-chain anchoring');
  } else {
    try {
      await anchor.connect(rpcUrl || undefined, privateKey, config.network);
      anchorConnected = true;
      console.log('Kaspa connected — on-chain anchoring enabled');
    } catch (err) {
      console.warn('Failed to connect to Kaspa — running without on-chain anchoring:', err);
    }
  }

  updateOracleState({ network: config.network });

  if (anchorConnected) setAnchor(anchor);
  startApiServer();

  async function tick() {
    const tickStart = Date.now();
    console.log(`\n[TICK] ${new Date().toISOString()}`);

    // 1. Fetch all assets from all providers in parallel (single call per provider)
    const responses = await fetchAllPrices(config);

    // 2. Aggregate each asset independently (same pipeline: median, outlier filter, quorum)
    const btcIndex = aggregate(responses, config.aggregation, 'BTC');
    const ethIndex = aggregate(responses, config.aggregation, 'ETH');
    const kasIndex = aggregate(responses, config.aggregation, 'KAS');

    // 3. Log provider results per asset
    const btcResponses = responses.filter(r => r.asset === 'BTC');
    const okCount = btcResponses.filter(r => r.ok).length;
    console.log(`  Providers: ${okCount}/${btcResponses.length} OK`);
    btcResponses.forEach(r => {
      console.log(`    ${r.provider}: ${r.ok ? `$${r.price?.toFixed(2)}` : `ERROR: ${r.error}`}`);
    });

    // 4. Log aggregated prices for all assets
    console.log(`  BTC: ${fmtIndex(btcIndex)}  |  ETH: ${fmtIndex(ethIndex)}  |  KAS: ${fmtIndex(kasIndex)}`);

    // 5. Create bundle and hash (BTC only — oracle anchor)
    const bundle = createBundle(btcResponses, btcIndex, config);
    const hash = hashBundle(bundle);
    const h = hash.slice(0, 16);
    console.log(`  Bundle: ${h}...`);

    // 6. Anchor BTC on-chain if at least 1 source valid
    let txId: string | null = null;
    if (btcIndex.status === 'OK' || btcIndex.status === 'DEGRADED') {
      if (btcIndex.status === 'DEGRADED' && btcIndex.note) {
        console.log(`  Note: ${btcIndex.note}`);
      }
      if (anchorConnected) {
        const payload: AnchorPayload = {
          d: Math.round(btcIndex.dispersion * 10000) / 10000,
          h,
          n: btcIndex.num_sources,
          p: Math.round(btcIndex.price * 100) / 100,
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
      console.log(`  SKIPPED (${btcIndex.status})`);
    }

    // 7. Store bundle and update state
    storeBundle(bundle, hash, txId || undefined);
    updateLatest(hash, txId);

    updateOracleState({
      last_tick_id: bundle.tick_id,
      last_updated_at: new Date().toISOString(),
      last_txid: txId,
      last_hash: h,
      last_price: btcIndex.price,
      providers_ok: okCount,
      providers_total: btcResponses.length,
      last_index_status: btcIndex.status
    });

    console.log(`  Done in ${Date.now() - tickStart}ms`);

    const nextDelay = config.anchorIntervalSeconds * 1000 + jitter(config.jitterSeconds);
    setTimeout(tick, nextDelay);
  }

  process.on('SIGINT', async () => {
    console.log('\n[Oracle] Shutting down...');
    if (anchorConnected) await anchor.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[Oracle] Shutting down...');;
    if (anchorConnected) await anchor.disconnect();
    process.exit(0);
  });

  tick();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
