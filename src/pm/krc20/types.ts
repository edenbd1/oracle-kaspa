/**
 * KRC20 Token Types for Prediction Market Shares
 *
 * Mock KRC20 layer with exact naming conventions and semantics.
 * Designed for easy upgrade to on-chain KRC20 contracts later.
 */

export type TokenSide = 'YES' | 'NO';

/**
 * KRC20 Token Information
 */
export interface KRC20TokenInfo {
  ticker: string;           // e.g., "YES_BTC_100000"
  market_id: string;        // Associated market ID
  side: TokenSide;          // YES or NO
  asset: string;            // e.g., "BTC"
  threshold: number;        // e.g., 100000
  total_supply: number;     // Current total supply
  decimals: number;         // Token decimals (8 for KAS compatibility)
  deployed_at: number;      // Timestamp of deployment
  deployed_txid: string;    // Mock transaction ID
}

/**
 * KRC20 Mint Event - Created when user buys shares
 */
export interface KRC20MintEvent {
  id: string;
  ticker: string;
  recipient: string;        // Wallet address
  amount: number;           // Amount minted
  trade_id: string;         // Associated trade ID
  txid: string;             // Mock transaction ID
  timestamp: number;
}

/**
 * KRC20 Burn Event - Created when user sells shares
 */
export interface KRC20BurnEvent {
  id: string;
  ticker: string;
  from: string;             // Wallet address
  amount: number;           // Amount burned
  trade_id: string;         // Associated trade ID
  txid: string;             // Mock transaction ID
  timestamp: number;
}

/**
 * KRC20 Redeem Event - Created when winning tokens are redeemed for KAS
 */
export interface KRC20RedeemEvent {
  id: string;
  ticker: string;
  from: string;             // Wallet address
  amount: number;           // Amount redeemed
  kas_received: number;     // KAS received (1:1 for winning tokens)
  resolution_txid: string;  // Market resolution transaction
  txid: string;             // Mock redemption transaction ID
  timestamp: number;
}

/**
 * Token balance for a specific wallet
 */
export interface KRC20Balance {
  ticker: string;
  wallet: string;
  balance: number;
}

/**
 * Result of a mint operation
 */
export interface MintResult {
  success: boolean;
  ticker: string;
  amount: number;
  txid: string;
  new_supply: number;
  error?: string;
}

/**
 * Result of a burn operation
 */
export interface BurnResult {
  success: boolean;
  ticker: string;
  amount: number;
  txid: string;
  new_supply: number;
  error?: string;
}

/**
 * Result of a redeem operation
 */
export interface RedeemResult {
  success: boolean;
  ticker: string;
  amount: number;
  kas_received: number;
  txid: string;
  error?: string;
}

/**
 * Token pair for a market
 */
export interface TokenPair {
  yes_token: KRC20TokenInfo;
  no_token: KRC20TokenInfo;
}
