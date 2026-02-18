import { ProviderResponse } from '../types.js';

export async function fetchCoinGecko(): Promise<ProviderResponse> {
  const timestamp_local = Date.now();
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as { bitcoin?: { usd?: number } };
    return {
      provider: 'coingecko',
      price: data.bitcoin?.usd ?? null,
      timestamp_local,
      ok: true,
      error: null
    };
  } catch (e) {
    return { provider: 'coingecko', price: null, timestamp_local, ok: false, error: String(e) };
  }
}

export interface DisplayPrices {
  eth: number | null;
  kas: number | null;
}

/**
 * Fetch ETH and KAS prices from CoinGecko for log display only.
 * Not used in the oracle bundle or anchor payload.
 */
export async function fetchDisplayPrices(): Promise<DisplayPrices> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,kaspa&vs_currencies=usd'
    );
    if (!res.ok) return { eth: null, kas: null };
    const data = await res.json() as {
      ethereum?: { usd?: number };
      kaspa?: { usd?: number };
    };
    return {
      eth: data.ethereum?.usd ?? null,
      kas: data.kaspa?.usd ?? null
    };
  } catch {
    return { eth: null, kas: null };
  }
}
