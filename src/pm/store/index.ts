/**
 * In-Memory Store for Prediction Market
 *
 * Hackathon-friendly storage. In production, replace with a database.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  Event,
  Market,
  Trade,
  Position,
  UserBalance,
  createEvent,
  createMarket
} from '../models/index.js';
import {
  KRC20TokenInfo,
  KRC20MintEvent,
  KRC20BurnEvent,
  KRC20RedeemEvent
} from '../krc20/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', '..', '..', 'data', 'pm');
const STORE_FILE = join(DATA_DIR, 'store.json');

interface PricePoint {
  timestamp: number;
  price: number;
}

interface StoreData {
  events: Event[];
  markets: Market[];
  trades: Trade[];
  positions: Position[];
  balances: UserBalance[];
  priceHistory: Record<string, PricePoint[]>; // marketId -> price points
  lastOraclePrice: number | null;
  lastOracleTxid: string | null;
  lastOracleHash: string | null;
  lastSyncAt: number | null;
  // KRC20 Token storage
  krc20Tokens: KRC20TokenInfo[];
  krc20MintEvents: KRC20MintEvent[];
  krc20BurnEvents: KRC20BurnEvent[];
  krc20RedeemEvents: KRC20RedeemEvent[];
}

const defaultStore: StoreData = {
  events: [],
  markets: [],
  trades: [],
  positions: [],
  balances: [],
  priceHistory: {},
  lastOraclePrice: null,
  lastOracleTxid: null,
  lastOracleHash: null,
  lastSyncAt: null,
  krc20Tokens: [],
  krc20MintEvents: [],
  krc20BurnEvents: [],
  krc20RedeemEvents: []
};

let store: StoreData = { ...defaultStore };

/**
 * Load store from disk
 */
export function loadStore(): void {
  if (existsSync(STORE_FILE)) {
    try {
      const data = readFileSync(STORE_FILE, 'utf-8');
      store = { ...defaultStore, ...JSON.parse(data) };
      console.log(`[PM Store] Loaded ${store.events.length} events, ${store.markets.length} markets`);
    } catch (e) {
      console.warn('[PM Store] Failed to load, starting fresh:', e);
      store = { ...defaultStore };
    }
  }
}

/**
 * Save store to disk
 */
export function saveStore(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
}

/**
 * Reset store (for testing)
 */
export function resetStore(): void {
  store = { ...defaultStore };
  saveStore();
}

// ============ Events ============

export function getEvents(): Event[] {
  return [...store.events];
}

export function getEvent(id: string): Event | null {
  return store.events.find(e => e.id === id) || null;
}

export function addEvent(event: Event): void {
  store.events.push(event);
  saveStore();
}

// ============ Markets ============

export function getMarkets(): Market[] {
  return [...store.markets];
}

export function getMarket(id: string): Market | null {
  return store.markets.find(m => m.id === id) || null;
}

export function getMarketsForEvent(eventId: string): Market[] {
  return store.markets
    .filter(m => m.event_id === eventId)
    .sort((a, b) => b.threshold_price - a.threshold_price);
}

export function getOpenMarkets(): Market[] {
  return store.markets.filter(m => m.status === 'OPEN');
}

export function addMarket(market: Market): void {
  store.markets.push(market);
  saveStore();
}

export function updateMarket(id: string, updates: Partial<Market>): void {
  const idx = store.markets.findIndex(m => m.id === id);
  if (idx >= 0) {
    store.markets[idx] = { ...store.markets[idx], ...updates };
    saveStore();
  }
}

// ============ Trades ============

export function getTrades(): Trade[] {
  return [...store.trades];
}

export function getTradesForMarket(marketId: string): Trade[] {
  return store.trades.filter(t => t.market_id === marketId);
}

export function getTradesForUser(wallet: string): Trade[] {
  return store.trades.filter(t => t.user_wallet === wallet);
}

export function addTrade(trade: Trade): void {
  store.trades.push(trade);
  saveStore();
}

// ============ Positions ============

export function getPosition(wallet: string, marketId: string): Position | null {
  return store.positions.find(
    p => p.user_wallet === wallet && p.market_id === marketId
  ) || null;
}

export function getPositionsForUser(wallet: string): Position[] {
  return store.positions.filter(p => p.user_wallet === wallet);
}

