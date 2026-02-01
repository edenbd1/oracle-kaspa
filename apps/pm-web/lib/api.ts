import type {
  EventsResponse,
  EventDetailResponse,
  MarketDetailResponse,
  WalletResponse,
  Quote,
  TradeResult,
  TradeSide,
  TradeAction,
  RedeemResult,
} from './types';

const API_BASE = '/api/pm';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return data as T;
}

export async function fetchEvents(): Promise<EventsResponse> {
  return fetchJson<EventsResponse>(`${API_BASE}/events`);
}

export async function fetchEvent(eventId: string): Promise<EventDetailResponse> {
  return fetchJson<EventDetailResponse>(`${API_BASE}/event/${eventId}`);
}

export async function fetchMarket(marketId: string): Promise<MarketDetailResponse> {
  return fetchJson<MarketDetailResponse>(`${API_BASE}/market/${marketId}`);
}

export async function fetchWallet(address: string): Promise<WalletResponse> {
  return fetchJson<WalletResponse>(`${API_BASE}/wallet/${encodeURIComponent(address)}`);
}

export async function fetchQuote(
  marketId: string,
  side: TradeSide,
  action: TradeAction,
  amount: number
): Promise<{ quote: Quote }> {
  const params = new URLSearchParams({
    marketId,
    side,
    action,
    ...(action === 'BUY' ? { kasAmount: String(amount) } : { sharesAmount: String(amount) }),
  });

  return fetchJson<{ quote: Quote }>(`${API_BASE}/quote?${params}`);
}

export async function executeTrade(params: {
  marketId: string;
  address: string;
  side: TradeSide;
  action: TradeAction;
  kasAmount?: number;
  sharesAmount?: number;
  txid?: string; // For non-custodial trades
  maxSlippage?: number; // Max acceptable price impact as fraction (0.05 = 5%)
}): Promise<TradeResult> {
  console.log('[API] executeTrade params:', params);
  return fetchJson<TradeResult>(`${API_BASE}/trade`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function deposit(wallet: string, amount: number): Promise<{ balance: { balance_kas: number } }> {
  return fetchJson<{ balance: { balance_kas: number } }>(`${API_BASE}/deposit`, {
    method: 'POST',
    body: JSON.stringify({ wallet, amount }),
  });
}

export async function redeemTokens(address: string, ticker: string, amount?: number): Promise<RedeemResult> {
  return fetchJson<RedeemResult>(`${API_BASE}/redeem`, {
    method: 'POST',
    body: JSON.stringify({ address, ticker, amount }),
  });
}

export async function syncOracle(): Promise<{ success: boolean; resolved?: number }> {
  return fetchJson<{ success: boolean; resolved?: number }>(`${API_BASE}/sync`, {
    method: 'POST',
  });
}
