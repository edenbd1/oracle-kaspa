#!/usr/bin/env tsx
/**
 * Pre-mint all KRC-20 tokens to the platform wallet.
 *
 * Each mint operation creates up to `mintLimit` tokens on-chain
 * for the platform wallet (the signer). These tokens can then
 * be transferred to users when they buy shares.
 *
 * This is a one-time operation per token.
 * Takes ~30-60s per token (commit-reveal cycle).
 */

import 'dotenv/config';

// Force real KRC20 mode
process.env.USE_REAL_KRC20 = 'true';

import '../src/pm/store/index.js';
import { getAllKRC20Tokens } from '../src/pm/store/index.js';
import * as kasplex from '../src/pm/krc20/kasplex.js';
import * as indexer from '../src/pm/krc20/indexer.js';

async function main() {
  const isAvailable = await kasplex.isAvailable();
  if (!isAvailable) {
    console.error('Kasplex dependencies not available. Cannot mint on-chain.');
    process.exit(1);
  }

  const tokens = getAllKRC20Tokens();
  console.log(`\n=== Pre-minting ${tokens.length} tokens to platform wallet ===\n`);

  // Check which tokens already exist on-chain
  for (const token of tokens) {
    const exists = await indexer.tokenExists(token.ticker);
    console.log(`${token.ticker}: ${exists ? 'EXISTS on-chain' : 'NOT FOUND on-chain'}`);
  }

  console.log('\n--- Starting mint operations ---\n');

  let minted = 0;
  let skipped = 0;
  let failed = 0;

  for (const token of tokens) {
    console.log(`\n[${minted + skipped + failed + 1}/${tokens.length}] Minting ${token.ticker} (${token.side} ${token.asset} $${token.threshold.toLocaleString()})...`);

    // Check if platform already has balance for this token
    const platformAddress = process.env.PLATFORM_ADDRESS || '';
    if (platformAddress) {
      try {
        const balance = await indexer.getKRC20Balance(platformAddress, token.ticker);
        if (balance > 0) {
          console.log(`  Already has ${balance} tokens on-chain. Skipping.`);
          skipped++;
          continue;
        }
      } catch {
        // Continue with mint
      }
    }

    try {
      const result = await kasplex.mintToken(token.ticker, 'platform');
      if (result.success) {
        console.log(`  SUCCESS! Reveal txid: ${result.revealTxid}`);
        minted++;

        // Wait a bit for indexer to catch up
        console.log('  Waiting 3s for indexer...');
        await new Promise(r => setTimeout(r, 3000));
      } else {
        console.error(`  FAILED: ${result.error}`);
        failed++;
      }
    } catch (err) {
      console.error(`  ERROR: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`  Minted: ${minted}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Failed: ${failed}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
