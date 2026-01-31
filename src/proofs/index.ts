import { createHash } from 'crypto';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ProviderResponse, IndexOutput, RawBundle, Config } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

// Data directory for bundles (used by API server)
const dataDir = join(projectRoot, 'data');
const bundlesDir = join(dataDir, 'bundles');
const latestFile = join(dataDir, 'latest.json');

/**
 * Recursively sort object keys for deterministic JSON serialization.
 * Arrays maintain their order; objects have keys sorted alphabetically.
 */
export function sortedReplacer(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    Object.keys(value as Record<string, unknown>).sort().forEach(k => {
      sorted[k] = (value as Record<string, unknown>)[k];
    });
    return sorted;
  }
  return value;
}

/**
 * Serialize object to canonical JSON (sorted keys, no extra whitespace).
 */
export function canonicalJson(obj: unknown): string {
  return JSON.stringify(obj, sortedReplacer);
}

export function createBundle(
  responses: ProviderResponse[],
  index: IndexOutput,
  config: Config
): RawBundle {
  return {
    tick_id: new Date().toISOString(),
    network: config.network,
    collector: {
      interval: config.anchorIntervalSeconds,
      jitter: config.jitterSeconds
    },
    responses,
    index
  };
}

/**
 * Hash bundle using SHA-256 of canonical JSON (sorted keys).
 * This ensures the same bundle always produces the same hash.
 */
export function hashBundle(bundle: RawBundle): string {
  return createHash('sha256').update(canonicalJson(bundle)).digest('hex');
}

/**
 * Store bundle to disk in both legacy location and new data/bundles directory.
 */
export function storeBundle(bundle: RawBundle, hash: string, txId?: string): void {
  const tickId = bundle.tick_id.replace(/[:.]/g, '-');

  // Legacy storage (proofs/raw and proofs/index)
  const rawDir = join(projectRoot, 'proofs', 'raw');
  const indexDir = join(projectRoot, 'proofs', 'index');
  mkdirSync(rawDir, { recursive: true });
  mkdirSync(indexDir, { recursive: true });
  writeFileSync(join(rawDir, `${tickId}.json`), JSON.stringify(bundle, null, 2));
  writeFileSync(join(indexDir, `${tickId}.json`), JSON.stringify({ ...bundle.index, hash }, null, 2));

  // New storage: data/bundles/<h>.json (keyed by hash for API retrieval)
  mkdirSync(bundlesDir, { recursive: true });
  const h = hash.slice(0, 16);
  const bundleWithMeta = {
    ...bundle,
    _meta: {
      hash_full: hash,
      hash_short: h,
      txid: txId || null,
      stored_at: new Date().toISOString()
    }
  };
  writeFileSync(join(bundlesDir, `${h}.json`), JSON.stringify(bundleWithMeta, null, 2));
}

/**
 * Update the latest.json index file with the most recent bundle info.
 */
export function updateLatest(hash: string, txId: string | null): void {
  mkdirSync(dataDir, { recursive: true });
  const h = hash.slice(0, 16);
  writeFileSync(latestFile, JSON.stringify({
    h,
    hash_full: hash,
    txid: txId,
    updated_at: new Date().toISOString()
  }, null, 2));
}

/**
 * Get the latest bundle reference.
 */
export function getLatest(): { h: string; hash_full: string; txid: string | null; updated_at: string } | null {
  if (!existsSync(latestFile)) return null;
  try {
    return JSON.parse(readFileSync(latestFile, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Get a bundle by its short hash (first 16 chars).
 */
export function getBundleByHash(h: string): unknown | null {
  const bundlePath = join(bundlesDir, `${h}.json`);
  if (!existsSync(bundlePath)) return null;
  try {
    return JSON.parse(readFileSync(bundlePath, 'utf-8'));
  } catch {
    return null;
  }
}
