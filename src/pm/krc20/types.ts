/**
 * KRC20 Token Types for Prediction Market Shares
 *
 * Supports both mock (in-memory) and real (on-chain Kasplex) KRC-20 tokens.
 * When USE_REAL_KRC20=true, operations use Kasplex commit-reveal inscriptions.
 */

export type TokenSide = 'YES' | 'NO';

// ============================================================================
// Kasplex Indexer Types
// ============================================================================

/**
 * Generic response from Kasplex indexer API
 */
export interface IndexerResponse<T> {
  message: string;  // "successful" or error
  result?: T[];
}

/**
 * Token balance from Kasplex indexer
 */
export interface TokenBalance {
  tick: string;          // Token ticker
  balance: string;       // Balance in sompi (smallest unit)
  locked: string;        // Locked balance
  dec: string;           // Decimals
  opScoreMod: string;    // Operation score modifier
}

/**
 * Token info from Kasplex indexer
 */
export interface TokenInfo {
  tick: string;          // Token ticker (e.g., "YBTCA")
  max: string;           // Max supply
  lim: string;           // Mint limit per operation
  dec: string;           // Decimals
  minted: string;        // Total minted supply
  opScoreAdd: string;    // Deploy operation score
  opScoreMod: string;    // Latest operation score
  state: string;         // Token state (deployed, minting, etc.)
  hashRev: string;       // Reveal transaction hash
  mtsAdd: string;        // Deploy timestamp
}

// ============================================================================
// Kasplex Inscription Types
// ============================================================================

/**
 * KRC-20 operation types
 */
export type KRC20Operation = 'deploy' | 'mint' | 'transfer';

/**
 * Deploy operation data
 */
export interface DeployData {
  p: 'krc-20';
  op: 'deploy';
  tick: string;
  max: string;
  lim: string;
  dec: string;
}

/**
 * Mint operation data
 */
export interface MintData {
  p: 'krc-20';
  op: 'mint';
  tick: string;
}

/**
 * Transfer operation data
 */
export interface TransferData {
  p: 'krc-20';
  op: 'transfer';
  tick: string;
  amt: string;
  to: string;
}

/**
 * Result of a commit-reveal inscription
 */
export interface InscriptionResult {
  success: boolean;
  commitTxid?: string;
  revealTxid?: string;
  error?: string;
}

/**
 * Configuration for Kasplex operations
 */
export interface KasplexConfig {
  privateKey: string;
  network: 'mainnet' | 'testnet-10' | 'testnet-11';
  rpcUrl?: string;
}

// ============================================================================
// Internal KRC-20 Types (shared between mock and real)
// ============================================================================

/**
 * KRC20 Token Information
 */
export interface KRC20TokenInfo {
  ticker: string;           // e.g., "YBTCA" - KRC-20 compliant (4-6 letters)
  display_name: string;     // e.g., "YES BTC $130,000" - for UI display
  market_id: string;        // Associated market ID
  side: TokenSide;          // YES or NO
  asset: string;            // e.g., "BTC"
  threshold: number;        // e.g., 130000
  market_index: string;     // e.g., "A", "B", "C"
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
