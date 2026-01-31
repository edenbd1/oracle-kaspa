/**
 * LMSR (Logarithmic Market Scoring Rule) Implementation
 *
 * Used for binary prediction market pricing.
 * Provides liquidity-sensitive automated market making.
 *
 * Key properties:
 * - Both YES and NO always have a price
 * - price_yes + price_no = 1 (always)
 * - Supports both BUY and SELL operations
 */

// Default fee in basis points (1% = 100 bps)
export const DEFAULT_FEE_BPS = 100;

/**
 * Stable log-sum-exp to avoid overflow/underflow.
 * LSE(x, y) = max(x,y) + ln(1 + exp(-|x-y|))
 */
function logSumExp(a: number, b: number): number {
  const max = Math.max(a, b);
  const min = Math.min(a, b);
  return max + Math.log(1 + Math.exp(min - max));
}

/**
 * Cost function C(q_yes, q_no) = b * ln(exp(q_yes/b) + exp(q_no/b))
 * Using stable log-sum-exp computation.
 */
export function cost(qYes: number, qNo: number, b: number): number {
  if (b <= 0) throw new Error('Liquidity parameter b must be positive');
  return b * logSumExp(qYes / b, qNo / b);
}

/**
 * YES token price: p_yes = exp(q_yes/b) / (exp(q_yes/b) + exp(q_no/b))
 * Computed stably as: 1 / (1 + exp((q_no - q_yes) / b))
 */
export function priceYes(qYes: number, qNo: number, b: number): number {
  if (b <= 0) throw new Error('Liquidity parameter b must be positive');
  const diff = (qNo - qYes) / b;
  if (diff > 20) return 0.0001; // Avoid exactly 0
  if (diff < -20) return 0.9999; // Avoid exactly 1
  return 1 / (1 + Math.exp(diff));
}

/**
 * NO token price: p_no = 1 - p_yes
 */
export function priceNo(qYes: number, qNo: number, b: number): number {
  return 1 - priceYes(qYes, qNo, b);
}

/**
 * Cost to buy Δ YES tokens.
 * cost = C(q_yes + Δ, q_no) - C(q_yes, q_no)
 */
export function costToBuyYes(qYes: number, qNo: number, b: number, delta: number): number {
  return cost(qYes + delta, qNo, b) - cost(qYes, qNo, b);
}

/**
 * Cost to buy Δ NO tokens.
 * cost = C(q_yes, q_no + Δ) - C(q_yes, q_no)
 */
export function costToBuyNo(qYes: number, qNo: number, b: number, delta: number): number {
  return cost(qYes, qNo + delta, b) - cost(qYes, qNo, b);
}

/**
 * Payout for selling Δ YES tokens.
 * payout = C(q_yes, q_no) - C(q_yes - Δ, q_no)
 */
export function payoutToSellYes(qYes: number, qNo: number, b: number, delta: number): number {
  if (delta > qYes) return 0; // Can't sell more than outstanding
  return cost(qYes, qNo, b) - cost(qYes - delta, qNo, b);
}

/**
 * Payout for selling Δ NO tokens.
 * payout = C(q_yes, q_no) - C(q_yes, q_no - Δ)
 */
export function payoutToSellNo(qYes: number, qNo: number, b: number, delta: number): number {
  if (delta > qNo) return 0; // Can't sell more than outstanding
  return cost(qYes, qNo, b) - cost(qYes, qNo - delta, b);
}

/**
 * Calculate shares received when selling for a given KAS amount.
 * Inverse of payout function using binary search.
 */
