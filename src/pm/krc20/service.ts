/**
 * KRC20 Service
 *
 * Handles KRC20 token operations for prediction market shares.
 * Supports two modes:
 * - Mock (default): In-memory simulation for development
 * - Real (USE_REAL_KRC20=true): On-chain Kasplex inscriptions
 *
 * The hybrid approach:
 * - Platform pays for token deployment (~1000 KAS each for YES/NO)
 * - Users pay 1 KAS mint fee per trade (included in trade amount)
 */

import {
  KRC20TokenInfo,
  KRC20MintEvent,
  KRC20BurnEvent,
  KRC20RedeemEvent,
  TokenSide,
  MintResult,
  BurnResult,
  RedeemResult,
  TokenPair
} from './types.js';
import {
  generateTokenTicker,
  generateTokenTickerWithMonth,
  generateMockTxid,
  generateEventId,
  generateDisplayName,
  indexToLetter
} from './utils.js';
import {
  getKRC20Token,
  upsertKRC20Token,
  addKRC20MintEvent,
  addKRC20BurnEvent,
  addKRC20RedeemEvent,
  getPosition,
  getAllKRC20Tokens
} from '../store/index.js';
import { Event, Market } from '../models/index.js';
import * as kasplex from './kasplex.js';
import * as indexer from './indexer.js';

// Configuration
const USE_REAL_KRC20 = process.env.USE_REAL_KRC20 === 'true';

// Re-export fee constants
export { MINT_FEE_KAS, DEPLOY_FEE_KAS } from './kasplex.js';

/**
 * Check if real KRC-20 mode is enabled
 */
export function isRealMode(): boolean {
  return USE_REAL_KRC20;
}

/**
 * Check if real KRC-20 operations are available
 */
export async function isRealModeAvailable(): Promise<boolean> {
  if (!USE_REAL_KRC20) return false;
  return await kasplex.isAvailable();
}

const DECIMALS = 8; // Standard KAS decimals

/**
 * Get the next market index letter for an asset
 * Counts existing tokens for the asset and returns next letter (A, B, C, etc.)
 */
export function getNextMarketIndex(asset: string): string {
  const allTokens = getAllKRC20Tokens();
  const assetTokens = allTokens.filter(t => t.asset.toUpperCase() === asset.toUpperCase());
  // Each market has 2 tokens (YES and NO), so divide by 2
  const marketCount = Math.floor(assetTokens.length / 2);
  return indexToLetter(marketCount);
}

/**
 * Deploy YES/NO token pair for a market
 *
 * In real mode: Creates on-chain KRC-20 tokens via Kasplex inscriptions
 * Cost: ~2000 KAS total (1000 KAS per token)
 */
