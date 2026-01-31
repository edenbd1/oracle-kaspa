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
  last_price: number | null;
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
  last_price: null
};

export function getOracleState(): OracleState {
  return { ...state };
}

export function updateOracleState(updates: Partial<OracleState>): void {
  Object.assign(state, updates);
}
