/**
 * KRC20 Utility Functions
 *
 * Token ticker generation and parsing utilities.
 * KRC-20 tickers must be 4-6 uppercase letters only (no numbers, no underscores).
 */

import { TokenSide } from './types.js';

/**
 * Generate a KRC-20 compliant ticker (4-6 letters only)
 *
 * Format: {SIDE}{ASSET}{INDEX}
 * Example: YBTCA, NBTCA, YETHA, NETHA
 *
 * @deprecated Use generateTokenTickerWithMonth() for new deployments
 * @param asset - Asset code (BTC, ETH, KAS)
 * @param marketIndex - Market index letter (A, B, C, etc.)
 * @param side - YES or NO
 */
export function generateTokenTicker(
  asset: string,
  marketIndex: string,
  side: TokenSide
): string {
  const sideChar = side === 'YES' ? 'Y' : 'N';
  const assetCode = asset.toUpperCase().slice(0, 3); // BTC, ETH, KAS
  const indexChar = marketIndex.toUpperCase().slice(0, 1);

  return `${sideChar}${assetCode}${indexChar}`; // YBTCA, NBTCA
}

/**
 * Get month letter (A=Jan, B=Feb, ..., L=Dec)
 */
export function getMonthLetter(date: Date): string {
  return String.fromCharCode(65 + date.getMonth()); // 0-11 → A-L
}

/**
 * Generate ticker with month: Y{ASSET}{MONTH}{MARKET} or N{ASSET}{MONTH}{MARKET}
 * Example: YBTCBA = YES BTC, February, market A
 *
 * IMPORTANT: The month letter is derived from the event date (deadline or createdAt),
 * NOT runtime date, to ensure deterministic tickers across redeploys.
 *
 * @param asset - Asset code (must be exactly 3 chars: BTC, ETH, KAS)
 * @param marketIndex - Market index letter (A-Z)
 * @param side - YES or NO
 * @param eventDate - Event deadline or creation date (determines month letter)
 */
export function generateTokenTickerWithMonth(
  asset: string,
  marketIndex: string,
  side: 'YES' | 'NO',
  eventDate: Date
): string {
  const prefix = side === 'YES' ? 'Y' : 'N';
  const assetCode = asset.toUpperCase().slice(0, 3);

  // Guard: asset code must be exactly 3 chars to fit KRC-20 6-char limit
  if (assetCode.length !== 3) {
    throw new Error(`Asset code must be 3 letters, got "${assetCode}" (${assetCode.length} chars)`);
  }

  const monthLetter = getMonthLetter(eventDate);
  return `${prefix}${assetCode}${monthLetter}${marketIndex}`;
}

/**
 * Convert a number index to a letter (0 -> A, 1 -> B, etc.)
 */
export function indexToLetter(index: number): string {
  return String.fromCharCode(65 + (index % 26)); // A-Z
}

/**
 * Convert a letter to number index (A -> 0, B -> 1, etc.)
 */
export function letterToIndex(letter: string): number {
  return letter.toUpperCase().charCodeAt(0) - 65;
}

/**
 * Parse a token ticker into its components
 *
 * New format with month: YBTCBA -> { side: 'YES', asset: 'BTC', monthLetter: 'B', marketIndex: 'A' }
 * Old format without month: YBTCA -> { side: 'YES', asset: 'BTC', marketIndex: 'A' }
 * Legacy format: YES_BTC_100000 -> { side: 'YES', asset: 'BTC', marketIndex: '?' }
 *
 * @returns { side, asset, marketIndex, monthLetter? } or null if invalid
 */
export function parseTokenTicker(ticker: string): {
  side: TokenSide;
  asset: string;
  marketIndex: string;
  monthLetter?: string;
} | null {
  // New format with month: YBTCBA or NBTCBA (6 chars)
  if (/^[YN][A-Z]{3}[A-Z][A-Z]$/.test(ticker)) {
    const sideChar = ticker[0];
    const side: TokenSide = sideChar === 'Y' ? 'YES' : 'NO';
    const asset = ticker.slice(1, 4);
    const monthLetter = ticker[4];
    const marketIndex = ticker[5];
    return { side, asset, marketIndex, monthLetter };
  }

  // Old format without month: YBTCA or NBTCA (5 chars)
  if (/^[YN][A-Z]{3}[A-Z]$/.test(ticker)) {
    const sideChar = ticker[0];
    const side: TokenSide = sideChar === 'Y' ? 'YES' : 'NO';
    const asset = ticker.slice(1, 4);
    const marketIndex = ticker[4];
    return { side, asset, marketIndex };
  }

  // Legacy format: YES_BTC_100000
  const parts = ticker.split('_');
  if (parts.length >= 3) {
    const side = parts[0] as TokenSide;
    if (side !== 'YES' && side !== 'NO') {
      return null;
    }
    const asset = parts[1];
    return { side, asset, marketIndex: '?' };
  }

  return null;
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
 * Example: YBTCA -> NBTCA, YBTCBA -> NBTCBA
 */
export function getOppositeTicker(ticker: string): string | null {
  const parsed = parseTokenTicker(ticker);
  if (!parsed) return null;

  const oppositeSide: TokenSide = parsed.side === 'YES' ? 'NO' : 'YES';

  // New format with month (6 chars)
  if (parsed.monthLetter) {
    const prefix = oppositeSide === 'YES' ? 'Y' : 'N';
    return `${prefix}${parsed.asset}${parsed.monthLetter}${parsed.marketIndex}`;
  }

  // Old format without month (5 chars)
  return generateTokenTicker(parsed.asset, parsed.marketIndex, oppositeSide);
}

/**
 * Validate a token ticker format
 */
export function isValidTicker(ticker: string): boolean {
  return parseTokenTicker(ticker) !== null;
}

/**
 * Format ticker for basic display
 *
 * Example: YBTCA -> "YES BTC A", YBTCBA -> "YES BTC Feb A"
 *
 * For full display with price, use display_name field in KRC20TokenInfo
 */
export function formatTickerDisplay(ticker: string): string {
  const parsed = parseTokenTicker(ticker);
  if (!parsed) return ticker;

  // New format with month
  if (parsed.monthLetter) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = parsed.monthLetter.charCodeAt(0) - 65;
    const monthName = monthNames[monthIndex] || parsed.monthLetter;
    return `${parsed.side} ${parsed.asset} ${monthName} ${parsed.marketIndex}`;
  }

  return `${parsed.side} ${parsed.asset} ${parsed.marketIndex}`;
}

/**
 * Generate a display name for UI
 *
 * Example: "YES BTC $130,000"
 */
export function generateDisplayName(
  side: TokenSide,
  asset: string,
  thresholdPrice: number
): string {
  return `${side} ${asset} $${thresholdPrice.toLocaleString()}`;
}
