/**
 * KRC20 Module Entry Point
 *
 * Mock KRC20 token layer for prediction market shares.
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
  TokenPair
} from './types.js';

// Utilities
export {
  generateTokenTicker,
  parseTokenTicker,
  generateMockTxid,
  generateEventId,
  getOppositeTicker,
  isValidTicker,
  formatTickerDisplay
} from './utils.js';

// Service
export {
  deployMarketTokens,
  mint,
  burn,
  redeem,
  burnLosing,
  balanceOf,
  getToken,
  getMarketTokens
} from './service.js';
