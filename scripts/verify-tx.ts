#!/usr/bin/env tsx
/**
 * Verify an oracle anchor transaction from Kaspa.
 *
 * Usage: npm run verify:tx -- <txid>
 *
 * Fetches the tx payload from Kaspa explorer API, decodes CBOR, validates types/ranges.
 */
import 'dotenv/config';
import { verifyTransaction, VerificationResult } from '../src/verifier/index.js';

function printResult(result: VerificationResult): void {
  console.log('=== Oracle TX Verification ===\n');
  console.log(`TXID:    ${result.txid}`);
  console.log(`Network: ${result.network}\n`);

  if (result.error && result.status === 'ERROR') {
    console.error(`Error: ${result.error}`);
    return;
  }

  if (!result.tx_found) {
    console.error('Transaction not found. Make sure:');
    console.error('  1. The TXID is correct');
    console.error('  2. The transaction has been confirmed');
    console.error('  3. The network is correct (set KASPA_NETWORK env var)');
    return;
  }

  console.log(`Payload (hex): ${result.payload_hex}`);
  console.log(`Payload size:  ${result.payload_size} bytes`);
  if (result.block_time) {
    console.log(`Block time:    ${result.block_time}`);
  }
  console.log('');

  if (result.decoded) {
    console.log('--- Decoded Payload ---');
    console.log(`  p (price):       $${result.decoded.p.toFixed(2)}`);
    console.log(`  n (num_sources): ${result.decoded.n}`);
    console.log(`  d (dispersion):  ${(result.decoded.d * 100).toFixed(4)}%`);
    console.log(`  h (bundle_hash): ${result.decoded.h}`);
    console.log('');
  }

  if (result.validation) {
    if (result.validation.valid) {
      console.log('Validation: PASSED');
    } else {
      console.log('Validation: FAILED');
      result.validation.errors.forEach(e => console.log(`  - ${e}`));
    }
    console.log('');
  }

  console.log('--- Local Bundle Verification ---');
  if (result.bundle_found) {
    console.log('Bundle found locally!');
    console.log(`Hash verification: ${result.hash_verified ? 'PASSED' : 'FAILED'}`);

    if (result.bundle_summary) {
      console.log('');
      console.log('--- Bundle Summary ---');
      console.log(`  Tick ID:    ${result.bundle_summary.tick_id}`);
      console.log(`  Network:    ${result.bundle_summary.network}`);
      console.log(`  Price:      $${result.bundle_summary.price.toFixed(2)}`);
      console.log(`  Sources:    ${result.bundle_summary.sources_used.join(', ')}`);
      console.log(`  Dispersion: ${(result.bundle_summary.dispersion * 100).toFixed(4)}%`);
    }

    if (result.provider_responses) {
      console.log('');
      console.log('--- Provider Responses ---');
      result.provider_responses.forEach(r => {
        console.log(`  ${r.provider}: ${r.ok ? `$${r.price?.toFixed(2)}` : `ERROR: ${r.error}`}`);
      });
    }
  } else {
    console.log(`Bundle not found locally (h=${result.decoded?.h})`);
    console.log('Fetch the bundle from the oracle API:');
    console.log(`  curl http://localhost:3000/bundle/${result.decoded?.h}`);
  }

  console.log('');
  console.log(`Overall Status: ${result.status}`);
  if (result.error) {
    console.log(`Error: ${result.error}`);
  }
  console.log('\nVerification complete.');
}

async function main() {
  const txid = process.argv[2];
  const network = process.env.KASPA_NETWORK || 'testnet-10';

  if (!txid) {
    console.error('Usage: npm run verify:tx -- <txid>');
    console.error('');
    console.error('Example: npm run verify:tx -- abc123def456...');
    console.error('');
    console.error('Set KASPA_NETWORK env var for different networks (default: testnet-10)');
    process.exit(1);
  }

  const result = await verifyTransaction(txid, network);
  printResult(result);

  // Exit with error code if verification failed
  if (result.status === 'FAILED' || result.status === 'ERROR') {
    process.exit(1);
  }
}

main();
