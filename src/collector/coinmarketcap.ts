import { ProviderResponse } from '../types.js';

interface CMCResponse {
  data?: {
    BTC?: {
      quote?: {
        USD?: {
          price?: number;
        };
      };
    };
  };
}

class CMCKeyManager {
  private keys: string[];
  private currentIndex = 0;
  private cooldownUntil: Map<string, number> = new Map();
  private cooldownMs = 60_000; // 1 minute cooldown on 429

  constructor(envVars: string[]) {
    this.keys = envVars
      .map(v => process.env[v])
      .filter((k): k is string => !!k);
    if (this.keys.length === 0) {
      throw new Error('No CMC API keys configured');
    }
  }

  getKey(): string | null {
    const now = Date.now();
    // Try each key, skipping those in cooldown
    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.currentIndex + i) % this.keys.length;
      const key = this.keys[idx];
      const cooldown = this.cooldownUntil.get(key) || 0;
      if (now >= cooldown) {
        this.currentIndex = (idx + 1) % this.keys.length; // round-robin
        return key;
      }
    }
    return null; // All keys in cooldown
  }

  markRateLimited(key: string): void {
    this.cooldownUntil.set(key, Date.now() + this.cooldownMs);
  }
}

let keyManager: CMCKeyManager | null = null;

export function initCMC(envVars: string[]): void {
  keyManager = new CMCKeyManager(envVars);
}

export async function fetchCoinMarketCap(): Promise<ProviderResponse> {
  const timestamp_local = Date.now();
  if (!keyManager) {
    return { provider: 'coinmarketcap', price: null, timestamp_local, ok: false, error: 'Not initialized' };
  }

  const apiKey = keyManager.getKey();
  if (!apiKey) {
    return { provider: 'coinmarketcap', price: null, timestamp_local, ok: false, error: 'All keys rate-limited' };
  }

  try {
    const res = await fetch(
      'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC&convert=USD',
      { headers: { 'X-CMC_PRO_API_KEY': apiKey } }
    );
    if (res.status === 429) {
      keyManager.markRateLimited(apiKey);
      return { provider: 'coinmarketcap', price: null, timestamp_local, ok: false, error: 'Rate limited (429)' };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json() as CMCResponse;
    return {
      provider: 'coinmarketcap',
      price: data.data?.BTC?.quote?.USD?.price ?? null,
      timestamp_local,
      ok: true,
      error: null
    };
  } catch (e) {
    return { provider: 'coinmarketcap', price: null, timestamp_local, ok: false, error: String(e) };
  }
}
