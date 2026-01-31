import { createServer, IncomingMessage, ServerResponse } from 'http';
import { getLatest, getBundleByHash } from '../proofs/index.js';

const PORT = parseInt(process.env.API_PORT || '3000', 10);

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  const url = req.url || '/';

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

  // GET /health
  if (url === '/health') {
    sendJson(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
    return;
  }

  // 404 for everything else
  sendJson(res, 404, {
    error: 'Not found',
    endpoints: ['GET /latest', 'GET /bundle/:h', 'GET /health']
  });
}

export function startApiServer(): void {
  const server = createServer(handleRequest);
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
