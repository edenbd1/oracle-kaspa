import { ProviderResponse, IndexOutput, Config } from '../types.js';

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function aggregate(responses: ProviderResponse[], config: Config['aggregation']): IndexOutput {
  // 1. Filter valid responses
  const valid = responses.filter(r => r.ok && r.price !== null);
  const prices = valid.map(r => r.price!);

  // 2. Handle edge cases
  if (prices.length === 0) {
    return {
      asset: 'BTC',
      quote: 'USD',
      price: 0,
      sources_used: [],
      num_sources: 0,
      dispersion: 0,
      timestamp_local: Date.now(),
      status: 'STALE'
    };
  }

  // 3. Calculate initial median
  const initialMedian = median(prices);

  // 4. Outlier filter
  const filtered = valid.filter(r =>
    Math.abs(r.price! - initialMedian) / initialMedian <= config.outlierThresholdRatio
  );
  const filteredPrices = filtered.map(r => r.price!);

  // 5. Final median (or initial if all filtered out)
  const finalMedian = filteredPrices.length > 0 ? median(filteredPrices) : initialMedian;

  // 6. Check quorum
  const status = filtered.length >= config.minValidSources ? 'OK' : 'STALE';

  // 7. Dispersion
  const dispersion = filteredPrices.length > 1
    ? (Math.max(...filteredPrices) - Math.min(...filteredPrices)) / finalMedian
    : 0;

  return {
    asset: 'BTC',
    quote: 'USD',
    price: finalMedian,
    sources_used: filtered.map(r => r.provider),
    num_sources: filtered.length,
    dispersion,
    timestamp_local: Date.now(),
    status
  };
}
