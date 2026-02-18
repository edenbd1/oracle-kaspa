import { createServer, IncomingMessage, ServerResponse } from 'http';
import { getLatest, getBundleByHash } from '../proofs/index.js';
import { getOracleState } from '../state.js';
import { verifyTransaction } from '../verifier/index.js';
import { KaspaAnchor } from '../kaspa-anchor/index.js';

const PORT = parseInt(process.env.API_PORT || '3000', 10);

// Reference to anchor for health checks (set via setAnchor)
let anchorRef: KaspaAnchor | null = null;

export function setAnchor(anchor: KaspaAnchor): void {
  anchorRef = anchor;
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data, null, 2));
}

async function handleHealth(res: ServerResponse): Promise<void> {
  const state = getOracleState();
  const now = new Date();

  // Calculate lag
  let lag_seconds: number | null = null;
  if (state.last_updated_at) {
    const lastUpdate = new Date(state.last_updated_at);
    lag_seconds = Math.round((now.getTime() - lastUpdate.getTime()) / 1000);
  }

  // Get Kaspa node info
  let kaspa = {
    is_synced: null as boolean | null,
    virtual_daa_score: null as string | null,
    utxo_count: null as number | null,
    balance_sompi: null as string | null
  };

  if (anchorRef) {
    try {
      const info = await anchorRef.getHealthInfo();
      kaspa = {
        is_synced: info.is_synced,
        virtual_daa_score: info.virtual_daa_score,
        utxo_count: info.utxo_count,
        balance_sompi: info.balance_sompi
      };
    } catch { /* ignore */ }
  }

  // Determine overall health status
  // healthy:   n>=2, lag <60s
  // degraded:  n==1 (DEGRADED index), or lag 60-120s
  // unhealthy: n==0 (STALE/no price), or lag >120s, or node issues
  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  const issues: string[] = [];

  if (!state.last_tick_id) {
    status = 'unhealthy';
    issues.push('No ticks recorded yet');
  } else if (lag_seconds !== null && lag_seconds > 120) {
    status = 'unhealthy';
    issues.push(`Lag too high: ${lag_seconds}s`);
  } else if (lag_seconds !== null && lag_seconds > 60) {
    if (status === 'healthy') status = 'degraded';
    issues.push(`Lag elevated: ${lag_seconds}s`);
  }

  if (state.providers_ok === 0 && state.providers_total > 0) {
    status = 'unhealthy';
    issues.push('All providers failed — no valid price');
  } else if (state.last_index_status === 'DEGRADED') {
    if (status === 'healthy') status = 'degraded';
    issues.push(`Single-source price (${state.providers_ok}/${state.providers_total} providers OK)`);
  } else if (state.providers_ok < state.providers_total) {
    if (status === 'healthy') status = 'degraded';
    issues.push(`Only ${state.providers_ok}/${state.providers_total} providers OK`);
  }

  if (kaspa.is_synced === false) {
    status = 'unhealthy';
    issues.push('Kaspa node not synced');
  }

  if (kaspa.utxo_count === 0) {
    status = 'unhealthy';
    issues.push('No UTXOs available');
  }

  sendJson(res, 200, {
    status,
    issues: issues.length > 0 ? issues : undefined,
    timestamp: now.toISOString(),
    oracle: {
      network: state.network,
      last_tick_id: state.last_tick_id,
      last_updated_at: state.last_updated_at,
      lag_seconds,
      last_txid: state.last_txid,
      last_hash: state.last_hash,
      last_price: state.last_price,
      last_index_status: state.last_index_status,
      providers_ok: state.providers_ok,
      providers_total: state.providers_total
    },
    kaspa
  });
}

async function handleVerify(txid: string, res: ServerResponse): Promise<void> {
  const state = getOracleState();
  const network = state.network || 'testnet-10';

  const result = await verifyTransaction(txid, network);
  const statusCode = result.status === 'PASSED' ? 200 :
                     result.status === 'PARTIAL' ? 200 :
                     result.status === 'ERROR' ? 400 : 422;

  sendJson(res, statusCode, result);
}

export async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = req.url || '/';

  // GET /health
  if (url === '/health') {
    await handleHealth(res);
    return;
  }

  // GET /verify/:txid
  const verifyMatch = url.match(/^\/verify\/([a-f0-9]{64})$/i);
  if (verifyMatch) {
    const txid = verifyMatch[1].toLowerCase();
    await handleVerify(txid, res);
    return;
  }

  // GET /latest
  if (url === '/latest') {
    const latest = getLatest();
    if (!latest) {
      sendJson(res, 404, { error: 'No bundles yet' });
      return;
    }
    const bundle = getBundleByHash(latest.h);
    if (!bundle) {
      sendJson(res, 404, { error: 'Bundle not found', latest });
      return;
    }
    sendJson(res, 200, { latest, bundle });
    return;
  }

  // GET /bundle/:h
  const bundleMatch = url.match(/^\/bundle\/([a-f0-9]{16})$/i);
  if (bundleMatch) {
    const h = bundleMatch[1].toLowerCase();
    const bundle = getBundleByHash(h);
    if (!bundle) {
      sendJson(res, 404, { error: 'Bundle not found', h });
      return;
    }
    sendJson(res, 200, bundle);
    return;
  }

  // 404 for everything else
  sendJson(res, 404, {
    error: 'Not found',
    endpoints: [
      'GET /health',
      'GET /latest',
      'GET /bundle/:h',
      'GET /verify/:txid'
    ]
  });
}

export function startApiServer(): void {
  const server = createServer((req, res) => {
    handleRequest(req, res).catch(err => {
      console.error('[API] Request error:', err);
      sendJson(res, 500, { error: 'Internal server error' });
    });
  });

  let currentPort = PORT;
  const maxRetries = 3;
  let retries = 0;

  const tryListen = () => {
    server.listen(currentPort);
  };

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && retries < maxRetries) {
      retries++;
      currentPort++;
      console.warn(`[API] Port ${currentPort - 1} in use, trying ${currentPort}...`);
      tryListen();
    } else {
      console.error(`[API] Failed to start: ${err.message}`);
      console.warn('[API] Bundle API unavailable, oracle continues without it');
    }
  });

  server.on('listening', () => {
    console.log(`API server listening on http://localhost:${currentPort}`);
  });

  tryListen();
}

// Allow running standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Starting API server standalone...');
  startApiServer();
}
