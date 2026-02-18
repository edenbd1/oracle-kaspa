import { ProviderResponse } from '../types.js';

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,kaspa&vs_currencies=usd';

/**
 * Fetch BTC, ETH and KAS prices from CoinGecko in a single request.
 * Returns one ProviderResponse per asset.
 */
export async function fetchCoinGecko(): Promise<ProviderResponse[]> {
  const timestamp_local = Date.now();

  try {
    const res = await fetch(COINGECKO_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as {
      bitcoin?: { usd?: number };
      ethereum?: { usd?: number };
      kaspa?: { usd?: number };
    };

    return [
      {
        provider: 'coingecko',
        asset: 'BTC',
        price: data.bitcoin?.usd ?? null,
        timestamp_local,
        ok: data.bitcoin?.usd != null,
        error: data.bitcoin?.usd != null ? null : 'Missing BTC price'
      },
      {
        provider: 'coingecko',
        asset: 'ETH',
        price: data.ethereum?.usd ?? null,
        timestamp_local,
        ok: data.ethereum?.usd != null,
        error: data.ethereum?.usd != null ? null : 'Missing ETH price'
      },
      {
        provider: 'coingecko',
        asset: 'KAS',
        price: data.kaspa?.usd ?? null,
        timestamp_local,
        ok: data.kaspa?.usd != null,
        error: data.kaspa?.usd != null ? null : 'Missing KAS price'
      }
    ];
  } catch (e) {
    const error = String(e);
    return [
      { provider: 'coingecko', asset: 'BTC', price: null, timestamp_local, ok: false, error },
      { provider: 'coingecko', asset: 'ETH', price: null, timestamp_local, ok: false, error },
      { provider: 'coingecko', asset: 'KAS', price: null, timestamp_local, ok: false, error }
    ];
  }
}
