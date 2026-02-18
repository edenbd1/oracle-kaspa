import { ProviderResponse, IndexOutput, Config } from '../types.js';

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function aggregate(
  responses: ProviderResponse[],
  config: Config['aggregation'],
  asset: 'BTC' | 'ETH' | 'KAS' = 'BTC'
): IndexOutput {
  // 1. Filter valid responses for this asset
  const valid = responses.filter(r => r.asset === asset && r.ok && r.price !== null);
  const prices = valid.map(r => r.price!);

  // 2. Handle 0 valid sources → STALE
  if (prices.length === 0) {
    return {
      asset,
      quote: 'USD',
      price: 0,
      sources_used: [],
      num_sources: 0,
      dispersion: 0,
      timestamp_local: Date.now(),
      status: 'STALE'
    };
  }

  // 3. Initial median
  const initialMedian = median(prices);

  // 4. Outlier filter
  const filtered = valid.filter(r =>
    Math.abs(r.price! - initialMedian) / initialMedian <= config.outlierThresholdRatio
  );
  const filteredPrices = filtered.map(r => r.price!);

  // 5. Final median
  const finalMedian = filteredPrices.length > 0 ? median(filteredPrices) : initialMedian;

  // 6. Quorum check
  const status: 'OK' | 'DEGRADED' | 'STALE' =
    filtered.length >= config.minValidSources ? 'OK' :
    filtered.length >= 1 ? 'DEGRADED' :
    'STALE';

  // 7. Dispersion (0 when single source)
  const dispersion = filteredPrices.length > 1
    ? (Math.max(...filteredPrices) - Math.min(...filteredPrices)) / finalMedian
    : 0;

  const note = status === 'DEGRADED'
    ? `Single-source fallback: ${filtered.map(r => r.provider).join(', ')}`
    : undefined;

  return {
    asset,
    quote: 'USD',
    price: finalMedian,
    sources_used: filtered.map(r => r.provider),
    num_sources: filtered.length,
    dispersion,
    timestamp_local: Date.now(),
    status,
    note
  };
}
