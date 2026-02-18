/**
 * Shared oracle state for API observability.
 * Updated by the main loop, read by the API server.
 */

export interface OracleState {
  network: string;
  last_tick_id: string | null;
  last_updated_at: string | null;
  last_txid: string | null;
  last_hash: string | null;
  providers_ok: number;
  providers_total: number;
  // BTC (anchored on-chain)
  last_price: number | null;
  last_index_status: 'OK' | 'DEGRADED' | 'STALE' | null;
  // ETH and KAS (display only)
  last_eth_price: number | null;
  last_eth_status: 'OK' | 'DEGRADED' | 'STALE' | null;
  last_kas_price: number | null;
  last_kas_status: 'OK' | 'DEGRADED' | 'STALE' | null;
}

// Global singleton state
const state: OracleState = {
  network: 'unknown',
  last_tick_id: null,
  last_updated_at: null,
  last_txid: null,
  last_hash: null,
  providers_ok: 0,
  providers_total: 0,
  last_price: null,
  last_index_status: null,
  last_eth_price: null,
  last_eth_status: null,
  last_kas_price: null,
  last_kas_status: null
};

export function getOracleState(): OracleState {
  return { ...state };
}

export function updateOracleState(updates: Partial<OracleState>): void {
  Object.assign(state, updates);
}
