#!/usr/bin/env npx ts-node

/**
 * KRC20 Migration Script
 *
 * Backfills token tickers for existing markets and deploys token records.
 * Run this once to migrate existing data to the new KRC20 token system.
 *
 * Usage: npx ts-node scripts/migrate-krc20.ts
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data', 'pm');
const STORE_FILE = join(DATA_DIR, 'store.json');

interface Event {
  id: string;
  title: string;
  description: string;
  asset: string;
  deadline: number;
  created_at: number;
}

interface Market {
  id: string;
  event_id: string;
  threshold_price: number;
  direction: '>=' | '<=';
  status: string;
  resolved_outcome: string | null;
  resolved_at: number | null;
  resolved_txid: string | null;
  resolved_price: number | null;
  resolved_hash: string | null;
  liquidity_b: number;
  fee_bps: number;
  q_yes: number;
  q_no: number;
  volume: number;
  trades_count: number;
  created_at: number;
  // New fields
  yes_token_ticker?: string | null;
  no_token_ticker?: string | null;
  tokens_deployed_at?: number | null;
}

interface KRC20TokenInfo {
  ticker: string;
  market_id: string;
  side: 'YES' | 'NO';
  asset: string;
  threshold: number;
  total_supply: number;
  decimals: number;
  deployed_at: number;
  deployed_txid: string;
}

interface StoreData {
  events: Event[];
  markets: Market[];
  trades: unknown[];
  positions: unknown[];
  balances: unknown[];
  priceHistory: Record<string, unknown[]>;
  lastOraclePrice: number | null;
  lastOracleTxid: string | null;
  lastOracleHash: string | null;
  lastSyncAt: number | null;
  krc20Tokens?: KRC20TokenInfo[];
  krc20MintEvents?: unknown[];
  krc20BurnEvents?: unknown[];
  krc20RedeemEvents?: unknown[];
}

function generateMockTxid(prefix: string): string {
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).slice(2, 18);
  const combined = (prefix + timestamp + random).repeat(4);
  return combined.slice(0, 64).replace(/[^a-f0-9]/g, '0');
}

function generateTokenTicker(asset: string, threshold: number, side: 'YES' | 'NO'): string {
  return `${side}_${asset.toUpperCase()}_${Math.floor(threshold)}`;
}

async function migrate() {
  console.log('[Migration] Starting KRC20 migration...');

  // Check if store file exists
  if (!existsSync(STORE_FILE)) {
    console.log('[Migration] No store file found. Nothing to migrate.');
    return;
  }

  // Load store
  const data = readFileSync(STORE_FILE, 'utf-8');
  const store: StoreData = JSON.parse(data);

  // Initialize KRC20 arrays if not present
  if (!store.krc20Tokens) store.krc20Tokens = [];
  if (!store.krc20MintEvents) store.krc20MintEvents = [];
  if (!store.krc20BurnEvents) store.krc20BurnEvents = [];
  if (!store.krc20RedeemEvents) store.krc20RedeemEvents = [];

  // Create event lookup
  const eventMap = new Map<string, Event>();
  for (const event of store.events) {
    eventMap.set(event.id, event);
  }

  // Track migrated markets
  let migratedCount = 0;
  let tokensCreated = 0;

  // Process each market
  for (const market of store.markets) {
    const event = eventMap.get(market.event_id);
    const asset = event?.asset || 'BTC';

    // Check if market already has token tickers
    if (market.yes_token_ticker && market.no_token_ticker) {
      console.log(`[Migration] Market ${market.id} already has tokens. Skipping.`);
      continue;
    }

    // Generate token tickers
    const yesTicker = generateTokenTicker(asset, market.threshold_price, 'YES');
    const noTicker = generateTokenTicker(asset, market.threshold_price, 'NO');

    // Update market
    market.yes_token_ticker = yesTicker;
    market.no_token_ticker = noTicker;
    market.tokens_deployed_at = market.created_at;

    migratedCount++;

    // Check if tokens already exist
    const existingYes = store.krc20Tokens.find(t => t.ticker === yesTicker);
    const existingNo = store.krc20Tokens.find(t => t.ticker === noTicker);

    if (!existingYes) {
      // Create YES token
      const yesToken: KRC20TokenInfo = {
        ticker: yesTicker,
        market_id: market.id,
        side: 'YES',
        asset,
        threshold: market.threshold_price,
        total_supply: market.q_yes, // Use existing outstanding shares
        decimals: 8,
        deployed_at: market.created_at,
        deployed_txid: generateMockTxid('migrate-yes')
      };
      store.krc20Tokens.push(yesToken);
      tokensCreated++;
    }

    if (!existingNo) {
      // Create NO token
      const noToken: KRC20TokenInfo = {
        ticker: noTicker,
        market_id: market.id,
        side: 'NO',
        asset,
        threshold: market.threshold_price,
        total_supply: market.q_no, // Use existing outstanding shares
        decimals: 8,
        deployed_at: market.created_at,
        deployed_txid: generateMockTxid('migrate-no')
      };
      store.krc20Tokens.push(noToken);
      tokensCreated++;
    }

    console.log(`[Migration] Migrated market ${market.id}: ${yesTicker}, ${noTicker}`);
  }

  // Save updated store
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));

  console.log('[Migration] Complete!');
  console.log(`  - Markets migrated: ${migratedCount}`);
  console.log(`  - Tokens created: ${tokensCreated}`);
  console.log(`  - Total markets: ${store.markets.length}`);
  console.log(`  - Total tokens: ${store.krc20Tokens.length}`);
}

migrate().catch(console.error);
