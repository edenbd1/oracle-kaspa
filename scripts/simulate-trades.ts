#!/usr/bin/env tsx
/**
 * Trade Simulation Script
 *
 * Simulates realistic trading activity to demonstrate LMSR price movement.
 */

import '../src/pm/store/index.js';
import {
  getEvents,
  getMarketsForEvent,
  getMarket,
  deposit,
  getBalance
} from '../src/pm/store/index.js';
import { executeTrade, getMarketPrices } from '../src/pm/engine/trading.js';
import { priceYes, priceNo } from '../src/pm/math/lmsr.js';

console.log('=== Trade Simulation ===\n');

// Get first event and its markets
const events = getEvents();
if (events.length === 0) {
  console.error('No events found. Run: npm run seed-markets first');
  process.exit(1);
}

const event = events[0];
const markets = getMarketsForEvent(event.id);

console.log(`Event: ${event.title}`);
console.log(`Markets: ${markets.length}\n`);

// Create simulation wallets
const traders = [
  { wallet: 'kaspatest:qztrader1simtest001', name: 'Trader1' },
  { wallet: 'kaspatest:qztrader2simtest002', name: 'Trader2' },
  { wallet: 'kaspatest:qztrader3simtest003', name: 'Trader3' }
];

// Fund traders
for (const trader of traders) {
  deposit(trader.wallet, 500);
  console.log(`Funded ${trader.name} with 500 KAS`);
}
console.log('');

// Simulate trades
interface SimTrade {
  trader: typeof traders[0];
  marketIndex: number;
  side: 'YES' | 'NO';
  amount: number;
}

const simTrades: SimTrade[] = [
  // Trader1 is bullish on high prices
  { trader: traders[0], marketIndex: 0, side: 'YES', amount: 20 },  // BTC >= 150k
  { trader: traders[0], marketIndex: 1, side: 'YES', amount: 15 },  // BTC >= 130k

  // Trader2 is bearish
  { trader: traders[1], marketIndex: 0, side: 'NO', amount: 25 },   // BTC >= 150k NO
  { trader: traders[1], marketIndex: 1, side: 'NO', amount: 18 },   // BTC >= 130k NO

  // Trader3 bets on moderate targets
  { trader: traders[2], marketIndex: 2, side: 'YES', amount: 30 },  // BTC >= 120k
  { trader: traders[2], marketIndex: 3, side: 'YES', amount: 40 },  // BTC >= 100k

  // More action - building momentum
  { trader: traders[0], marketIndex: 3, side: 'YES', amount: 20 },
  { trader: traders[0], marketIndex: 4, side: 'YES', amount: 35 },  // BTC >= 80k (most likely)

  // Trader2 bets against
  { trader: traders[1], marketIndex: 4, side: 'NO', amount: 15 },   // BTC >= 80k NO

  // Trader3 hedges
  { trader: traders[2], marketIndex: 0, side: 'NO', amount: 10 },

  // More rounds to show price movement
  { trader: traders[0], marketIndex: 2, side: 'YES', amount: 12 },
  { trader: traders[1], marketIndex: 3, side: 'NO', amount: 22 },
  { trader: traders[2], marketIndex: 4, side: 'YES', amount: 25 },
];

function formatPrice(p: number): string {
  return (p * 100).toFixed(1) + '%';
}

console.log('=== Executing Trades ===\n');

for (const sim of simTrades) {
  const market = markets[sim.marketIndex];
  if (!market) {
    console.log(`Market ${sim.marketIndex} not found, skipping`);
    continue;
  }

  // Get prices before
  const pricesBefore = getMarketPrices(market.id);

  // Execute trade
  const result = executeTrade({
    wallet: sim.trader.wallet,
    marketId: market.id,
    side: sim.side,
    action: 'BUY',
    kasAmount: sim.amount,
    maxSlippage: 0.25  // 25% slippage tolerance for demo
  });

  // Get prices after
  const pricesAfter = getMarketPrices(market.id);

  // Note: executeTrade is now async
  const tradeResult = await result;

  if (tradeResult.success) {
    const dir = market.direction === '>=' ? '≥' : '≤';
    console.log(`${sim.trader.name} buys ${sim.side} on BTC ${dir} $${market.threshold_price.toLocaleString()}`);
    console.log(`  Amount: ${sim.amount} KAS → ${tradeResult.quote!.shares.toFixed(2)} shares`);
    console.log(`  Price: ${formatPrice(pricesBefore!.yes)} → ${formatPrice(pricesAfter!.yes)} YES`);
    console.log(`  Balance: ${tradeResult.newBalance?.toFixed(2)} KAS remaining`);
    console.log('');
  } else {
    console.log(`FAILED: ${sim.trader.name} on market ${sim.marketIndex}: ${tradeResult.error}`);
  }
}

// Print final market states
console.log('=== Final Market States ===\n');

for (const market of markets) {
  const prices = getMarketPrices(market.id);
  const dir = market.direction === '>=' ? '≥' : '≤';

  // Fetch updated market
  const m = getMarket(market.id)!;

  console.log(`BTC ${dir} $${market.threshold_price.toLocaleString()}`);
  console.log(`  YES: ${formatPrice(prices!.yes)} | NO: ${formatPrice(prices!.no)}`);
  console.log(`  Volume: ${m.volume.toFixed(2)} KAS`);
  console.log(`  Outstanding: ${m.q_yes.toFixed(2)} YES, ${m.q_no.toFixed(2)} NO`);
  console.log('');
}

// Print trader final balances
console.log('=== Trader Final States ===\n');

for (const trader of traders) {
  const balance = getBalance(trader.wallet);
  console.log(`${trader.name}: ${balance?.balance_kas.toFixed(2)} KAS`);
}

console.log('\nSimulation complete!');
console.log('Start the servers to see these in the UI:');
console.log('  Terminal 1: npm start       (Oracle)');
console.log('  Terminal 2: npm run pm      (Prediction Market)');
console.log('  Browser:    http://localhost:3001/pm/');
