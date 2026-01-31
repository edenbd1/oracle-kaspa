/**
 * Prediction Market API Routes
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import {
  getEvents,
  getEvent,
  getMarkets,
  getMarket,
  getMarketsForEvent,
  getTradesForMarket,
  getOracleState,
  getBalance,
  deposit,
  getPositionsForUser,
  getPosition,
  getPriceHistory,
  getKRC20Token,
  getKRC20TokenHistory,
  getAllKRC20Tokens
} from '../store/index.js';
import { priceYes, priceNo } from '../math/lmsr.js';
import { quoteTrade, executeTrade, getMarketPrices, TradeAction } from '../engine/trading.js';
import { syncAndResolve, verifyOracleTx } from '../engine/resolver.js';
import { formatMarketLabel } from '../models/index.js';
import { balanceOf, redeem as redeemToken } from '../krc20/index.js';

const PORT = parseInt(process.env.PM_API_PORT || '3001', 10);

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data, null, 2));
}

function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function parseQuery(url: string): Record<string, string> {
  const query: Record<string, string> = {};
  const idx = url.indexOf('?');
  if (idx >= 0) {
    const qs = url.slice(idx + 1);
    for (const pair of qs.split('&')) {
      const [key, val] = pair.split('=');
      if (key) query[key] = decodeURIComponent(val || '');
    }
  }
  return query;
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const fullUrl = req.url || '/';
  const [url] = fullUrl.split('?');
  const method = req.method || 'GET';
  const query = parseQuery(fullUrl);

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // ============ Events ============

  // GET /pm/events
  if (url === '/pm/events' && method === 'GET') {
    const events = getEvents();
    const oracle = getOracleState();

    const enriched = events.map(event => {
      const markets = getMarketsForEvent(event.id);
      return {
        ...event,
        market_count: markets.length,
        open_count: markets.filter(m => m.status === 'OPEN').length,
        deadline_iso: new Date(event.deadline).toISOString(),
        time_remaining_ms: Math.max(0, event.deadline - Date.now())
      };
    });

    sendJson(res, 200, {
      events: enriched,
      oracle_price: oracle.price,
      oracle_txid: oracle.txid,
      oracle_synced_at: oracle.syncedAt
    });
    return;
  }

  // GET /pm/event/:id or /pm/events/:id
  const eventMatch = url.match(/^\/pm\/events?\/([^/]+)$/);
  if (eventMatch && method === 'GET') {
    const eventId = eventMatch[1];
    const event = getEvent(eventId);
    if (!event) {
      sendJson(res, 404, { error: 'Event not found' });
      return;
    }

    const markets = getMarketsForEvent(eventId);
    const oracle = getOracleState();

    const enrichedMarkets = markets.map(market => {
      const prices = getMarketPrices(market.id);
      const history = getPriceHistory(market.id);
      return {
        ...market,
        label: formatMarketLabel(market),
        price_yes: prices?.yes ?? 0.5,
        price_no: prices?.no ?? 0.5,
        implied_probability: (prices?.yes ?? 0.5) * 100,
        price_history: history.slice(-50) // Last 50 points for sparkline
      };
    });

    sendJson(res, 200, {
      event: {
        ...event,
        deadline_iso: new Date(event.deadline).toISOString(),
        time_remaining_ms: Math.max(0, event.deadline - Date.now())
      },
      markets: enrichedMarkets,
      oracle_price: oracle.price,
      oracle_txid: oracle.txid,
      oracle_hash: oracle.hash,
      oracle_synced_at: oracle.syncedAt
    });
    return;
  }

  // ============ Markets ============

  // GET /pm/market/:id or /pm/markets/:id
  const marketMatch = url.match(/^\/pm\/markets?\/([^/]+)$/);
  if (marketMatch && method === 'GET') {
    const marketId = marketMatch[1];
    const market = getMarket(marketId);
    if (!market) {
      sendJson(res, 404, { error: 'Market not found' });
      return;
    }

    const prices = getMarketPrices(marketId);
    const trades = getTradesForMarket(marketId);
    const event = getEvent(market.event_id);
    const history = getPriceHistory(marketId);

    sendJson(res, 200, {
      market: {
        ...market,
        label: formatMarketLabel(market),
        price_yes: prices?.yes ?? 0.5,
        price_no: prices?.no ?? 0.5,
        implied_probability: (prices?.yes ?? 0.5) * 100
      },
      event,
      price_history: history,
      recent_trades: trades.slice(-20).reverse()
    });
    return;
  }

  // ============ Trading ============

  // GET /pm/quote
  if (url === '/pm/quote' && method === 'GET') {
    const { marketId, side, action, kasAmount, sharesAmount } = query;

    if (!marketId || !side || !action) {
      sendJson(res, 400, { error: 'Required: marketId, side, action' });
      return;
    }

    const amount = action === 'BUY'
      ? parseFloat(kasAmount || '0')
      : parseFloat(sharesAmount || '0');

    if (amount <= 0) {
      sendJson(res, 400, { error: action === 'BUY' ? 'kasAmount required' : 'sharesAmount required' });
      return;
    }

    const quote = quoteTrade(
      marketId,
      side.toUpperCase() as 'YES' | 'NO',
      action.toUpperCase() as TradeAction,
      amount
    );

    if (!quote) {
      sendJson(res, 400, { error: 'Market not found or not open' });
      return;
    }

    sendJson(res, 200, { quote });
    return;
  }

  // POST /pm/quote (alternative)
  if (url === '/pm/quote' && method === 'POST') {
    const body = await parseBody(req) as {
      marketId: string;
      side: 'YES' | 'NO';
      action: 'BUY' | 'SELL';
      kasAmount?: number;
      sharesAmount?: number;
    };

    if (!body.marketId || !body.side || !body.action) {
      sendJson(res, 400, { error: 'Required: marketId, side, action' });
      return;
    }

    const amount = body.action === 'BUY' ? body.kasAmount : body.sharesAmount;
    if (!amount || amount <= 0) {
      sendJson(res, 400, { error: body.action === 'BUY' ? 'kasAmount required' : 'sharesAmount required' });
      return;
    }

    const quote = quoteTrade(body.marketId, body.side, body.action, amount);
    if (!quote) {
      sendJson(res, 400, { error: 'Market not found or not open' });
      return;
    }

    sendJson(res, 200, { quote });
    return;
  }

  // POST /pm/trade
  if (url === '/pm/trade' && method === 'POST') {
    const body = await parseBody(req) as {
      marketId: string;
      address: string;
      side: 'YES' | 'NO';
      action: 'BUY' | 'SELL';
      kasAmount?: number;
      sharesAmount?: number;
      maxSlippage?: number;
    };

    if (!body.address || !body.marketId || !body.side || !body.action) {
      sendJson(res, 400, { error: 'Required: address, marketId, side, action' });
      return;
    }

    const result = executeTrade({
      wallet: body.address,
      marketId: body.marketId,
      side: body.side,
      action: body.action,
      kasAmount: body.kasAmount,
      sharesAmount: body.sharesAmount,
      maxSlippage: body.maxSlippage
    });

    if (!result.success) {
      sendJson(res, 400, { ok: false, error: result.error });
      return;
    }

    // Get updated position
    const position = getPosition(body.address, body.marketId);

    sendJson(res, 200, {
      ok: true,
      trade: result.trade,
      new_prices: result.marketSnapshot ? {
        yes: result.marketSnapshot.priceYes,
        no: result.marketSnapshot.priceNo
      } : null,
      sharesFilled: result.quote?.shares,
      kasSpent: result.quote?.action === 'BUY' ? result.quote.kasAmount : 0,
      kasReceived: result.quote?.action === 'SELL' ? result.quote.kasAmount : 0,
      feePaid: result.quote?.fee,
      marketSnapshot: result.marketSnapshot,
      positionSnapshot: position ? {
        yes_shares: position.yes_shares,
        no_shares: position.no_shares,
        total_cost: position.total_cost
      } : null,
      newBalance: result.newBalance,
      // KRC20 token info
      tokenMinted: result.tokenMinted,
      tokenBurned: result.tokenBurned
    });
    return;
  }

  // ============ User / Wallet ============

  // GET /pm/wallet/:address or /pm/user/:address
  const walletMatch = url.match(/^\/pm\/(wallet|user)\/([^/]+)$/);
  if (walletMatch && method === 'GET') {
    const wallet = decodeURIComponent(walletMatch[2]);
    const balance = getBalance(wallet);
    const positions = getPositionsForUser(wallet);

    // Enrich positions with market info
    const enrichedPositions = positions.map(pos => {
      const market = getMarket(pos.market_id);
      const prices = market ? getMarketPrices(pos.market_id) : null;
      return {
        ...pos,
        market_label: market ? formatMarketLabel(market) : 'Unknown',
        market_status: market?.status,
        market_resolved_outcome: market?.resolved_outcome,
        current_price_yes: prices?.yes ?? 0,
        current_price_no: prices?.no ?? 0,
        value_yes: pos.yes_shares * (prices?.yes ?? 0),
        value_no: pos.no_shares * (prices?.no ?? 0),
        potential_payout_yes: pos.yes_shares,
        potential_payout_no: pos.no_shares,
        // KRC20 token tickers
        yes_token_ticker: market?.yes_token_ticker ?? null,
        no_token_ticker: market?.no_token_ticker ?? null
      };
    });

    sendJson(res, 200, {
      wallet,
      balance_kas: balance?.balance_kas ?? 0,
      deposited_kas: balance?.deposited_kas ?? 0,
      positions: enrichedPositions
    });
    return;
  }

  // POST /pm/deposit
  if (url === '/pm/deposit' && method === 'POST') {
    const body = await parseBody(req) as { wallet?: string; address?: string; amount: number };
    const wallet = body.wallet || body.address;
    if (!wallet || !body.amount || body.amount <= 0) {
      sendJson(res, 400, { error: 'Invalid wallet/address or amount' });
      return;
    }

    const balance = deposit(wallet, body.amount);
    sendJson(res, 200, { balance });
    return;
  }

  // ============ Oracle & Verification ============

  // POST /pm/sync
  if (url === '/pm/sync' && method === 'POST') {
    const result = await syncAndResolve();
    sendJson(res, result.success ? 200 : 500, result);
    return;
  }

  // GET /pm/verify/:txid or /verify/:txid
  const verifyMatch = url.match(/^\/(pm\/)?verify\/([a-f0-9]{64})$/i);
  if (verifyMatch && method === 'GET') {
    const txid = verifyMatch[2].toLowerCase();
    const result = await verifyOracleTx(txid);
    sendJson(res, result.verified ? 200 : 400, result);
    return;
  }

  // GET /pm/oracle
  if (url === '/pm/oracle' && method === 'GET') {
    const oracle = getOracleState();
    sendJson(res, 200, {
      price: oracle.price,
      txid: oracle.txid,
      hash: oracle.hash,
      synced_at: oracle.syncedAt,
      synced_ago_ms: oracle.syncedAt ? Date.now() - oracle.syncedAt : null
    });
    return;
  }

  // ============ KRC20 Tokens ============

  // GET /pm/tokens - List all tokens
  if (url === '/pm/tokens' && method === 'GET') {
    const tokens = getAllKRC20Tokens();
    sendJson(res, 200, { tokens });
    return;
  }

  // GET /pm/token/:ticker - Get token info
  const tokenMatch = url.match(/^\/pm\/token\/([^/]+)$/);
  if (tokenMatch && method === 'GET') {
    const ticker = decodeURIComponent(tokenMatch[1]);
    const token = getKRC20Token(ticker);

    if (!token) {
      sendJson(res, 404, { error: 'Token not found' });
      return;
    }

    const market = getMarket(token.market_id);
    sendJson(res, 200, {
      token,
      market: market ? {
        id: market.id,
        label: formatMarketLabel(market),
        status: market.status,
        resolved_outcome: market.resolved_outcome
      } : null
    });
    return;
  }

  // GET /pm/token/:ticker/history - Get token mint/burn/redeem events
  const tokenHistoryMatch = url.match(/^\/pm\/token\/([^/]+)\/history$/);
  if (tokenHistoryMatch && method === 'GET') {
    const ticker = decodeURIComponent(tokenHistoryMatch[1]);
    const token = getKRC20Token(ticker);

    if (!token) {
      sendJson(res, 404, { error: 'Token not found' });
      return;
    }

    const history = getKRC20TokenHistory(ticker);
    sendJson(res, 200, {
      ticker,
      events: history.slice(-100) // Last 100 events
    });
    return;
  }

  // POST /pm/redeem - Manual token redemption (for resolved markets)
  if (url === '/pm/redeem' && method === 'POST') {
    const body = await parseBody(req) as {
      address: string;
      ticker: string;
      amount?: number;
    };

    if (!body.address || !body.ticker) {
      sendJson(res, 400, { error: 'Required: address, ticker' });
      return;
    }

    const token = getKRC20Token(body.ticker);
    if (!token) {
      sendJson(res, 404, { error: 'Token not found' });
      return;
    }

    const market = getMarket(token.market_id);
    if (!market) {
      sendJson(res, 404, { error: 'Market not found' });
      return;
    }

    if (market.status !== 'RESOLVED') {
      sendJson(res, 400, { error: 'Market is not yet resolved' });
      return;
    }

    // Check if this is a winning token
    const isWinner = (market.resolved_outcome === 'YES' && token.side === 'YES') ||
                     (market.resolved_outcome === 'NO' && token.side === 'NO');

    if (!isWinner) {
      sendJson(res, 400, { error: 'Cannot redeem losing tokens (value is 0)' });
      return;
    }

    // Get user's balance of this token
    const tokenBalance = balanceOf(body.ticker, body.address);
    const amountToRedeem = body.amount ?? tokenBalance;

    if (amountToRedeem <= 0) {
      sendJson(res, 400, { error: 'No tokens to redeem' });
      return;
    }

    if (amountToRedeem > tokenBalance) {
      sendJson(res, 400, { error: `Insufficient balance. Have: ${tokenBalance}, want: ${amountToRedeem}` });
      return;
    }

    // Perform redemption
    const result = redeemToken(body.ticker, body.address, amountToRedeem, market.resolved_txid || '');

    if (!result.success) {
      sendJson(res, 400, { error: result.error || 'Redemption failed' });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      ticker: body.ticker,
      amount_redeemed: result.amount,
      kas_received: result.kas_received,
      txid: result.txid
    });
    return;
  }

  // 404
  sendJson(res, 404, {
    error: 'Not found',
    endpoints: [
      'GET  /pm/events',
      'GET  /pm/event/:eventId',
      'GET  /pm/market/:marketId',
      'GET  /pm/quote?marketId=...&side=YES&action=BUY&kasAmount=...',
      'POST /pm/quote',
      'POST /pm/trade',
      'GET  /pm/wallet/:address',
      'POST /pm/deposit',
      'POST /pm/sync',
      'GET  /pm/verify/:txid',
      'GET  /pm/oracle',
      'GET  /pm/tokens',
      'GET  /pm/token/:ticker',
      'GET  /pm/token/:ticker/history',
      'POST /pm/redeem'
    ]
  });
}

export function startPmApiServer(): void {
  const server = createServer((req, res) => {
    handleRequest(req, res).catch(err => {
      console.error('[PM API] Error:', err);
      sendJson(res, 500, { error: 'Internal server error' });
    });
  });

  let currentPort = PORT;
  const maxRetries = 3;
  let retries = 0;

  const tryListen = () => {
    server.listen(currentPort);
  };

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && retries < maxRetries) {
      retries++;
      currentPort++;
      console.warn(`[PM API] Port ${currentPort - 1} in use, trying ${currentPort}...`);
      tryListen();
    } else {
      console.error(`[PM API] Failed to start: ${err.message}`);
    }
  });

  server.on('listening', () => {
    console.log(`[PM API] Prediction Market API listening on http://localhost:${currentPort}`);
  });

  tryListen();
}