export function getPositionsForMarket(marketId: string): Position[] {
  return store.positions.filter(p => p.market_id === marketId);
}

export function upsertPosition(position: Position): void {
  const idx = store.positions.findIndex(
    p => p.user_wallet === position.user_wallet && p.market_id === position.market_id
  );
  if (idx >= 0) {
    store.positions[idx] = position;
  } else {
    store.positions.push(position);
  }
  saveStore();
}

// ============ Balances ============

export function getBalance(wallet: string): UserBalance | null {
  return store.balances.find(b => b.wallet === wallet) || null;
}

export function upsertBalance(balance: UserBalance): void {
  const idx = store.balances.findIndex(b => b.wallet === balance.wallet);
  if (idx >= 0) {
    store.balances[idx] = balance;
  } else {
    store.balances.push(balance);
  }
  saveStore();
}

export function deposit(wallet: string, amount: number): UserBalance {
  let balance = getBalance(wallet);
  if (!balance) {
    balance = {
      wallet,
      balance_kas: 0,
      deposited_kas: 0,
      withdrawn_kas: 0
    };
  }
  balance.balance_kas += amount;
  balance.deposited_kas += amount;
  upsertBalance(balance);
  return balance;
}

export function withdraw(wallet: string, amount: number): UserBalance | null {
  const balance = getBalance(wallet);
  if (!balance || balance.balance_kas < amount) {
    return null;
  }
  balance.balance_kas -= amount;
  balance.withdrawn_kas += amount;
  upsertBalance(balance);
  return balance;
}

// ============ Price History ============

const MAX_PRICE_POINTS = 100; // Keep last N points per market

export function addPricePoint(marketId: string, price: number): void {
  if (!store.priceHistory[marketId]) {
    store.priceHistory[marketId] = [];
  }

  store.priceHistory[marketId].push({
    timestamp: Date.now(),
    price
  });

  // Trim to max size
  if (store.priceHistory[marketId].length > MAX_PRICE_POINTS) {
    store.priceHistory[marketId] = store.priceHistory[marketId].slice(-MAX_PRICE_POINTS);
  }

  saveStore();
}

export function getPriceHistory(marketId: string): PricePoint[] {
  return store.priceHistory[marketId] || [];
}

// ============ Oracle State ============

export function getOracleState(): {
  price: number | null;
  txid: string | null;
  hash: string | null;
  syncedAt: number | null;
} {
  return {
    price: store.lastOraclePrice,
    txid: store.lastOracleTxid,
    hash: store.lastOracleHash,
    syncedAt: store.lastSyncAt
  };
}

export function updateOracleState(
  price: number,
  txid: string | null,
  hash: string | null
): void {
  store.lastOraclePrice = price;
  store.lastOracleTxid = txid;
  store.lastOracleHash = hash;
  store.lastSyncAt = Date.now();
  saveStore();
}

// ============ KRC20 Tokens ============

export function getKRC20Token(ticker: string): KRC20TokenInfo | null {
  return store.krc20Tokens.find(t => t.ticker === ticker) || null;
}

export function getKRC20TokensByMarket(marketId: string): KRC20TokenInfo[] {
  return store.krc20Tokens.filter(t => t.market_id === marketId);
}

export function getAllKRC20Tokens(): KRC20TokenInfo[] {
  return [...store.krc20Tokens];
}

export function upsertKRC20Token(token: KRC20TokenInfo): void {
  const idx = store.krc20Tokens.findIndex(t => t.ticker === token.ticker);
  if (idx >= 0) {
    store.krc20Tokens[idx] = token;
  } else {
    store.krc20Tokens.push(token);
  }
  saveStore();
}

// ============ KRC20 Mint Events ============

export function addKRC20MintEvent(event: KRC20MintEvent): void {
  store.krc20MintEvents.push(event);
  saveStore();
}

export function getKRC20MintEvents(ticker: string): KRC20MintEvent[] {
  return store.krc20MintEvents.filter(e => e.ticker === ticker);
}

export function getKRC20MintEventsForWallet(wallet: string): KRC20MintEvent[] {
  return store.krc20MintEvents.filter(e => e.recipient === wallet);
}

// ============ KRC20 Burn Events ============