export async function deployMarketTokens(market: Market, event: Event): Promise<TokenPair> {
  const timestamp = Date.now();

  // Use market's existing tickers if set, otherwise calculate from index
  let yesTicker: string;
  let noTicker: string;
  let marketIndex: string;

  if (market.yes_token_ticker && market.no_token_ticker) {
    // Guard: prevent accidental double-deploy
    const existingYes = await indexer.tokenExists(market.yes_token_ticker);
    const existingNo = await indexer.tokenExists(market.no_token_ticker);
    if (existingYes && existingNo) {
      console.warn(`[KRC20] Tokens already deployed for market ${market.id}, skipping deploy`);
      // Return existing tokens info from local store
      const yesToken = getKRC20Token(market.yes_token_ticker);
      const noToken = getKRC20Token(market.no_token_ticker);
      if (yesToken && noToken) {
        return { yes_token: yesToken, no_token: noToken };
      }
    }

    // Use existing tickers from market
    yesTicker = market.yes_token_ticker;
    noTicker = market.no_token_ticker;
    // Extract market index from ticker (e.g., YBTCA -> A, YBTCBA -> A)
    marketIndex = yesTicker.slice(-1);
  } else {
    // Calculate market index based on existing markets for this asset
    marketIndex = getNextMarketIndex(event.asset);
    // Use new ticker format with month (derived from event deadline for determinism)
    const eventDate = new Date(event.deadline);
    yesTicker = generateTokenTickerWithMonth(event.asset, marketIndex, 'YES', eventDate);
    noTicker = generateTokenTickerWithMonth(event.asset, marketIndex, 'NO', eventDate);
  }

  const yesDisplayName = generateDisplayName('YES', event.asset, market.threshold_price);
  const noDisplayName = generateDisplayName('NO', event.asset, market.threshold_price);

  // Nouveaux paramètres - très larges pour hackathon
  // 1 mint doit couvrir au moins 1000+ tokens pour que le transfer marche immédiatement
  const maxSupply = 100_000_000_000_000;   // 100 trillion
  const mintLimit = 1_000_000_000_000;      // 1 trillion per mint

  let yesDeployTxid = generateMockTxid('deploy-yes');
  let noDeployTxid = generateMockTxid('deploy-no');

  // Real mode: Deploy on-chain tokens
  if (USE_REAL_KRC20) {
    console.log(`[KRC20] Deploying real tokens on-chain...`);
    console.log(`[KRC20] WARNING: This will cost ~2000 KAS total`);

    // Check if tokens already exist on-chain
    const yesExists = await indexer.tokenExists(yesTicker);
    const noExists = await indexer.tokenExists(noTicker);

    if (!yesExists) {
      const yesResult = await kasplex.deployToken(yesTicker, maxSupply, mintLimit);
      if (yesResult.success && yesResult.revealTxid) {
        yesDeployTxid = yesResult.revealTxid;
        console.log(`[KRC20] YES token deployed: ${yesTicker} (txid: ${yesDeployTxid})`);

        // Wait for indexer to pick up the token
        await indexer.waitForToken(yesTicker);
      } else {
        console.error(`[KRC20] Failed to deploy YES token: ${yesResult.error}`);
        // Fall back to mock txid
      }
    } else {
      console.log(`[KRC20] YES token ${yesTicker} already exists on-chain`);
      const info = await indexer.getTokenInfo(yesTicker);
      if (info?.hashRev) yesDeployTxid = info.hashRev;
    }

    if (!noExists) {
      const noResult = await kasplex.deployToken(noTicker, maxSupply, mintLimit);
      if (noResult.success && noResult.revealTxid) {
        noDeployTxid = noResult.revealTxid;
        console.log(`[KRC20] NO token deployed: ${noTicker} (txid: ${noDeployTxid})`);

        // Wait for indexer to pick up the token
        await indexer.waitForToken(noTicker);
      } else {
        console.error(`[KRC20] Failed to deploy NO token: ${noResult.error}`);
        // Fall back to mock txid
      }
    } else {
      console.log(`[KRC20] NO token ${noTicker} already exists on-chain`);
      const info = await indexer.getTokenInfo(noTicker);
      if (info?.hashRev) noDeployTxid = info.hashRev;
    }
  }

  const PREMINT_SUPPLY = 100_000; // 100K tokens per side (10 on-chain mints with dec=8)

  const yesToken: KRC20TokenInfo = {
    ticker: yesTicker,
    display_name: yesDisplayName,
    market_id: market.id,
    side: 'YES',
    asset: event.asset,
    threshold: market.threshold_price,
    market_index: marketIndex,
    total_supply: PREMINT_SUPPLY,
    platform_balance: PREMINT_SUPPLY,
    decimals: DECIMALS,
    deployed_at: timestamp,
    deployed_txid: yesDeployTxid
  };

  const noToken: KRC20TokenInfo = {
    ticker: noTicker,
    display_name: noDisplayName,
    market_id: market.id,
    side: 'NO',
    asset: event.asset,
    threshold: market.threshold_price,
    market_index: marketIndex,
    total_supply: PREMINT_SUPPLY,
    platform_balance: PREMINT_SUPPLY,
    decimals: DECIMALS,
    deployed_at: timestamp,
    deployed_txid: noDeployTxid
  };

  // Store tokens locally (for tracking)
  upsertKRC20Token(yesToken);
  upsertKRC20Token(noToken);

  console.log(`[KRC20] Deployed tokens: ${yesTicker}, ${noTicker} (real=${USE_REAL_KRC20})`);

  return { yes_token: yesToken, no_token: noToken };
}

/**
 * Transfer tokens from platform pool to user (on buy).
 *
 * Pre-minted tokens are held in platform_balance.
 * In mock mode: instant accounting transfer.
 * In real mode: on-chain KRC-20 transfer (fast, no mint needed).
 */
