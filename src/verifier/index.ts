/**
 * Transaction verification logic.
 * Reusable by both CLI (scripts/verify-tx.ts) and API (/verify/:txid).
 */

import { decode as cborDecode } from 'cbor-x';
import { getBundleByHash, hashBundle } from '../proofs/index.js';
import { RawBundle, ProviderResponse } from '../types.js';

// Explorer API endpoints by network
const EXPLORER_API: Record<string, string> = {
  'testnet-10': 'https://api-tn10.kaspa.org',
  'testnet-11': 'https://api-tn11.kaspa.org',
  'mainnet': 'https://api.kaspa.org'
};

export interface DecodedPayload {
  d: number;
  h: string;
  n: number;
  p: number;
}

export interface ExplorerTx {
  transaction_id: string;
  inputs: unknown[];
  outputs: unknown[];
  payload?: string;
  block_time?: number;
}

export interface VerificationResult {
  txid: string;
  network: string;
  status: 'PASSED' | 'FAILED' | 'PARTIAL' | 'ERROR';
  error?: string;

  // Transaction data
  tx_found: boolean;
  block_time?: string;
  payload_hex?: string;
  payload_size?: number;

  // Decoded payload
  decoded?: DecodedPayload;

  // Validation
  validation?: {
    valid: boolean;
    errors: string[];
  };

  // Bundle verification
  bundle_found: boolean;
  hash_verified?: boolean;
  bundle_summary?: {
    tick_id: string;
    network: string;
    price: number;
    sources_used: string[];
    dispersion: number;
  };
  provider_responses?: Array<{
    provider: string;
    price: number | null;
    ok: boolean;
    error: string | null;
  }>;
}

function validatePayload(payload: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Payload is not an object'] };
  }

  const p = payload as Record<string, unknown>;

  // Validate 'p' (price) - number, positive, reasonable range
  if (typeof p.p !== 'number') {
    errors.push(`p (price) must be a number, got ${typeof p.p}`);
  } else if (p.p <= 0 || p.p > 10_000_000) {
    errors.push(`p (price) out of range: ${p.p}`);
  }

  // Validate 'n' (num_sources) - integer, 1-10
  if (typeof p.n !== 'number' || !Number.isInteger(p.n)) {
    errors.push(`n (num_sources) must be an integer, got ${typeof p.n}`);
  } else if (p.n < 1 || p.n > 10) {
    errors.push(`n (num_sources) out of range: ${p.n}`);
  }

  // Validate 'd' (dispersion) - number, 0-1
  if (typeof p.d !== 'number') {
    errors.push(`d (dispersion) must be a number, got ${typeof p.d}`);
  } else if (p.d < 0 || p.d > 1) {
    errors.push(`d (dispersion) out of range: ${p.d}`);
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
    return null;
  }

  const url = `${baseUrl}/transactions/${txid}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    return await res.json() as ExplorerTx;
  } catch {
    return null;
  }
}

/**
 * Verify a transaction and return structured result.
 */
export async function verifyTransaction(txid: string, network: string = 'testnet-10'): Promise<VerificationResult> {
  const result: VerificationResult = {
    txid,
    network,
    status: 'ERROR',
    tx_found: false,
    bundle_found: false
  };

  // Validate txid format (64 hex chars)
  if (!/^[a-f0-9]{64}$/i.test(txid)) {
    result.error = 'Invalid TXID format (expected 64 hex characters)';
    return result;
  }

  // Fetch transaction
  const tx = await fetchTxFromExplorer(txid, network);
  if (!tx) {
    result.error = 'Transaction not found';
    return result;
  }

  result.tx_found = true;
  if (tx.block_time) {
    result.block_time = new Date(tx.block_time).toISOString();
  }

  // Check payload
  const payloadHex = tx.payload;
  if (!payloadHex) {
    result.error = 'Transaction has no payload';
    result.status = 'FAILED';
    return result;
  }

  result.payload_hex = payloadHex;
  result.payload_size = payloadHex.length / 2;

  // Decode CBOR
  let decoded: DecodedPayload;
  try {
    const payloadBytes = Buffer.from(payloadHex, 'hex');
    decoded = cborDecode(payloadBytes) as DecodedPayload;
  } catch (e) {
    result.error = `Failed to decode CBOR: ${e}`;
    result.status = 'FAILED';
    return result;
  }

  result.decoded = decoded;

  // Validate payload fields
  const validation = validatePayload(decoded);
  result.validation = validation;

  if (!validation.valid) {
    result.status = 'FAILED';
    result.error = 'Payload validation failed';
    return result;
  }

  // Try to find bundle locally
  const bundle = getBundleByHash(decoded.h);
  if (!bundle) {
    result.bundle_found = false;
    result.status = 'PARTIAL'; // TX valid but can't verify bundle
    return result;
  }

  result.bundle_found = true;

  // Strip _meta before hashing
  const rawBundle = { ...bundle } as RawBundle & { _meta?: unknown };
  delete rawBundle._meta;

  // Verify hash
  const recomputedHash = hashBundle(rawBundle as RawBundle);
  const recomputedH = recomputedHash.slice(0, 16);
  result.hash_verified = recomputedH === decoded.h;

  // Add bundle summary
  const b = rawBundle as RawBundle;
  result.bundle_summary = {
    tick_id: b.tick_id,
    network: b.network,
    price: b.index.price,
    sources_used: b.index.sources_used,
    dispersion: b.index.dispersion
  };

  result.provider_responses = b.responses.map((r: ProviderResponse) => ({
    provider: r.provider,
    price: r.price,
    ok: r.ok,
    error: r.error
  }));

  // Final status
  if (result.hash_verified) {
    result.status = 'PASSED';
  } else {
    result.status = 'FAILED';
    result.error = `Hash mismatch: on-chain=${decoded.h}, computed=${recomputedH}`;
  }

  return result;
}
