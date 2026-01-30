export interface ProviderResponse {
  provider: 'coingecko' | 'coinmarketcap';
  price: number | null;
  timestamp_local: number;
  ok: boolean;
  error: string | null;
}

export interface IndexOutput {
  asset: string;
  quote: string;
  price: number;
  sources_used: string[];
  num_sources: number;
  dispersion: number;
  timestamp_local: number;
  status: 'OK' | 'STALE';
}

export interface RawBundle {
  tick_id: string;
  network: string;
  collector: { interval: number; jitter: number };
  responses: ProviderResponse[];
  index: IndexOutput;
}

export interface AnchorPayload {
  d: number;      // dispersion
  h: string;      // sha256 hash of bundle (first 16 chars)
  n: number;      // num sources
  p: number;      // price
}

export interface Config {
  network: string;
  addressPrefixExpected: string;
  anchorIntervalSeconds: number;
  jitterSeconds: number;
  rpcUrl: string;
  providers: {
    coingecko: { enabled: boolean; endpoint: string };
    coinmarketcap: { enabled: boolean; endpoint: string; apiKeyEnvVars: string[] };
  };
  aggregation: {
    outlierThresholdRatio: number;
    minValidSources: number;
  };
}
