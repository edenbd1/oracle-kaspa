import { createHash } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ProviderResponse, IndexOutput, RawBundle, Config } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');

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

export function hashBundle(bundle: RawBundle): string {
  return createHash('sha256').update(JSON.stringify(bundle)).digest('hex');
}

export function storeBundle(bundle: RawBundle, hash: string): void {
  const tickId = bundle.tick_id.replace(/[:.]/g, '-');
  const rawDir = join(projectRoot, 'proofs', 'raw');
  const indexDir = join(projectRoot, 'proofs', 'index');

  mkdirSync(rawDir, { recursive: true });
  mkdirSync(indexDir, { recursive: true });

  writeFileSync(join(rawDir, `${tickId}.json`), JSON.stringify(bundle, null, 2));
  writeFileSync(join(indexDir, `${tickId}.json`), JSON.stringify({ ...bundle.index, hash }, null, 2));
}
