import { ProviderResponse } from '../types.js';

interface CMCResponse {
  status?: {
    error_code?: number;
    error_message?: string;
  };
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

const REQUEST_TIMEOUT_MS = 10_000; // 10 second timeout per request

class CMCKeyManager {
  private keys: string[];
  private keyIndices: Map<string, number>; // key -> original index for logging
  private currentIndex = 0;
  private cooldownUntil: Map<string, number> = new Map();
  private cooldownMs = 60_000; // 1 minute cooldown on rate limit

  constructor(envVars: string[]) {
    this.keys = [];
    this.keyIndices = new Map();

    envVars.forEach((envVar, idx) => {
      const key = process.env[envVar];
      if (key) {
        this.keys.push(key);
        this.keyIndices.set(key, idx + 1); // 1-indexed for logging
      }
    });

    if (this.keys.length === 0) {
      throw new Error('No CMC API keys configured');
    }

    console.log(`[CMC] Initialized with ${this.keys.length} API key(s)`);
  }

  getKeyCount(): number {
    return this.keys.length;
  }

  getKeyIndex(key: string): number {
    return this.keyIndices.get(key) ?? 0;
  }

  /**
   * Get the next available key, respecting cooldowns and round-robin rotation.
   * Returns null if all keys are in cooldown.
   */
  getNextKey(): { key: string; index: number } | null {
    const now = Date.now();

    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.currentIndex + i) % this.keys.length;
      const key = this.keys[idx];
      const cooldown = this.cooldownUntil.get(key) || 0;

      if (now >= cooldown) {
        this.currentIndex = (idx + 1) % this.keys.length; // advance for next call
        return { key, index: this.keyIndices.get(key)! };
      }
    }

    return null; // All keys in cooldown
  }

  /**
   * Get all keys that are not in cooldown, starting from current rotation position.
   * Used for failover attempts.
   */
  getAvailableKeys(): Array<{ key: string; index: number }> {
    const now = Date.now();
    const available: Array<{ key: string; index: number }> = [];

    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.currentIndex + i) % this.keys.length;
      const key = this.keys[idx];
      const cooldown = this.cooldownUntil.get(key) || 0;

      if (now >= cooldown) {
        available.push({ key, index: this.keyIndices.get(key)! });
      }
    }

    // Advance rotation for next request cycle
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

/**
 * Attempt a single CMC API request with the given key.
 * Returns the result or throws on any failure.
 */
async function attemptFetch(apiKey: string, keyIndex: number): Promise<{ price: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    console.log(`[CMC] Fetching with key #${keyIndex}`);

    const res = await fetch(
      'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC&convert=USD',
      {
        headers: { 'X-CMC_PRO_API_KEY': apiKey },
        signal: controller.signal
      }
    );

    if (res.status === 429) {
      throw new Error('RATE_LIMIT:429');
    }

    if (!res.ok) {
      throw new Error(`HTTP_ERROR:${res.status}`);
    }

    const data = await res.json() as CMCResponse;

    // Check for API-level errors
    if (data.status?.error_code && data.status.error_code !== 0) {
      throw new Error(`API_ERROR:${data.status.error_code}:${data.status.error_message || 'Unknown'}`);
    }

    const price = data.data?.BTC?.quote?.USD?.price;
    if (price === undefined || price === null) {
      throw new Error('PARSE_ERROR:Missing price in response');
    }

    return { price };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchCoinMarketCap(): Promise<ProviderResponse> {
  const timestamp_local = Date.now();

  if (!keyManager) {
    return {
      provider: 'coinmarketcap',
      price: null,
      timestamp_local,
      ok: false,
      error: 'Not initialized'
    };
  }

  const availableKeys = keyManager.getAvailableKeys();

  if (availableKeys.length === 0) {
    console.warn('[CMC] All keys in cooldown, skipping this tick');
    return {
      provider: 'coinmarketcap',
      price: null,
      timestamp_local,
      ok: false,
      error: 'All keys in cooldown'
    };
  }

  const errors: string[] = [];

  // Try each available key with automatic failover
  for (const { key, index } of availableKeys) {
    try {
      const result = await attemptFetch(key, index);
      console.log(`[CMC] Success with key #${index}, price: ${result.price}`);
      return {
        provider: 'coinmarketcap',
        price: result.price,
        timestamp_local,
        ok: true,
        error: null
      };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      errors.push(`key#${index}:${errorMsg}`);

      // Determine if this key should be put in cooldown
      if (errorMsg.startsWith('RATE_LIMIT:')) {
        keyManager.markCooldown(key, 'rate limited (429)');
      } else if (errorMsg.startsWith('HTTP_ERROR:')) {
        // HTTP errors like 401, 403, 500 - cooldown to avoid hammering
        keyManager.markCooldown(key, errorMsg);
      } else if (errorMsg.startsWith('API_ERROR:')) {
        // CMC API returned an error (e.g., invalid key, quota exceeded)
        keyManager.markCooldown(key, errorMsg);
      }
      // Timeouts and parse errors don't trigger cooldown - might be transient

      console.warn(`[CMC] Key #${index} failed: ${errorMsg}, trying next key...`);
    }
  }

  // All keys failed
  console.warn(`[CMC] All ${availableKeys.length} key(s) failed this tick. Falling back to CoinGecko-only.`);
  console.warn(`[CMC] Errors: ${errors.join('; ')}`);

  return {
    provider: 'coinmarketcap',
    price: null,
    timestamp_local,
    ok: false,
    error: `All keys failed: ${errors.join('; ')}`
  };
}
