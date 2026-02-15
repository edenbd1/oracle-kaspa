export type MarketStatus = 'OPEN' | 'RESOLVED';
export type MarketOutcome = 'YES' | 'NO' | null;
export type TradeSide = 'YES' | 'NO';
export type TradeAction = 'BUY' | 'SELL';

export interface Event {
  id: string;
  title: string;
  description: string;
  asset: string;
  deadline: number;
  created_at: number;
  market_count?: number;
  open_count?: number;
  deadline_iso?: string;
  time_remaining_ms?: number;
}

export interface Market {
  id: string;
  event_id: string;
  asset?: string;
  threshold_price: number;
  direction: '>=' | '<=';
  status: MarketStatus;
  resolved_outcome: MarketOutcome;
  resolved_at: number | null;
  resolved_txid: string | null;
  resolved_price: number | null;
  resolved_hash: string | null;
  liquidity_b: number;
  fee_bps: number;
  q_yes: number;
  q_no: number;
  volume: number;
  trades_count: number;
  created_at: number;
  yes_token_ticker: string | null;
  no_token_ticker: string | null;
  tokens_deployed_at: number | null;
  label?: string;
  price_yes?: number;
  price_no?: number;
  implied_probability?: number;
  price_history?: PricePoint[];
}

export interface PricePoint {
  timestamp: number;
  price_yes: number;
  price_no: number;
}

export interface Trade {
  id: string;
  user_wallet: string;
  market_id: string;
  side: string;
  amount_tokens: number;
  cost_kas: number;
  price: number;
  created_at: number;
}

export interface Position {
  user_wallet: string;
  market_id: string;
  yes_shares: number;
  no_shares: number;
  total_cost: number;
  market_label?: string;
  market_status?: MarketStatus;
  market_resolved_outcome?: MarketOutcome;
  current_price_yes?: number;
  current_price_no?: number;
  value_yes?: number;
  value_no?: number;
  potential_payout_yes?: number;
  potential_payout_no?: number;
  yes_token_ticker?: string | null;
  no_token_ticker?: string | null;
}

export interface UserBalance {
  wallet: string;
  balance_kas: number;
  deposited_kas: number;
}

export interface Quote {
  action: TradeAction;
  side: TradeSide;
  shares: number;
  kasAmount: number;
  avgPrice: number;
  fee: number;
  priceImpact: number;
  priceBefore: number;
  priceAfter: number;
}

export interface TradeResult {
  ok: boolean;
  error?: string;
  trade?: Trade;
  new_prices?: { yes: number; no: number };
  sharesFilled?: number;
  kasSpent?: number;
  kasReceived?: number;
  feePaid?: number;
  newBalance?: number;
  tokenMinted?: { ticker: string; amount: number; txid?: string };
  tokenBurned?: { ticker: string; amount: number; txid?: string };
  txid?: string; // On-chain transaction ID for non-custodial trades
}

export interface NonCustodialTradeParams {
  marketId: string;
  address: string;
  side: TradeSide;
  action: TradeAction;
  kasAmount?: number;
  sharesAmount?: number;
  txid: string; // Transaction ID from wallet
}

export interface EventsResponse {
  events: Event[];
  oracle_price: number;
  oracle_prices?: Record<string, number>;
  oracle_txid: string | null;
  oracle_synced_at: number | null;
}

export interface EventDetailResponse {
  event: Event;
  markets: Market[];
  oracle_price: number;
  oracle_prices?: Record<string, number>;
  oracle_txid: string | null;
  oracle_hash: string | null;
  oracle_synced_at: number | null;
}

export interface MarketDetailResponse {
  market: Market;
  event: Event;
  price_history: PricePoint[];
  recent_trades: Trade[];
}

export interface WalletResponse {
  wallet: string;
  balance_kas: number;
  deposited_kas: number;
  positions: Position[];
}

export interface RedeemResult {
  ok: boolean;
  ticker?: string;
  amount_redeemed?: number;
  kas_received?: number;
  txid?: string;
  error?: string;
}
