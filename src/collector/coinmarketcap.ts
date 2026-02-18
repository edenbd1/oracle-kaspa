import { ProviderResponse } from '../types.js';

interface CMCQuote {
  quote?: { USD?: { price?: number } };
}

interface CMCResponse {
  status?: {
    error_code?: number;
    error_message?: string;
  };
  data?: {
    BTC?: CMCQuote;
    ETH?: CMCQuote;
    KAS?: CMCQuote;
  };
}

const REQUEST_TIMEOUT_MS = 10_000;

class CMCKeyManager {
  private keys: string[];
  private keyIndices: Map<string, number>;
  private currentIndex = 0;
  private cooldownUntil: Map<string, number> = new Map();
  private cooldownMs = 60_000;

  constructor(envVars: string[]) {
    this.keys = [];
    this.keyIndices = new Map();

    envVars.forEach((envVar, idx) => {
      const key = process.env[envVar];
      if (key) {
        this.keys.push(key);
        this.keyIndices.set(key, idx + 1);
      }
    });

    if (this.keys.length === 0) {
      throw new Error('No CMC API keys configured');
    }

    console.log(`[CMC] Initialized with ${this.keys.length} API key(s)`);
  }

  getAvailableKeys(): Array<{ key: string; index: number }> {
    const now = Date.now();
    const available: Array<{ key: string; index: number }> = [];

    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.currentIndex + i) % this.keys.length;
      const key = this.keys[idx];
      if (now >= (this.cooldownUntil.get(key) || 0)) {
        available.push({ key, index: this.keyIndices.get(key)! });
      }
    }

    if (available.length > 0) {
      const firstKeyIdx = this.keys.indexOf(available[0].key);
      this.currentIndex = (firstKeyIdx + 1) % this.keys.length;
    }

    return available;
  }

  markCooldown(key: string, reason: string): void {
    const keyIndex = this.keyIndices.get(key);
    this.cooldownUntil.set(key, Date.now() + this.cooldownMs);
    console.warn(`[CMC] Key #${keyIndex} placed in cooldown for 60s: ${reason}`);
  }
}

let keyManager: CMCKeyManager | null = null;

export function initCMC(envVars: string[]): void {
  keyManager = new CMCKeyManager(envVars);
}

async function attemptFetch(
  apiKey: string,
  keyIndex: number
): Promise<{ btc: number; eth: number | null; kas: number | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    console.log(`[CMC] Fetching with key #${keyIndex}`);

    const res = await fetch(
      'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC,ETH,KAS&convert=USD',
      {
        headers: { 'X-CMC_PRO_API_KEY': apiKey },
        signal: controller.signal
      }
    );

    if (res.status === 429) throw new Error('RATE_LIMIT:429');
    if (!res.ok) throw new Error(`HTTP_ERROR:${res.status}`);

    const data = await res.json() as CMCResponse;

    if (data.status?.error_code && data.status.error_code !== 0) {
      throw new Error(`API_ERROR:${data.status.error_code}:${data.status.error_message || 'Unknown'}`);
    }

    const btc = data.data?.BTC?.quote?.USD?.price;
    if (btc === undefined || btc === null) {
      throw new Error('PARSE_ERROR:Missing BTC price in response');
    }

    return {
      btc,
      eth: data.data?.ETH?.quote?.USD?.price ?? null,
      kas: data.data?.KAS?.quote?.USD?.price ?? null
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch BTC, ETH and KAS prices from CoinMarketCap in a single request.
 * Returns one ProviderResponse per asset.
 */
export async function fetchCoinMarketCap(): Promise<ProviderResponse[]> {
  const timestamp_local = Date.now();

  const failAll = (error: string): ProviderResponse[] => [
    { provider: 'coinmarketcap', asset: 'BTC', price: null, timestamp_local, ok: false, error },
    { provider: 'coinmarketcap', asset: 'ETH', price: null, timestamp_local, ok: false, error },
    { provider: 'coinmarketcap', asset: 'KAS', price: null, timestamp_local, ok: false, error }
  ];

  if (!keyManager) return failAll('Not initialized');

  const availableKeys = keyManager.getAvailableKeys();

  if (availableKeys.length === 0) {
    console.warn('[CMC] All keys in cooldown, skipping this tick');
    return failAll('All keys in cooldown');
  }

  const errors: string[] = [];

  for (const { key, index } of availableKeys) {
    try {
      const result = await attemptFetch(key, index);
      console.log(`[CMC] Success with key #${index}, BTC: ${result.btc}`);

      return [
        {
          provider: 'coinmarketcap',
          asset: 'BTC',
          price: result.btc,
          timestamp_local,
          ok: true,
          error: null
        },
        {
          provider: 'coinmarketcap',
          asset: 'ETH',
          price: result.eth,
          timestamp_local,
          ok: result.eth !== null,
          error: result.eth !== null ? null : 'Missing ETH price'
        },
        {
          provider: 'coinmarketcap',
          asset: 'KAS',
          price: result.kas,
          timestamp_local,
          ok: result.kas !== null,
          error: result.kas !== null ? null : 'Missing KAS price'
        }
      ];
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      errors.push(`key#${index}:${errorMsg}`);

      if (errorMsg.startsWith('RATE_LIMIT:')) {
        keyManager.markCooldown(key, 'rate limited (429)');
      } else if (errorMsg.startsWith('HTTP_ERROR:')) {
        keyManager.markCooldown(key, errorMsg);
      } else if (errorMsg.startsWith('API_ERROR:')) {
        keyManager.markCooldown(key, errorMsg);
      }

      console.warn(`[CMC] Key #${index} failed: ${errorMsg}, trying next key...`);
    }
  }

  console.warn(`[CMC] All ${availableKeys.length} key(s) failed this tick.`);
  console.warn(`[CMC] Errors: ${errors.join('; ')}`);

  return failAll(`All keys failed: ${errors.join('; ')}`);
}
