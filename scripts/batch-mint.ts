#!/usr/bin/env tsx
/**
 * Batch mint KRC-20 tokens to platform wallet.
 * Runs N mints per token sequentially (inscription lock prevents parallel).
 *
 * Usage: npx tsx scripts/batch-mint.ts [MINTS_PER_TOKEN]
 * Default: 9 additional mints per token (we already have 1 from initial mint)
 */

import 'dotenv/config';
process.env.USE_REAL_KRC20 = 'true';

import '../src/pm/store/index.js';
import { getAllKRC20Tokens } from '../src/pm/store/index.js';
import * as kasplex from '../src/pm/krc20/kasplex.js';

const MINTS_PER_TOKEN = parseInt(process.argv[2] || '9', 10);

async function main() {
  const isAvailable = await kasplex.isAvailable();
  if (!isAvailable) {
    console.error('Kasplex dependencies not available.');
    process.exit(1);
  }

  const tokens = getAllKRC20Tokens();
  const total = tokens.length * MINTS_PER_TOKEN;
  console.log(`\n=== Batch mint: ${MINTS_PER_TOKEN} mints × ${tokens.length} tokens = ${total} operations ===\n`);

  let done = 0;
  let failed = 0;

  for (const token of tokens) {
    for (let i = 0; i < MINTS_PER_TOKEN; i++) {
      done++;
      const label = `[${done}/${total}] ${token.ticker} mint ${i + 1}/${MINTS_PER_TOKEN}`;
      console.log(`\n${label}...`);

      try {
        const result = await kasplex.mintToken(token.ticker, 'platform');
        if (result.success) {
          console.log(`  OK: ${result.revealTxid}`);
        } else {
          console.error(`  FAIL: ${result.error}`);
          failed++;
        }
      } catch (err) {
        console.error(`  ERROR: ${err instanceof Error ? err.message : err}`);
        failed++;
      }

      // Brief pause between mints to let mempool settle
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`\n=== Done: ${done - failed}/${total} succeeded, ${failed} failed ===`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
