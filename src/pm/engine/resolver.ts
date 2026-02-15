/**
 * Market Resolution Engine
 *
 * Syncs with the oracle and resolves markets deterministically.
 */

import {
  getOpenMarkets,
  updateMarket,
  getOracleState,
  updateOracleState,
  updateOraclePrice,
  getOraclePrices,
  getPositionsForMarket,
  getBalance,
  upsertBalance,
  getMarket
} from '../store/index.js';
import { Market, MarketOutcome } from '../models/index.js';
import { verifyTransaction } from '../../verifier/index.js';
import { redeem, burnLosing, generateMockTxid } from '../krc20/index.js';

const ORACLE_API_BASE = process.env.ORACLE_API_URL || 'http://localhost:3000';

interface OracleLatest {
  latest: {
    h: string;
    hash_full: string;
    txid: string | null;
    updated_at: string;
  };
  bundle: {
    tick_id: string;
    network: string;
    index: {
      price: number;
      sources_used: string[];
      num_sources: number;
      dispersion: number;
      status: string;
    };
  };
}

/**
 * Fetch latest oracle data.
 */
export async function fetchOracleLatest(): Promise<OracleLatest | null> {
  try {
    const res = await fetch(`${ORACLE_API_BASE}/latest`);
    if (!res.ok) return null;
    return await res.json() as OracleLatest;
  } catch (e) {
    console.error('[Resolver] Failed to fetch oracle:', e);
    return null;
  }
}

/**
 * Fetch ETH and KAS prices from CoinGecko.
 */
export async function fetchAssetPrices(): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,kaspa&vs_currencies=usd'
    );
    if (res.ok) {
      const data = await res.json() as {
        ethereum?: { usd: number };
        kaspa?: { usd: number };
      };
      if (data.ethereum?.usd) prices['ETH'] = data.ethereum.usd;
      if (data.kaspa?.usd) prices['KAS'] = data.kaspa.usd;
    }
  } catch (e) {
    console.error('[Resolver] Failed to fetch ETH/KAS prices:', e);
  }
  return prices;
}

/**
 * Verify an oracle transaction.
 */
export async function verifyOracleTx(txid: string): Promise<{
  verified: boolean;
  price?: number;
  hash?: string;
  error?: string;
}> {
  try {
    const result = await verifyTransaction(txid, 'testnet-10');
    if (result.status === 'PASSED' && result.decoded) {
      return {
        verified: true,
        price: result.decoded.p,
        hash: result.decoded.h
      };
    }
    return { verified: false, error: result.error || 'Verification failed' };
  } catch (e) {
    return { verified: false, error: String(e) };
  }
}

/**
 * Check if a market condition is met.
 */
function checkMarketCondition(market: Market, price: number): boolean {
  if (market.direction === '>=') {
    return price >= market.threshold_price;
  } else {
    return price <= market.threshold_price;
  }
}

/**
 * Resolve a market and pay out winners.
 */
