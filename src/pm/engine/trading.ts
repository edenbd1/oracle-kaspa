/**
 * Trading Engine
 *
 * Handles buying and selling YES/NO tokens using LMSR pricing.
 */

import {
  priceYes,
  priceNo,
  costToBuyYes,
  costToBuyNo,
  payoutToSellYes,
  payoutToSellNo,
  tokensForCost,
  getBuyQuote,
  getSellQuote,
  TradeQuote,
  DEFAULT_FEE_BPS
} from '../math/lmsr.js';
import {
  Market,
  Trade,
  Position,
  TradeSide,
  createTrade
} from '../models/index.js';
import {
  getMarket,
  updateMarket,
  getBalance,
  upsertBalance,
  getPosition,
  upsertPosition,
  addTrade,
  addPricePoint
} from '../store/index.js';
import { mint, burn } from '../krc20/index.js';
import type { MintResult, BurnResult } from '../krc20/index.js';

export type TradeAction = 'BUY' | 'SELL';

export interface TradeRequest {
  wallet: string;
  marketId: string;
  side: 'YES' | 'NO';
  action: TradeAction;
  kasAmount?: number;    // For BUY
  sharesAmount?: number; // For SELL
  maxSlippage?: number;
  txid?: string;         // For non-custodial trades (on-chain tx id)
}

export interface TradeResult {
  success: boolean;
  error?: string;
  trade?: Trade;
  quote?: TradeQuote;
  newPosition?: Position;
  newBalance?: number;
  marketSnapshot?: {
    priceYes: number;
    priceNo: number;
    qYes: number;
    qNo: number;
  };
  // KRC20 token info
  tokenMinted?: {
    ticker: string;
    amount: number;
    txid: string;
  };
  tokenBurned?: {
    ticker: string;
    amount: number;
    txid: string;
  };
}

/**
 * Get current market prices.
 */
export function getMarketPrices(marketId: string): { yes: number; no: number } | null {
  const market = getMarket(marketId);
  if (!market) return null;

  return {
    yes: priceYes(market.q_yes, market.q_no, market.liquidity_b),
    no: priceNo(market.q_yes, market.q_no, market.liquidity_b)
  };
}

/**
 * Get a quote for a potential trade (without executing).
 */
export function quoteTrade(
  marketId: string,
  side: 'YES' | 'NO',
  action: TradeAction,
  amount: number
): TradeQuote | null {
  const market = getMarket(marketId);
  if (!market || market.status !== 'OPEN') {
    return null;
  }

  const feeBps = market.fee_bps ?? DEFAULT_FEE_BPS;

  if (action === 'BUY') {
    return getBuyQuote(market.q_yes, market.q_no, market.liquidity_b, amount, side, feeBps);
  } else {
    return getSellQuote(market.q_yes, market.q_no, market.liquidity_b, amount, side, feeBps);
  }
}

/**
 * Execute a buy trade.
 */
