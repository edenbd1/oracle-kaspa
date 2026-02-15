/**
 * Prediction Market Server Entry Point
 *
 * Starts the PM API server and resolution engine.
 */

import 'dotenv/config';
import { loadStore, getEvents, seedDemoData } from './store/index.js';
import { startPmApiServer } from './api/index.js';
import { startSyncLoop, stopSyncLoop } from './engine/resolver.js';

const SYNC_INTERVAL_MS = parseInt(process.env.PM_SYNC_INTERVAL || '5000', 10);

export async function main() {
  console.log('Starting Kaspa Prediction Market...\n');

  // Load or seed data
  loadStore();

  if (getEvents().length === 0) {
    console.log('No events found, seeding demo data...');
    seedDemoData();
  }

  // Start API server
  startPmApiServer();

  // Start resolution engine
  startSyncLoop(SYNC_INTERVAL_MS);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    stopSyncLoop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\nShutting down...');
    stopSyncLoop();
    process.exit(0);
  });

  console.log('\nPrediction Market ready!');
  console.log(`  API:  http://localhost:${process.env.PM_API_PORT || 3001}`);
  console.log(`  Sync: Every ${SYNC_INTERVAL_MS}ms`);
}

// Allow running standalone
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