async function resolveMarket(
  market: Market,
  outcome: MarketOutcome,
  price: number,
  txid: string | null,
  hash: string | null
): Promise<void> {
  console.log(`[Resolver] Resolving market ${market.id} as ${outcome} at price $${price}`);

  const resolutionTxid = txid || generateMockTxid('resolution');

  // Update market
  updateMarket(market.id, {
    status: 'RESOLVED',
    resolved_outcome: outcome,
    resolved_at: Date.now(),
    resolved_txid: resolutionTxid,
    resolved_price: price,
    resolved_hash: hash
  });

  // Get token tickers
  const winningTicker = outcome === 'YES' ? market.yes_token_ticker : market.no_token_ticker;
  const losingTicker = outcome === 'YES' ? market.no_token_ticker : market.yes_token_ticker;

  // Pay out winners and handle tokens
  const positions = getPositionsForMarket(market.id);
  for (const position of positions) {
    const winningShares = outcome === 'YES' ? position.yes_shares : position.no_shares;
    const losingShares = outcome === 'YES' ? position.no_shares : position.yes_shares;

    // Redeem winning tokens
    if (winningShares > 0 && winningTicker) {
      // Redeem tokens - this burns them and records the event
      await redeem(winningTicker, position.user_wallet, winningShares, resolutionTxid);

      // Credit KAS balance
      let balance = getBalance(position.user_wallet);
      if (!balance) {
        balance = {
          wallet: position.user_wallet,
          balance_kas: 0,
          deposited_kas: 0,
          withdrawn_kas: 0
        };
      }
      // Each winning share pays 1 KAS
      balance.balance_kas += winningShares;
      upsertBalance(balance);
      console.log(`[Resolver] Redeemed ${winningShares} ${winningTicker} for ${winningShares} KAS to ${position.user_wallet}`);
    }

    // Burn losing tokens (worth 0)
    if (losingShares > 0 && losingTicker) {
      await burnLosing(losingTicker, position.user_wallet, losingShares, resolutionTxid);
      console.log(`[Resolver] Burned ${losingShares} losing ${losingTicker} from ${position.user_wallet}`);
    }
  }
}

/**
 * Process a single tick from the oracle.
 */
export async function processOracleTick(data: OracleLatest): Promise<{
  price: number;
  marketsResolved: string[];
}> {
  const btcPrice = data.bundle.index.price;
  const txid = data.latest.txid;
  const hash = data.latest.h;

  // Update BTC oracle state (on-chain anchored)
  updateOracleState(btcPrice, txid, hash);

  // Fetch ETH and KAS prices from CoinGecko
  const assetPrices = await fetchAssetPrices();
  for (const [asset, price] of Object.entries(assetPrices)) {
    updateOraclePrice(asset, price);
  }

  // Build full price map for resolution
  const allPrices = getOraclePrices();

  const marketsResolved: string[] = [];
  const openMarkets = getOpenMarkets();
  const now = Date.now();

  for (const market of openMarkets) {
    // Determine which price to use for this market's asset
    const { getEvent } = await import('../store/index.js');
    const event = getEvent(market.event_id);
    const marketAsset = market.asset || event?.asset || 'BTC';
    const assetPrice = allPrices[marketAsset];

    if (assetPrice == null) continue; // No price available for this asset yet

    // Check if condition is met (early resolution)
    if (checkMarketCondition(market, assetPrice)) {
      await resolveMarket(market, 'YES', assetPrice, txid, hash);
      marketsResolved.push(market.id);
      continue;
    }

    // Check if deadline passed (resolve as NO)
    if (event && now >= event.deadline) {
      await resolveMarket(market, 'NO', assetPrice, txid, hash);
      marketsResolved.push(market.id);
    }
  }

  return { price: btcPrice, marketsResolved };
}

/**
 * Sync with oracle and process any resolutions.
 */
export async function syncAndResolve(): Promise<{
  success: boolean;
  price?: number;
  txid?: string | null;
  marketsResolved?: string[];
  error?: string;
}> {
  const data = await fetchOracleLatest();
  if (!data) {
    return { success: false, error: 'Failed to fetch oracle data' };
  }

  const result = await processOracleTick(data);

  return {
    success: true,
    price: result.price,
    txid: data.latest.txid,
    marketsResolved: result.marketsResolved
  };
}

/**
 * Background sync loop.
 */
let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startSyncLoop(intervalMs: number = 5000): void {
  if (syncInterval) {
    console.log('[Resolver] Sync loop already running');
    return;
  }

  console.log(`[Resolver] Starting sync loop (${intervalMs}ms interval)`);

  const tick = async () => {
    const result = await syncAndResolve();
    if (result.success) {
      if (result.marketsResolved && result.marketsResolved.length > 0) {
        console.log(`[Resolver] Resolved ${result.marketsResolved.length} markets`);
      }
    }
  };

  // Initial tick
  tick();

  // Start interval
  syncInterval = setInterval(tick, intervalMs);
}

export function stopSyncLoop(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('[Resolver] Sync loop stopped');
  }
}