async function executeBuy(
  market: Market,
  wallet: string,
  side: 'YES' | 'NO',
  kasAmount: number,
  maxSlippage: number,
  txid?: string
): Promise<TradeResult> {
  // For non-custodial trades, we trust the txid (in production, verify on-chain)
  const isNonCustodial = !!txid;

  // Validate balance (skip for non-custodial trades)
  let balance = getBalance(wallet);
  if (!isNonCustodial) {
    if (!balance || balance.balance_kas < kasAmount) {
      return {
        success: false,
        error: `Insufficient balance. Have: ${balance?.balance_kas.toFixed(2) || 0} KAS, need: ${kasAmount} KAS`
      };
    }
  } else {
    // For non-custodial, create balance record if doesn't exist
    if (!balance) {
      balance = {
        wallet,
        balance_kas: 0,
        deposited_kas: 0,
        withdrawn_kas: 0
      };
    }
    console.log(`[Trade] Non-custodial BUY: ${kasAmount} KAS from ${wallet}, txid: ${txid}`);
  }

  // Get quote
  const feeBps = market.fee_bps ?? DEFAULT_FEE_BPS;
  const quote = getBuyQuote(market.q_yes, market.q_no, market.liquidity_b, kasAmount, side, feeBps);

  // Check slippage
  if (Math.abs(quote.priceImpact) > maxSlippage) {
    return {
      success: false,
      error: `Price impact ${(quote.priceImpact * 100).toFixed(2)}% exceeds max slippage ${(maxSlippage * 100).toFixed(2)}%`
    };
  }

  // Deduct balance (only for custodial trades)
  if (!isNonCustodial) {
    balance.balance_kas -= kasAmount;
  }
  upsertBalance(balance);

  // Update market state
  const newQYes = side === 'YES' ? market.q_yes + quote.shares : market.q_yes;
  const newQNo = side === 'NO' ? market.q_no + quote.shares : market.q_no;

  updateMarket(market.id, {
    q_yes: newQYes,
    q_no: newQNo,
    volume: market.volume + kasAmount,
    trades_count: (market.trades_count || 0) + 1
  });

  // Record price point for chart
  addPricePoint(market.id, quote.priceAfter);

  // Update position
  let position = getPosition(wallet, market.id);
  if (!position) {
    position = {
      user_wallet: wallet,
      market_id: market.id,
      yes_shares: 0,
      no_shares: 0,
      total_cost: 0
    };
  }

  if (side === 'YES') {
    position.yes_shares += quote.shares;
  } else {
    position.no_shares += quote.shares;
  }
  position.total_cost += kasAmount;
  upsertPosition(position);

  // Record trade
  const tradeSide: TradeSide = side === 'YES' ? 'BUY_YES' : 'BUY_NO';
  const trade = createTrade(wallet, market.id, tradeSide, quote.shares, kasAmount, quote.avgPrice);
  addTrade(trade);

  // Mint KRC20 tokens
  let tokenMinted: TradeResult['tokenMinted'] = undefined;
  const tokenTicker = side === 'YES' ? market.yes_token_ticker : market.no_token_ticker;
  if (tokenTicker) {
    const mintResult = await mint(tokenTicker, wallet, quote.shares, trade.id);
    if (mintResult.success) {
      tokenMinted = {
        ticker: tokenTicker,
        amount: quote.shares,
        txid: mintResult.txid
      };
    } else {
      // Mint failed - rollback the trade state changes
      console.error(`[Trade] Mint failed, rolling back trade: ${mintResult.error}`);

      // Rollback balance (refund the KAS)
      if (!isNonCustodial) {
        balance.balance_kas += kasAmount;
        upsertBalance(balance);
      }

      // Rollback market state
      updateMarket(market.id, {
        q_yes: market.q_yes,
        q_no: market.q_no,
        volume: market.volume,
        trades_count: market.trades_count || 0
      });

      // Rollback position
      if (side === 'YES') {
        position.yes_shares -= quote.shares;
      } else {
        position.no_shares -= quote.shares;
      }
      position.total_cost -= kasAmount;
      upsertPosition(position);

      return {
        success: false,
        error: `Mint failed: ${mintResult.error}`
      };
    }
  }

  return {
    success: true,
    trade,
    quote,
    newPosition: position,
    newBalance: balance.balance_kas,
    marketSnapshot: {
      priceYes: quote.priceAfter,
      priceNo: 1 - quote.priceAfter,
      qYes: newQYes,
      qNo: newQNo
    },
    tokenMinted
  };
}

/**
 * Execute a sell trade.
 */