export function addKRC20BurnEvent(event: KRC20BurnEvent): void {
  store.krc20BurnEvents.push(event);
  saveStore();
}

export function getKRC20BurnEvents(ticker: string): KRC20BurnEvent[] {
  return store.krc20BurnEvents.filter(e => e.ticker === ticker);
}

export function getKRC20BurnEventsForWallet(wallet: string): KRC20BurnEvent[] {
  return store.krc20BurnEvents.filter(e => e.from === wallet);
}

// ============ KRC20 Redeem Events ============

export function addKRC20RedeemEvent(event: KRC20RedeemEvent): void {
  store.krc20RedeemEvents.push(event);
  saveStore();
}

export function getKRC20RedeemEvents(ticker: string): KRC20RedeemEvent[] {
  return store.krc20RedeemEvents.filter(e => e.ticker === ticker);
}

export function getKRC20RedeemEventsForWallet(wallet: string): KRC20RedeemEvent[] {
  return store.krc20RedeemEvents.filter(e => e.from === wallet);
}

// ============ KRC20 Combined Token History ============

export function getKRC20TokenHistory(ticker: string): Array<KRC20MintEvent | KRC20BurnEvent | KRC20RedeemEvent> {
  const mints = store.krc20MintEvents.filter(e => e.ticker === ticker);
  const burns = store.krc20BurnEvents.filter(e => e.ticker === ticker);
  const redeems = store.krc20RedeemEvents.filter(e => e.ticker === ticker);

  return [...mints, ...burns, ...redeems].sort((a, b) => a.timestamp - b.timestamp);
}

// ============ Seed Data ============

/**
 * Convert a number index to a letter (0 -> A, 1 -> B, etc.)
 */
function indexToLetter(index: number): string {
  return String.fromCharCode(65 + (index % 26));
}

export function seedDemoData(): void {
  // Create demo event
  const deadline = new Date('2026-03-01T00:00:00Z').getTime();
  const event = createEvent(
    'Bitcoin Price Prediction',
    'What price will Bitcoin hit before March 1, 2026?',
    'BTC',
    deadline
  );
  addEvent(event);

  // Create markets at different thresholds (based on current BTC ~$77k)
  const thresholds = [150000, 140000, 130000, 120000, 110000, 100000, 90000, 80000];
  const liquidityB = 200; // Higher liquidity for smoother price curves
  const feeBps = 100; // 1% fee

  for (let i = 0; i < thresholds.length; i++) {
    const threshold = thresholds[i];
    const marketIndex = indexToLetter(i); // A, B, C, D, E, F, G, H
    const market = createMarket(event.id, threshold, '>=', liquidityB, feeBps, event.asset, marketIndex);
    addMarket(market);
    // Initialize price history with starting point
    addPricePoint(market.id, 0.5);
    // Deploy KRC20 tokens for the market (inline to avoid circular dependency)
    const yesTicker = market.yes_token_ticker!;
    const noTicker = market.no_token_ticker!;
    const timestamp = Date.now();
    const genTxid = (prefix: string) => {
      const ts = timestamp.toString(16);
      const rand = Math.random().toString(16).slice(2, 18);
      return (prefix + ts + rand).repeat(4).slice(0, 64);
    };

    const yesToken: KRC20TokenInfo = {
      ticker: yesTicker,
      display_name: `YES ${event.asset} $${threshold.toLocaleString()}`,
      market_id: market.id,
      side: 'YES',
      asset: event.asset,
      threshold: market.threshold_price,
      market_index: marketIndex,
      total_supply: 0,
      decimals: 8,
      deployed_at: timestamp,
      deployed_txid: genTxid('deploy-yes')
    };

    const noToken: KRC20TokenInfo = {
      ticker: noTicker,
      display_name: `NO ${event.asset} $${threshold.toLocaleString()}`,
      market_id: market.id,
      side: 'NO',
      asset: event.asset,
      threshold: market.threshold_price,
      market_index: marketIndex,
      total_supply: 0,
      decimals: 8,
      deployed_at: timestamp,
      deployed_txid: genTxid('deploy-no')
    };

    upsertKRC20Token(yesToken);
    upsertKRC20Token(noToken);
  }

  console.log(`[PM Store] Seeded event with ${thresholds.length} markets and KRC20 tokens`);
}

// Initialize on import
loadStore();
