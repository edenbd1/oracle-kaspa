/**
 * KRC20 Module Entry Point
 *
 * Supports both mock (in-memory) and real (on-chain Kasplex) KRC-20 tokens.
 * Set USE_REAL_KRC20=true in environment to enable real on-chain tokens.
 */

// Types
export type {
  TokenSide,
  KRC20TokenInfo,
  KRC20MintEvent,
  KRC20BurnEvent,
  KRC20RedeemEvent,
  KRC20Balance,
  MintResult,
  BurnResult,
  RedeemResult,
  TokenPair,
  // New inscription types
  IndexerResponse,
  TokenBalance,
  TokenInfo,
  KRC20Operation,
  DeployData,
  MintData,
  TransferData,
  InscriptionResult,
  KasplexConfig
} from './types.js';

// Utilities
export {
  generateTokenTicker,
  parseTokenTicker,
  generateMockTxid,
  generateEventId,
  getOppositeTicker,
  isValidTicker,
  formatTickerDisplay,
  generateDisplayName,
  indexToLetter,
  letterToIndex
} from './utils.js';

// Service (main API)
export {
  deployMarketTokens,
  mint,
  burn,
  redeem,
  burnLosing,
  balanceOf,
  getAllBalances,
  getToken,
  getMarketTokens,
  getNextMarketIndex,
  isRealMode,
  isRealModeAvailable,
  MINT_FEE_KAS,
  DEPLOY_FEE_KAS
} from './service.js';

// Kasplex client (for direct inscription operations)
export * as kasplex from './kasplex.js';

// Indexer client (for querying on-chain data)
export * as indexer from './indexer.js';