async function executeSell(
  market: Market,
  wallet: string,
  side: 'YES' | 'NO',
  sharesAmount: number,
  maxSlippage: number
): Promise<TradeResult> {
  // Validate position
  const position = getPosition(wallet, market.id);
  const availableShares = side === 'YES' ? (position?.yes_shares || 0) : (position?.no_shares || 0);

  if (sharesAmount > availableShares) {
    return {
      success: false,
      error: `Insufficient shares. Have: ${availableShares.toFixed(4)}, want to sell: ${sharesAmount}`
    };
  }

  // Get quote
  const feeBps = market.fee_bps ?? DEFAULT_FEE_BPS;
  const quote = getSellQuote(market.q_yes, market.q_no, market.liquidity_b, sharesAmount, side, feeBps);

  // Check slippage
  if (Math.abs(quote.priceImpact) > maxSlippage) {
    return {
      success: false,
      error: `Price impact ${(quote.priceImpact * 100).toFixed(2)}% exceeds max slippage ${(maxSlippage * 100).toFixed(2)}%`
    };
  }

  // Credit balance
  let balance = getBalance(wallet);
  if (!balance) {
    balance = {
      wallet,
      balance_kas: 0,
      deposited_kas: 0,
      withdrawn_kas: 0
    };
  }
  balance.balance_kas += quote.kasAmount;
  upsertBalance(balance);

  // Update market state (shares decrease)
  const newQYes = side === 'YES' ? market.q_yes - sharesAmount : market.q_yes;
  const newQNo = side === 'NO' ? market.q_no - sharesAmount : market.q_no;

  updateMarket(market.id, {
    q_yes: Math.max(0, newQYes),
    q_no: Math.max(0, newQNo),
    volume: market.volume + quote.kasAmount + quote.fee,
    trades_count: (market.trades_count || 0) + 1
  });

  // Record price point
  addPricePoint(market.id, quote.priceAfter);

  // Update position
  if (side === 'YES') {
    position!.yes_shares -= sharesAmount;
  } else {
    position!.no_shares -= sharesAmount;
  }
  upsertPosition(position!);

  // Record trade
  const tradeSide: TradeSide = side === 'YES' ? 'SELL_YES' : 'SELL_NO';
  const trade = createTrade(wallet, market.id, tradeSide, sharesAmount, quote.kasAmount, quote.avgPrice);
  addTrade(trade);

  // Burn KRC20 tokens
  let tokenBurned: TradeResult['tokenBurned'] = undefined;
  const tokenTicker = side === 'YES' ? market.yes_token_ticker : market.no_token_ticker;
  if (tokenTicker) {
    const burnResult = await burn(tokenTicker, wallet, sharesAmount, trade.id);
    if (burnResult.success) {
      tokenBurned = {
        ticker: tokenTicker,
        amount: sharesAmount,
        txid: burnResult.txid
      };
    }
  }

  return {
    success: true,
    trade,
    quote,
    newPosition: position!,
    newBalance: balance.balance_kas,
    marketSnapshot: {
      priceYes: quote.priceAfter,
      priceNo: 1 - quote.priceAfter,
      qYes: Math.max(0, newQYes),
      qNo: Math.max(0, newQNo)
    },
    tokenBurned
  };
}

/**
 * Execute a trade (buy or sell).
 */
export async function executeTrade(request: TradeRequest): Promise<TradeResult> {
  const { wallet, marketId, side, action, kasAmount, sharesAmount, maxSlippage = 0.1, txid } = request;

  // Validate market
  const market = getMarket(marketId);
  if (!market) {
    return { success: false, error: 'Market not found' };
  }
  if (market.status !== 'OPEN') {
    return { success: false, error: 'Market is not open for trading' };
  }

  if (action === 'BUY') {
    if (!kasAmount || kasAmount <= 0) {
      return { success: false, error: 'kasAmount is required for BUY' };
    }
    return await executeBuy(market, wallet, side, kasAmount, maxSlippage, txid);
  } else {
    if (!sharesAmount || sharesAmount <= 0) {
      return { success: false, error: 'sharesAmount is required for SELL' };
    }
    return await executeSell(market, wallet, side, sharesAmount, maxSlippage);
  }
}

/**
 * Calculate user's potential payout if market resolves to a given outcome.
 */
export function calculatePayout(
  position: Position,
  outcome: 'YES' | 'NO'
): number {
  return outcome === 'YES' ? position.yes_shares : position.no_shares;
}

/**
 * Calculate user's profit/loss for a resolved market.
 */
export function calculatePnL(
  position: Position,
  outcome: 'YES' | 'NO'
): { payout: number; pnl: number; roi: number } {
  const payout = calculatePayout(position, outcome);
  const pnl = payout - position.total_cost;
  const roi = position.total_cost > 0 ? pnl / position.total_cost : 0;

  return { payout, pnl, roi };
}