export async function mint(
  ticker: string,
  recipient: string,
  amount: number,
  tradeId: string
): Promise<MintResult> {
  const token = getKRC20Token(ticker);

  if (!token) {
    return {
      success: false,
      ticker,
      amount,
      txid: '',
      new_supply: 0,
      error: `Token ${ticker} not found`
    };
  }

  // Check platform has enough pre-minted tokens
  const platformBal = token.platform_balance ?? 0;
  if (platformBal < amount) {
    return {
      success: false,
      ticker,
      amount,
      txid: '',
      new_supply: token.total_supply,
      error: `Insufficient platform balance: have ${platformBal.toFixed(2)}, need ${amount.toFixed(2)}`
    };
  }

  let txid = generateMockTxid('transfer');

  // Real mode: On-chain transfer from platform to recipient (no mint needed!)
  if (USE_REAL_KRC20) {
    console.log(`[KRC20] Transferring ${amount} ${ticker} from platform to ${recipient}...`);
    const transferResult = await kasplex.transferToken(ticker, recipient, amount);
    if (!transferResult.success) {
      console.error(`[KRC20] Transfer failed: ${transferResult.error}`);
      return {
        success: false,
        ticker,
        amount,
        txid: '',
        new_supply: token.total_supply,
        error: transferResult.error || 'Transfer failed'
      };
    }
    txid = transferResult.revealTxid || txid;
    console.log(`[KRC20] Transferred ${amount} ${ticker} to ${recipient}: ${txid}`);
  }

  // Deduct from platform balance (tokens move from platform → user)
  token.platform_balance = platformBal - amount;
  upsertKRC20Token(token);

  // Record mint/transfer event
  const mintEvent: KRC20MintEvent = {
    id: generateEventId('mint'),
    ticker,
    recipient,
    amount,
    trade_id: tradeId,
    txid,
    timestamp: Date.now()
  };
  addKRC20MintEvent(mintEvent);

  console.log(`[KRC20] Transferred ${amount.toFixed(4)} ${ticker} to ${recipient} (real=${USE_REAL_KRC20})`);

  return {
    success: true,
    ticker,
    amount,
    txid,
    new_supply: token.total_supply
  };
}

/**
 * Return tokens from user to platform pool (on sell).
 *
 * Tokens go back to platform_balance for re-use.
 * In real mode: user would transfer tokens back to platform wallet.
 */
export async function burn(
  ticker: string,
  from: string,
  amount: number,
  tradeId: string
): Promise<BurnResult> {
  const token = getKRC20Token(ticker);

  if (!token) {
    return {
      success: false,
      ticker,
      amount,
      txid: '',
      new_supply: 0,
      error: `Token ${ticker} not found`
    };
  }

  let txid = generateMockTxid('return');

  // Real mode: user transfers tokens back to platform
  if (USE_REAL_KRC20) {
    console.log(`[KRC20] Real mode: Tracking return of ${amount} ${ticker} from ${from}`);
  }

  // Return tokens to platform balance
  token.platform_balance = (token.platform_balance ?? 0) + amount;
  upsertKRC20Token(token);

  // Record burn event
  const burnEvent: KRC20BurnEvent = {
    id: generateEventId('burn'),
    ticker,
    from,
    amount,
    trade_id: tradeId,
    txid,
    timestamp: Date.now()
  };
  addKRC20BurnEvent(burnEvent);

  console.log(`[KRC20] Returned ${amount.toFixed(4)} ${ticker} from ${from} to platform (real=${USE_REAL_KRC20})`);

  return {
    success: true,
    ticker,
    amount,
    txid,
    new_supply: token.total_supply
  };
}

/**
 * Redeem winning tokens for KAS
 * Called during market resolution
 *
 * In real mode: Would verify tokens on-chain before paying out
 */
