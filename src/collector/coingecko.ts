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
