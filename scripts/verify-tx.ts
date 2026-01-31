#!/usr/bin/env tsx
/**
 * Verify an oracle anchor transaction from Kaspa.
 *
 * Usage: npm run verify:tx -- <txid>
 *
 * Fetches the tx payload from Kaspa explorer API, decodes CBOR, validates types/ranges.
 */
import 'dotenv/config';
import { decode as cborDecode } from 'cbor-x';
import { getBundleByHash, hashBundle } from '../src/proofs/index.js';
import { RawBundle } from '../src/types.js';

interface DecodedPayload {
  d: number;
  h: string;
  n: number;
  p: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface ExplorerTx {
  transaction_id: string;
  inputs: unknown[];
  outputs: unknown[];
  payload?: string;
  block_time?: number;
}

// Explorer API endpoints by network
const EXPLORER_API: Record<string, string> = {
  'testnet-10': 'https://api-tn10.kaspa.org',
  'testnet-11': 'https://api-tn11.kaspa.org',
  'mainnet': 'https://api.kaspa.org'
};

function validatePayload(payload: unknown): ValidationResult {
  const errors: string[] = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Payload is not an object'] };
  }

  const p = payload as Record<string, unknown>;

  // Validate 'p' (price) - number, positive, reasonable range
  if (typeof p.p !== 'number') {
    errors.push(`p (price) must be a number, got ${typeof p.p}`);
  } else if (p.p <= 0 || p.p > 10_000_000) {
    errors.push(`p (price) out of range: ${p.p} (expected 0 < p <= 10,000,000)`);
  }

  // Validate 'n' (num_sources) - integer, 1-10
  if (typeof p.n !== 'number' || !Number.isInteger(p.n)) {
    errors.push(`n (num_sources) must be an integer, got ${typeof p.n}`);
  } else if (p.n < 1 || p.n > 10) {
    errors.push(`n (num_sources) out of range: ${p.n} (expected 1-10)`);
  }

  // Validate 'd' (dispersion) - number, 0-1
  if (typeof p.d !== 'number') {
    errors.push(`d (dispersion) must be a number, got ${typeof p.d}`);
  } else if (p.d < 0 || p.d > 1) {
    errors.push(`d (dispersion) out of range: ${p.d} (expected 0-1)`);
  }

  // Validate 'h' (hash) - string, 16 hex chars
  if (typeof p.h !== 'string') {
    errors.push(`h (hash) must be a string, got ${typeof p.h}`);
  } else if (!/^[a-f0-9]{16}$/i.test(p.h)) {
    errors.push(`h (hash) must be 16 hex chars, got "${p.h}"`);
  }

  return { valid: errors.length === 0, errors };
}

async function fetchTxFromExplorer(txid: string, network: string): Promise<ExplorerTx | null> {
  const baseUrl = EXPLORER_API[network];
  if (!baseUrl) {
    console.error(`Unknown network: ${network}. Supported: ${Object.keys(EXPLORER_API).join(', ')}`);
    return null;
  }

  const url = `${baseUrl}/transactions/${txid}`;
  console.log(`Fetching from: ${url}`);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) {
        return null;
      }
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    return await res.json() as ExplorerTx;
  } catch (e) {
    console.error('Explorer API error:', e);
    return null;
  }
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

  console.log('=== Oracle TX Verification ===\n');
  console.log(`TXID:    ${txid}`);
  console.log(`Network: ${network}\n`);

  // Fetch transaction from explorer
  console.log('Fetching transaction from explorer...\n');
  const tx = await fetchTxFromExplorer(txid, network);

  if (!tx) {
    console.error('Transaction not found. Make sure:');
    console.error('  1. The TXID is correct');
    console.error('  2. The transaction has been confirmed');
    console.error('  3. The network is correct (set KASPA_NETWORK env var)');
    process.exit(1);
  }

  const payloadHex = tx.payload;
  if (!payloadHex) {
    console.error('Transaction has no payload');
    process.exit(1);
  }

  console.log(`Payload (hex): ${payloadHex}`);
  console.log(`Payload size:  ${payloadHex.length / 2} bytes`);
  if (tx.block_time) {
    console.log(`Block time:    ${new Date(tx.block_time).toISOString()}`);
  }
  console.log('');

  // Decode CBOR
  const payloadBytes = Buffer.from(payloadHex, 'hex');
  let decoded: DecodedPayload;
  try {
    decoded = cborDecode(payloadBytes) as DecodedPayload;
  } catch (e) {
    console.error('Failed to decode CBOR:', e);
    process.exit(1);
  }

  console.log('--- Decoded Payload ---');
  console.log(`  p (price):       $${decoded.p.toFixed(2)}`);
  console.log(`  n (num_sources): ${decoded.n}`);
  console.log(`  d (dispersion):  ${(decoded.d * 100).toFixed(4)}%`);
  console.log(`  h (bundle_hash): ${decoded.h}`);
  console.log('');

  // Validate
  const validation = validatePayload(decoded);
  if (validation.valid) {
    console.log('Validation: PASSED');
  } else {
    console.log('Validation: FAILED');
    validation.errors.forEach(e => console.log(`  - ${e}`));
  }
  console.log('');

  // Try to find and verify the bundle locally
  console.log('--- Local Bundle Verification ---');
  const bundle = getBundleByHash(decoded.h);
  if (bundle) {
    console.log('Bundle found locally!');
    // Strip _meta before hashing to verify
    const rawBundle = { ...bundle } as RawBundle & { _meta?: unknown };
    delete rawBundle._meta;

    const recomputedHash = hashBundle(rawBundle as RawBundle);
    const recomputedH = recomputedHash.slice(0, 16);

    if (recomputedH === decoded.h) {
      console.log(`Hash verification: PASSED (${recomputedH})`);
      console.log('');
      console.log('--- Bundle Summary ---');
      const b = rawBundle as RawBundle;
      console.log(`  Tick ID:    ${b.tick_id}`);
      console.log(`  Network:    ${b.network}`);
      console.log(`  Price:      $${b.index.price.toFixed(2)}`);
      console.log(`  Sources:    ${b.index.sources_used.join(', ')}`);
      console.log(`  Dispersion: ${(b.index.dispersion * 100).toFixed(4)}%`);
      console.log('');
      console.log('--- Provider Responses ---');
      b.responses.forEach(r => {
        console.log(`  ${r.provider}: ${r.ok ? `$${r.price?.toFixed(2)}` : `ERROR: ${r.error}`}`);
      });
    } else {
      console.log(`Hash verification: FAILED`);
      console.log(`  On-chain h: ${decoded.h}`);
      console.log(`  Computed h: ${recomputedH}`);
    }
  } else {
    console.log(`Bundle not found locally (h=${decoded.h})`);
    console.log('Fetch the bundle from the oracle API:');
    console.log(`  curl http://localhost:3000/bundle/${decoded.h}`);
  }

  console.log('\nVerification complete.');
}

main();
