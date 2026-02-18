import { fetchCoinGecko } from './coingecko.js';
import { fetchCoinMarketCap, initCMC } from './coinmarketcap.js';
import { Config, ProviderResponse } from '../types.js';

let initialized = false;

export function initCollector(config: Config): void {
  if (config.providers.coinmarketcap.enabled) {
    try {
      initCMC(config.providers.coinmarketcap.apiKeyEnvVars);
    } catch (e) {
      console.warn('CoinMarketCap initialization failed:', e);
    }
  }
  initialized = true;
}

/**
 * Fetch BTC, ETH and KAS from all enabled providers in parallel.
 * Returns a flat array of ProviderResponse (one per asset per provider).
 */
export async function fetchAllPrices(config: Config): Promise<ProviderResponse[]> {
  if (!initialized) {
    throw new Error('Collector not initialized. Call initCollector() first.');
  }

  const promises: Promise<ProviderResponse[]>[] = [];

  if (config.providers.coingecko.enabled) {
    promises.push(fetchCoinGecko());
  }
  if (config.providers.coinmarketcap.enabled) {
    promises.push(fetchCoinMarketCap());
  }

  const results = await Promise.all(promises);
  return results.flat();
}

export { fetchCoinGecko } from './coingecko.js';
export { fetchCoinMarketCap, initCMC } from './coinmarketcap.js';
