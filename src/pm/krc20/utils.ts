/**
 * KRC20 Utility Functions
 *
 * Token ticker generation and parsing utilities.
 */

import { TokenSide } from './types.js';

/**
 * Generate a token ticker from market parameters
 *
 * Format: {SIDE}_{ASSET}_{THRESHOLD}
 * Example: YES_BTC_100000, NO_BTC_80000
 */
export function generateTokenTicker(
  asset: string,
  threshold: number,
  side: TokenSide
): string {
  // Normalize asset to uppercase
  const normalizedAsset = asset.toUpperCase();

  // Format threshold without commas or decimals
  const normalizedThreshold = Math.floor(threshold);

  return `${side}_${normalizedAsset}_${normalizedThreshold}`;
}

/**
 * Parse a token ticker into its components
 *
 * @returns { side, asset, threshold } or null if invalid
 */
export function parseTokenTicker(ticker: string): {
  side: TokenSide;
  asset: string;
  threshold: number;
} | null {
  const parts = ticker.split('_');

  if (parts.length < 3) {
    return null;
  }

  const side = parts[0] as TokenSide;
  if (side !== 'YES' && side !== 'NO') {
    return null;
  }

  const asset = parts[1];
  const threshold = parseInt(parts.slice(2).join('_'), 10);

  if (isNaN(threshold)) {
    return null;
  }

  return { side, asset, threshold };
}

/**
 * Generate a mock transaction ID
 *
 * In production, this would be a real Kaspa transaction ID.
 * For the mock layer, we generate deterministic-looking hex strings.
 */
export function generateMockTxid(prefix: string = 'krc20'): string {
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).slice(2, 18);
  const hash = simpleHash(`${prefix}-${timestamp}-${random}`);
  return hash;
}

/**
 * Simple hash function for generating mock txids
 */
function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  // Convert to 64-character hex string (like a real txid)
  const base = Math.abs(hash).toString(16);
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).slice(2);

  const combined = (base + timestamp + random).repeat(4);
  return combined.slice(0, 64);
}

/**
 * Generate a unique event ID
 */
export function generateEventId(type: 'mint' | 'burn' | 'redeem'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${type}_${timestamp}_${random}`;
}

/**
 * Get the opposite token ticker
 *
 * Example: YES_BTC_100000 -> NO_BTC_100000
 */
export function getOppositeTicker(ticker: string): string | null {
  const parsed = parseTokenTicker(ticker);
  if (!parsed) return null;

  const oppositeSide: TokenSide = parsed.side === 'YES' ? 'NO' : 'YES';
  return generateTokenTicker(parsed.asset, parsed.threshold, oppositeSide);
}

/**
 * Validate a token ticker format
 */
export function isValidTicker(ticker: string): boolean {
  return parseTokenTicker(ticker) !== null;
}

/**
 * Format ticker for display
 *
 * Example: YES_BTC_100000 -> "YES BTC $100,000"
 */
export function formatTickerDisplay(ticker: string): string {
  const parsed = parseTokenTicker(ticker);
  if (!parsed) return ticker;

  const formattedThreshold = parsed.threshold.toLocaleString();
  return `${parsed.side} ${parsed.asset} $${formattedThreshold}`;
}