export function sharesForPayout(
  qYes: number,
  qNo: number,
  b: number,
  kasAmount: number,
  side: 'YES' | 'NO'
): number {
  if (kasAmount <= 0) return 0;

  const maxShares = side === 'YES' ? qYes : qNo;
  if (maxShares <= 0) return 0;

  const payoutFn = side === 'YES' ? payoutToSellYes : payoutToSellNo;

  // Binary search for shares
  let low = 0;
  let high = maxShares;
  const epsilon = 0.0001;

  while (high - low > epsilon) {
    const mid = (low + high) / 2;
    const midPayout = payoutFn(qYes, qNo, b, mid);
    if (midPayout < kasAmount) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return low;
}

/**
 * Calculate how many tokens you get for a given KAS amount.
 * Uses binary search since cost function is monotonic.
 */
export function tokensForCost(
  qYes: number,
  qNo: number,
  b: number,
  kasAmount: number,
  side: 'YES' | 'NO'
): number {
  if (kasAmount <= 0) return 0;

  const costFn = side === 'YES' ? costToBuyYes : costToBuyNo;

  // Binary search for tokens
  let low = 0;
  let high = kasAmount * 100; // Upper bound heuristic
  const epsilon = 0.0001;

  // First check if high is enough
  while (costFn(qYes, qNo, b, high) < kasAmount) {
    high *= 2;
    if (high > 1e12) break; // Safety limit
  }

  // Binary search
  while (high - low > epsilon) {
    const mid = (low + high) / 2;
    const midCost = costFn(qYes, qNo, b, mid);
    if (midCost < kasAmount) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return low;
}

/**
 * Calculate price impact of a trade.
 * Returns the average price paid per token.
 */
export function averagePrice(
  qYes: number,
  qNo: number,
  b: number,
  tokens: number,
  side: 'YES' | 'NO'
): number {
  if (tokens <= 0) return side === 'YES' ? priceYes(qYes, qNo, b) : priceNo(qYes, qNo, b);
  const costFn = side === 'YES' ? costToBuyYes : costToBuyNo;
  return costFn(qYes, qNo, b, tokens) / tokens;
}

/**
 * Calculate price after a trade.
 */
export function priceAfterTrade(
  qYes: number,
  qNo: number,
  b: number,
  tokens: number,
  side: 'YES' | 'NO'
): { priceYes: number; priceNo: number } {
  const newQYes = side === 'YES' ? qYes + tokens : qYes;
  const newQNo = side === 'NO' ? qNo + tokens : qNo;
  return {
    priceYes: priceYes(newQYes, newQNo, b),
    priceNo: priceNo(newQYes, newQNo, b)
  };
}

/**
 * Get a quote for a trade.
 */
export interface TradeQuote {
  action: 'BUY' | 'SELL';
  side: 'YES' | 'NO';
  shares: number;
  kasAmount: number;
  avgPrice: number;
  priceImpact: number;
  priceBefore: number;
  priceAfter: number;
  fee: number;
}

/**
 * Get quote for buying shares.
 */
export function getBuyQuote(
  qYes: number,
  qNo: number,
  b: number,
  kasAmount: number,
  side: 'YES' | 'NO',
  feeBps: number = DEFAULT_FEE_BPS
): TradeQuote {
  const fee = kasAmount * feeBps / 10000;
  const netKas = kasAmount - fee;

  const priceBefore = side === 'YES' ? priceYes(qYes, qNo, b) : priceNo(qYes, qNo, b);
  const shares = tokensForCost(qYes, qNo, b, netKas, side);
  const costKas = side === 'YES'
    ? costToBuyYes(qYes, qNo, b, shares)
    : costToBuyNo(qYes, qNo, b, shares);
  const avgPrice = shares > 0 ? (costKas + fee) / shares : priceBefore;
  const after = priceAfterTrade(qYes, qNo, b, shares, side);
  const priceAfter = side === 'YES' ? after.priceYes : after.priceNo;
  const priceImpact = priceBefore > 0 ? (priceAfter - priceBefore) / priceBefore : 0;

  return {
    action: 'BUY',
    side,
    shares,
    kasAmount,
    avgPrice,
    priceImpact,
    priceBefore,
    priceAfter,
    fee
  };
}

/**
 * Get quote for selling shares.
 */
export function getSellQuote(
  qYes: number,
  qNo: number,
  b: number,
  sharesAmount: number,
  side: 'YES' | 'NO',
  feeBps: number = DEFAULT_FEE_BPS
): TradeQuote {
  const priceBefore = side === 'YES' ? priceYes(qYes, qNo, b) : priceNo(qYes, qNo, b);

  // Calculate gross payout
  const grossPayout = side === 'YES'
    ? payoutToSellYes(qYes, qNo, b, sharesAmount)
    : payoutToSellNo(qYes, qNo, b, sharesAmount);

  const fee = grossPayout * feeBps / 10000;
  const netPayout = grossPayout - fee;

  const avgPrice = sharesAmount > 0 ? netPayout / sharesAmount : priceBefore;

  // Price after selling (shares decrease)
  const newQYes = side === 'YES' ? qYes - sharesAmount : qYes;
  const newQNo = side === 'NO' ? qNo - sharesAmount : qNo;
  const priceAfter = side === 'YES'
    ? priceYes(Math.max(0, newQYes), newQNo, b)
    : priceNo(newQYes, Math.max(0, newQNo), b);
  const priceImpact = priceBefore > 0 ? (priceAfter - priceBefore) / priceBefore : 0;

  return {
    action: 'SELL',
    side,
    shares: sharesAmount,
    kasAmount: netPayout,
    avgPrice,
    priceImpact,
    priceBefore,
    priceAfter,
    fee
  };
}

// Legacy function for backwards compatibility
export function getQuote(
  qYes: number,
  qNo: number,
  b: number,
  kasAmount: number,
  side: 'YES' | 'NO'
): TradeQuote {
  return getBuyQuote(qYes, qNo, b, kasAmount, side, 0);
}
