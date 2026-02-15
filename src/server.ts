/**
 * Combined server entrypoint for Railway deployment.
 * Starts both Oracle and PM server in a single process.
 */

import 'dotenv/config';
import { main as startOracle } from './index.js';
import { main as startPM } from './pm/index.js';

async function start() {
  console.log('=== Threshold Combined Server ===\n');

  // Start both services concurrently
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
