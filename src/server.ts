/**
 * Combined server entrypoint for Railway deployment.
 * Serves both Oracle API and PM API on a single port (required by Railway).
 * Also starts Oracle price loop and PM resolution engine.
 */

import 'dotenv/config';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { handleRequest as handleOracleRequest } from './api/index.js';
import { handleRequest as handlePmRequest } from './pm/api/index.js';
import { main as startOracle } from './index.js';
import { main as startPM } from './pm/index.js';

const PORT = parseInt(process.env.API_PORT || '3000', 10);

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data, null, 2));
}

// Single HTTP server that routes to Oracle or PM handler based on URL prefix
const server = createServer((req, res) => {
  const url = req.url || '/';

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // Route /pm/* to PM handler, everything else to Oracle handler
  const handler = url.startsWith('/pm') ? handlePmRequest : handleOracleRequest;
  handler(req, res).catch(err => {
    console.error('[Server] Request error:', err);
    sendJson(res, 500, { error: 'Internal server error' });
  });
});

async function start() {
  console.log('=== Threshold Combined Server ===\n');

  // Start the combined HTTP server on a single port
  server.listen(PORT, () => {
    console.log(`[Server] Combined API listening on http://localhost:${PORT}`);
    console.log(`  Oracle: /health, /latest, /bundle/:h, /verify/:txid`);
    console.log(`  PM:     /pm/events, /pm/market/:id, /pm/trade, ...`);
  });

  // Start both background services (price loop + PM resolution engine)
  // These no longer start their own HTTP servers
  await Promise.all([
    startOracle().catch(err => {
      console.error('[Oracle] Failed to start:', err);
    }),
    startPM().catch(err => {
      console.error('[PM] Failed to start:', err);
    })
  ]);
}

start().catch(console.error);