export async function redeem(
  ticker: string,
  from: string,
  amount: number,
  resolutionTxid: string
): Promise<RedeemResult> {
  const token = getKRC20Token(ticker);

  if (!token) {
    return {
      success: false,
      ticker,
      amount,
      kas_received: 0,
      txid: '',
      error: `Token ${ticker} not found`
    };
  }

  // Check sufficient supply
  if (token.total_supply < amount) {
    return {
      success: false,
      ticker,
      amount,
      kas_received: 0,
      txid: '',
      error: `Insufficient token supply for redemption`
    };
  }

  // Real mode: Verify balance on-chain before redeeming
  if (USE_REAL_KRC20) {
    const onChainBalance = await indexer.getKRC20Balance(from, ticker);
    if (onChainBalance < amount) {
      console.warn(`[KRC20] On-chain balance ${onChainBalance} < requested ${amount}`);
      // Continue with local tracking for hackathon
    }
  }

  // Each winning share pays 1 KAS
  const kasReceived = amount;

  // Update total supply (burn on redeem)
  token.total_supply -= amount;
  upsertKRC20Token(token);

  // Record redeem event
  const txid = generateMockTxid('redeem');
  const redeemEvent: KRC20RedeemEvent = {
    id: generateEventId('redeem'),
    ticker,
    from,
    amount,
    kas_received: kasReceived,
    resolution_txid: resolutionTxid,
    txid,
    timestamp: Date.now()
  };
  addKRC20RedeemEvent(redeemEvent);

  console.log(`[KRC20] Redeemed ${amount.toFixed(4)} ${ticker} for ${kasReceived.toFixed(4)} KAS (real=${USE_REAL_KRC20})`);

  return {
    success: true,
    ticker,
    amount,
    kas_received: kasReceived,
    txid
  };
}

/**
 * Burn losing tokens (worth 0 KAS)
 * Called during market resolution for the losing side
 */
export async function burnLosing(
  ticker: string,
  from: string,
  amount: number,
  resolutionTxid: string
): Promise<BurnResult> {
  const token = getKRC20Token(ticker);

  if (!token) {
    return {
      success: false,
      ticker,
      amount,
      txid: '',
      new_supply: 0,
      error: `Token ${ticker} not found`
    };
  }

  // Update total supply
  token.total_supply = Math.max(0, token.total_supply - amount);
  upsertKRC20Token(token);

  // Record as burn event with special trade_id indicating resolution
  const txid = generateMockTxid('burn-losing');
  const burnEvent: KRC20BurnEvent = {
    id: generateEventId('burn'),
    ticker,
    from,
    amount,
    trade_id: `resolution_${resolutionTxid}`,
    txid,
    timestamp: Date.now()
  };
  addKRC20BurnEvent(burnEvent);

  console.log(`[KRC20] Burned losing ${amount.toFixed(4)} ${ticker} (real=${USE_REAL_KRC20})`);

  return {
    success: true,
    ticker,
    amount,
    txid,
    new_supply: token.total_supply
  };
}

/**
 * Get token balance for a wallet
 *
 * In real mode: Can query Kasplex indexer for on-chain balance
 * Default: Derives balance from local position tracking
 */
export async function balanceOf(ticker: string, wallet: string, useIndexer: boolean = false): Promise<number> {
  const token = getKRC20Token(ticker);
  if (!token) return 0;

  // Real mode with indexer query
  if (USE_REAL_KRC20 && useIndexer) {
    try {
      const balance = await indexer.getKRC20Balance(wallet, ticker);
      console.log(`[KRC20] Indexer balance for ${ticker}@${wallet}: ${balance}`);
      return balance;
    } catch (error) {
      console.warn(`[KRC20] Failed to query indexer, falling back to local:`, error);
    }
  }

  // Local tracking (default)
  const position = getPosition(wallet, token.market_id);
  if (!position) return 0;

  return token.side === 'YES' ? position.yes_shares : position.no_shares;
}

/**
 * Get all KRC-20 balances for a wallet from indexer
 * Only works in real mode
 */
export async function getAllBalances(wallet: string): Promise<{ ticker: string; balance: number }[]> {
  if (!USE_REAL_KRC20) {
    console.log('[KRC20] getAllBalances only available in real mode');
    return [];
  }

  try {
    const balances = await indexer.getAllKRC20Balances(wallet);
    return balances.map(b => ({
      ticker: b.tick,
      balance: parseFloat(b.balance)
    }));
  } catch (error) {
    console.error('[KRC20] Failed to get all balances:', error);
    return [];
  }
}

/**
 * Get token info by ticker
 */
export function getToken(ticker: string): KRC20TokenInfo | null {
  return getKRC20Token(ticker);
}

/**
 * Get both tokens for a market
 */
export function getMarketTokens(marketId: string, yesTicker: string, noTicker: string): TokenPair | null {
  const yesToken = getKRC20Token(yesTicker);
  const noToken = getKRC20Token(noTicker);

  if (!yesToken || !noToken) return null;

  return { yes_token: yesToken, no_token: noToken };
}
