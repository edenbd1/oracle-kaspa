/**
 * KRC20 Mock Service
 *
 * Simulates KRC20 token operations for prediction market shares.
 * Designed to be easily replaceable with real on-chain KRC20 contracts.
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
  generateMockTxid,
  generateEventId
} from './utils.js';
import {
  getKRC20Token,
  upsertKRC20Token,
  addKRC20MintEvent,
  addKRC20BurnEvent,
  addKRC20RedeemEvent,
  getPosition
} from '../store/index.js';
import { Event, Market } from '../models/index.js';

const DECIMALS = 8; // Standard KAS decimals

/**
 * Deploy YES/NO token pair for a market
 */
export function deployMarketTokens(market: Market, event: Event): TokenPair {
  const timestamp = Date.now();

  const yesTicker = generateTokenTicker(event.asset, market.threshold_price, 'YES');
  const noTicker = generateTokenTicker(event.asset, market.threshold_price, 'NO');

  const yesToken: KRC20TokenInfo = {
    ticker: yesTicker,
    market_id: market.id,
    side: 'YES',
    asset: event.asset,
    threshold: market.threshold_price,
    total_supply: 0,
    decimals: DECIMALS,
    deployed_at: timestamp,
    deployed_txid: generateMockTxid('deploy-yes')
  };

  const noToken: KRC20TokenInfo = {
    ticker: noTicker,
    market_id: market.id,
    side: 'NO',
    asset: event.asset,
    threshold: market.threshold_price,
    total_supply: 0,
    decimals: DECIMALS,
    deployed_at: timestamp,
    deployed_txid: generateMockTxid('deploy-no')
  };

  // Store tokens
  upsertKRC20Token(yesToken);
  upsertKRC20Token(noToken);

  console.log(`[KRC20] Deployed tokens: ${yesTicker}, ${noTicker}`);

  return { yes_token: yesToken, no_token: noToken };
}

/**
 * Mint tokens when user buys shares
 */
export function mint(
  ticker: string,
  recipient: string,
  amount: number,
  tradeId: string
): MintResult {
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
  token.total_supply += amount;
  upsertKRC20Token(token);

  // Record mint event
  const txid = generateMockTxid('mint');
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

  console.log(`[KRC20] Minted ${amount.toFixed(4)} ${ticker} to ${recipient.slice(0, 15)}...`);

  return {
    success: true,
    ticker,
    amount,
    txid,
    new_supply: token.total_supply
  };
}

/**
 * Burn tokens when user sells shares
 */
export function burn(
  ticker: string,
  from: string,
  amount: number,
  tradeId: string
): BurnResult {
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

  // Check sufficient supply
  if (token.total_supply < amount) {
    return {
      success: false,
      ticker,
      amount,
      txid: '',
      new_supply: token.total_supply,
      error: `Insufficient token supply`
    };
  }

  // Update total supply
  token.total_supply -= amount;
  upsertKRC20Token(token);

  // Record burn event
  const txid = generateMockTxid('burn');
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

  console.log(`[KRC20] Burned ${amount.toFixed(4)} ${ticker} from ${from.slice(0, 15)}...`);

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
 */
export function redeem(
  ticker: string,
  from: string,
  amount: number,
  resolutionTxid: string
): RedeemResult {
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

  console.log(`[KRC20] Redeemed ${amount.toFixed(4)} ${ticker} for ${kasReceived.toFixed(4)} KAS`);

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
export function burnLosing(
  ticker: string,
  from: string,
  amount: number,
  resolutionTxid: string
): BurnResult {
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

  console.log(`[KRC20] Burned losing ${amount.toFixed(4)} ${ticker}`);

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
 * This derives the balance from the position in the store
 */
export function balanceOf(ticker: string, wallet: string): number {
  const token = getKRC20Token(ticker);
  if (!token) return 0;

  const position = getPosition(wallet, token.market_id);
  if (!position) return 0;

  return token.side === 'YES' ? position.yes_shares : position.no_shares;
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
