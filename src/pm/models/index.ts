/**
 * Prediction Market Data Models
 */

export type MarketStatus = 'OPEN' | 'RESOLVED';
export type MarketOutcome = 'YES' | 'NO' | null;
export type TradeSide = 'BUY_YES' | 'BUY_NO' | 'SELL_YES' | 'SELL_NO';

/**
 * Event - A collection of related markets
 * Example: "What price will BTC hit before Feb 1, 2026?"
 */
export interface Event {
  id: string;
  title: string;
  description: string;
  asset: string; // e.g., 'BTC'
  deadline: number; // Unix timestamp (ms)
  created_at: number;
}

/**
 * Market - A single binary prediction
 * Example: "BTC >= 100,000"
 */
export interface Market {
  id: string;
  event_id: string;
  threshold_price: number;
  direction: '>=' | '<=';
  status: MarketStatus;
  resolved_outcome: MarketOutcome;
  resolved_at: number | null;
  resolved_txid: string | null;
  resolved_price: number | null;
  resolved_hash: string | null;
  liquidity_b: number; // LMSR liquidity parameter
  fee_bps: number; // Fee in basis points (100 = 1%)
  q_yes: number; // Outstanding YES shares
  q_no: number; // Outstanding NO shares
  volume: number; // Total KAS traded
  trades_count: number; // Number of trades
  created_at: number;
  // KRC20 Token fields
  yes_token_ticker: string | null; // e.g., "YES_BTC_100000"
  no_token_ticker: string | null;  // e.g., "NO_BTC_100000"
  tokens_deployed_at: number | null;
}

/**
 * Trade - A single buy transaction
 */
export interface Trade {
  id: string;
  user_wallet: string;
  market_id: string;
  side: TradeSide;
  amount_tokens: number;
  cost_kas: number;
  price: number; // Average price paid
  created_at: number;
}

/**
 * Position - User's holdings in a market
 */
export interface Position {
  user_wallet: string;
  market_id: string;
  yes_shares: number;
  no_shares: number;
  total_cost: number; // Total KAS spent
}

/**
 * User balance (custodial for hackathon)
 */
export interface UserBalance {
  wallet: string;
  balance_kas: number; // Available KAS
  deposited_kas: number; // Total deposited
  withdrawn_kas: number; // Total withdrawn
}

/**
 * Create a new event
 */
export function createEvent(
  title: string,
  description: string,
  asset: string,
  deadline: number
): Event {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    description,
    asset,
    deadline,
    created_at: Date.now()
  };
}

/**
 * Create a new market for an event
 *
 * Token tickers use the 6-char format with month: Y{ASSET}{MONTH}{INDEX}
 * Example: YBTCCA = YES BTC, March (C), market A
 *
 * @param eventId - Parent event ID
 * @param thresholdPrice - Price threshold for the market
 * @param direction - '>=' or '<='
 * @param liquidityB - LMSR liquidity parameter
 * @param feeBps - Fee in basis points
 * @param asset - Asset code (BTC, ETH, KAS)
 * @param marketIndex - Market index letter (A, B, C...)
 * @param eventDeadline - Event deadline timestamp (used to derive month letter)
 */
export function createMarket(
  eventId: string,
  thresholdPrice: number,
  direction: '>=' | '<=',
  liquidityB: number = 5000, // Default liquidity
  feeBps: number = 100, // Default 1% fee
  asset: string = 'BTC', // Asset for token ticker generation
  marketIndex: string = 'A', // Market index (A, B, C...)
  eventDeadline?: number // Event deadline for month letter derivation
): Market {
  // Generate KRC-20 compliant token tickers (6 uppercase letters)
  // Format: {Y|N}{ASSET}{MONTH}{INDEX} e.g., YBTCCA
  const assetCode = asset.toUpperCase().slice(0, 3);
  const indexChar = marketIndex.toUpperCase().slice(0, 1);

  // Derive month letter from event deadline (A=Jan, B=Feb, ..., L=Dec)
  const eventDate = eventDeadline ? new Date(eventDeadline) : new Date();
  const monthLetter = String.fromCharCode(65 + eventDate.getMonth()); // 0-11 → A-L

  const yesTicker = `Y${assetCode}${monthLetter}${indexChar}`; // e.g., YBTCCA
  const noTicker = `N${assetCode}${monthLetter}${indexChar}`;   // e.g., NBTCCA

  return {
    id: `mkt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    event_id: eventId,
    threshold_price: thresholdPrice,
    direction,
    status: 'OPEN',
    resolved_outcome: null,
    resolved_at: null,
    resolved_txid: null,
    resolved_price: null,
    resolved_hash: null,
    liquidity_b: liquidityB,
    fee_bps: feeBps,
    q_yes: 0,
    q_no: 0,
    volume: 0,
    trades_count: 0,
    created_at: Date.now(),
    yes_token_ticker: yesTicker,
    no_token_ticker: noTicker,
    tokens_deployed_at: Date.now()
  };
}

/**
 * Create a trade record
 */
export function createTrade(
  userWallet: string,
  marketId: string,
  side: TradeSide,
  amountTokens: number,
  costKas: number,
  price: number
): Trade {
  return {
    id: `trd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    user_wallet: userWallet,
    market_id: marketId,
    side,
    amount_tokens: amountTokens,
    cost_kas: costKas,
    price,
    created_at: Date.now()
  };
}

/**
 * Format market label
 */
export function formatMarketLabel(market: Market): string {
  const dir = market.direction === '>=' ? '≥' : '≤';
  return `BTC ${dir} $${market.threshold_price.toLocaleString()}`;
}
