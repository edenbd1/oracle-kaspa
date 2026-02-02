/**
 * Kasplex Indexer API Client
 *
 * Queries the Kasplex indexer for KRC-20 token balances and information.
 * Used when USE_REAL_KRC20=true to get on-chain token data.
 */

import type { TokenBalance, TokenInfo, IndexerResponse } from './types.js';

// Kasplex Indexer API endpoints
const INDEXER_API = process.env.KASPLEX_INDEXER_API || 'https://tn10api.kasplex.org';

/**
 * Get KRC-20 balance for a specific token and address
 */
export async function getKRC20Balance(address: string, ticker: string): Promise<number> {
  try {
    const url = `${INDEXER_API}/v1/krc20/address/${address}/token/${ticker}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn(`[Indexer] Failed to fetch balance for ${ticker}@${address}: ${res.status}`);
      return 0;
    }

    const data = await res.json() as IndexerResponse<{ balance: string }>;

    if (data.message !== 'successful' || !data.result) {
      return 0;
    }

    return parseFloat(data.result[0]?.balance || '0');
  } catch (error) {
    console.error('[Indexer] Error fetching balance:', error);
    return 0;
  }
}

/**
 * Get all KRC-20 token balances for an address
 */
export async function getAllKRC20Balances(address: string): Promise<TokenBalance[]> {
  try {
    const url = `${INDEXER_API}/v1/krc20/address/${address}/tokenlist`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn(`[Indexer] Failed to fetch token list for ${address}: ${res.status}`);
      return [];
    }

    const data = await res.json() as IndexerResponse<TokenBalance>;

    if (data.message !== 'successful' || !data.result) {
      return [];
    }

    return data.result;
  } catch (error) {
    console.error('[Indexer] Error fetching token list:', error);
    return [];
  }
}

/**
 * Get token info by ticker
 */
export async function getTokenInfo(ticker: string): Promise<TokenInfo | null> {
  try {
    const url = `${INDEXER_API}/v1/krc20/token/${ticker}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn(`[Indexer] Failed to fetch token info for ${ticker}: ${res.status}`);
      return null;
    }

    const data = await res.json() as IndexerResponse<TokenInfo>;

    if (data.message !== 'successful' || !data.result || data.result.length === 0) {
      return null;
    }

    return data.result[0];
  } catch (error) {
    console.error('[Indexer] Error fetching token info:', error);
    return null;
  }
}

/**
 * Check if a token is properly deployed on-chain
 * Returns false for tokens with state "unused" (ticker seen but never deployed)
 */
export async function tokenExists(ticker: string): Promise<boolean> {
  const info = await getTokenInfo(ticker);
  if (!info) return false;
  // "unused" state means ticker was referenced (e.g., mint attempted) but never deployed
  // A properly deployed token should have state "deployed" or similar
  if (info.state === 'unused') return false;
  return true;
}

/**
 * Get token total supply from indexer
 */
export async function getTokenSupply(ticker: string): Promise<number> {
  const info = await getTokenInfo(ticker);
  if (!info) return 0;

  // Parse minted supply (already in token units based on decimals)
  return parseFloat(info.minted || '0');
}

/**
 * Wait for a token to appear in the indexer (after deployment)
 * Polls with exponential backoff
 */
export async function waitForToken(
  ticker: string,
  maxAttempts: number = 10,
  initialDelayMs: number = 2000
): Promise<TokenInfo | null> {
  let delay = initialDelayMs;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const info = await getTokenInfo(ticker);
    if (info) {
      console.log(`[Indexer] Token ${ticker} found after ${attempt + 1} attempts`);
      return info;
    }

    console.log(`[Indexer] Waiting for token ${ticker}... attempt ${attempt + 1}/${maxAttempts}`);
    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, 10000); // Cap at 10s
  }

  console.warn(`[Indexer] Token ${ticker} not found after ${maxAttempts} attempts`);
  return null;
}

/**
 * Wait for a balance update after a mint operation
 */
export async function waitForBalance(
  address: string,
  ticker: string,
  expectedMinBalance: number,
  maxAttempts: number = 15,
  initialDelayMs: number = 2000
): Promise<number> {
  let delay = initialDelayMs;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const balance = await getKRC20Balance(address, ticker);
    if (balance >= expectedMinBalance) {
      console.log(`[Indexer] Balance ${balance} >= ${expectedMinBalance} for ${ticker}@${address}`);
      return balance;
    }

    console.log(`[Indexer] Waiting for balance... current: ${balance}, expected: ${expectedMinBalance}`);
    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, 10000);
  }

  // Return current balance even if below expected
  return await getKRC20Balance(address, ticker);
}
