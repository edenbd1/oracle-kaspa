# Kaspa Prediction Market

A Polymarket-style prediction market built on Kaspa, using the BTC oracle for deterministic resolution.

## Overview

This prediction market allows users to bet on Bitcoin price movements using KAS tokens. Markets are resolved automatically based on oracle data, with cryptographic proof of the price that triggered resolution.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│                    (public/pm/index.html)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Prediction Market API                         │
│                     (src/pm/api/index.ts)                       │
│                                                                  │
│  GET  /pm/events         - List all events                      │
│  GET  /pm/events/:id     - Event details + markets              │
│  GET  /pm/markets/:id    - Market details + trades              │
│  POST /pm/quote          - Get trade quote                      │
│  POST /pm/trade          - Execute trade                        │
│  GET  /pm/user/:wallet   - User balance + positions             │
│  POST /pm/deposit        - Deposit KAS (demo)                   │
│  POST /pm/sync           - Trigger oracle sync                  │
│  GET  /pm/oracle         - Current oracle state                 │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  Trading Engine │ │ Resolution      │ │  Store          │
│  (LMSR Pricing) │ │ Engine          │ │  (In-Memory)    │
│                 │ │                 │ │                 │
│ - Buy YES/NO    │ │ - Sync oracle   │ │ - Events        │
│ - Quote trades  │ │ - Check markets │ │ - Markets       │
│ - Price impact  │ │ - Auto-resolve  │ │ - Trades        │
│ - Slippage      │ │ - Pay winners   │ │ - Positions     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Oracle API (port 3000)                      │
│                                                                  │
│  GET /latest      - Current BTC price + txid                    │
│  GET /verify/:tx  - Verify oracle transaction                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Kaspa Blockchain (testnet-10)                 │
│                                                                  │
│  Oracle TXs contain CBOR payload: { p, n, d, h }                │
│  - p: BTC/USD price                                             │
│  - n: Number of price sources                                   │
│  - d: Dispersion between sources                                │
│  - h: Hash of full price bundle                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Token System: YES / NO

Each binary market has two token types:

### YES Tokens
- Represent belief that the condition WILL be met
- Pay out **1 KAS** if the market resolves YES
- Pay out **0 KAS** if the market resolves NO

### NO Tokens
- Represent belief that the condition will NOT be met
- Pay out **0 KAS** if the market resolves YES
- Pay out **1 KAS** if the market resolves NO

### Price Invariant

At any time: `price_YES + price_NO ≈ 1`

This means:
- If YES is trading at 0.70 (70%), NO is at 0.30 (30%)
- The YES price represents the market's implied probability

### Example

Market: "BTC ≥ $100,000 before Feb 1"

| Action | Cost | Outcome if YES | Outcome if NO |
|--------|------|----------------|---------------|
| Buy 10 YES @ 0.60 | 6 KAS | Win 10 KAS (+4 profit) | Lose 6 KAS |
| Buy 10 NO @ 0.40 | 4 KAS | Lose 4 KAS | Win 10 KAS (+6 profit) |

## LMSR (Logarithmic Market Scoring Rule)

LMSR is an automated market maker that provides:
- **Infinite liquidity** - Always possible to buy/sell
- **Bounded loss** - Market maker's max loss is controlled by parameter `b`
- **Price discovery** - Prices reflect aggregate trader beliefs

### Math

#### Cost Function
```
C(q_yes, q_no) = b × ln(e^(q_yes/b) + e^(q_no/b))
```

Where:
- `q_yes` = Outstanding YES tokens
- `q_no` = Outstanding NO tokens
- `b` = Liquidity parameter (higher = more liquidity, less price sensitivity)

#### Token Prices
```
price_yes = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))
price_no  = 1 - price_yes
```

#### Cost to Buy
```
cost_to_buy_yes(Δ) = C(q_yes + Δ, q_no) - C(q_yes, q_no)
cost_to_buy_no(Δ)  = C(q_yes, q_no + Δ) - C(q_yes, q_no)
```

### Numerical Stability

The implementation uses log-sum-exp trick to avoid overflow:
```
LSE(a, b) = max(a, b) + ln(1 + e^(min - max))
```

### Price Movement Example

Initial state: `q_yes = 0, q_no = 0, b = 50`
- price_yes = 50%, price_no = 50%

After someone buys 100 YES tokens:
- `q_yes = 100, q_no = 0`
- price_yes = 88%, price_no = 12%

The more YES tokens bought, the higher the YES price goes.

## Oracle-Based Resolution

### Resolution Rules

For a market "BTC ≥ X":

1. **Early Resolution (YES)**: If oracle reports price ≥ X at any tick before deadline
2. **Deadline Resolution (NO)**: If deadline passes without condition being met

### Resolution Process

1. Resolution engine syncs with oracle every 5 seconds
2. For each open market:
   - Check if oracle price meets condition → Resolve YES
   - Check if deadline passed → Resolve NO
3. Resolved market stores:
   - `resolved_txid` - The oracle transaction that triggered resolution
   - `resolved_price` - The BTC price at resolution
   - `resolved_hash` - The bundle hash from the oracle

### Verification

Anyone can verify a resolution:

```bash
# Using the oracle's verification endpoint
curl http://localhost:3000/verify/{resolved_txid}

# Returns decoded payload with price, proof of the exact data
```

This proves:
- The price that resolved the market came from the oracle
- The oracle transaction is on Kaspa blockchain
- The data matches the bundle hash

## Why Kaspa?

### For Payments
- **Fast finality** - 1 second block time
- **Low fees** - Minimal transaction costs
- **Native currency** - KAS used directly for betting

### For Oracle Anchoring
- **Data availability** - Price data permanently on-chain
- **Timestamp proof** - Block DAA score proves when price was recorded
- **Cryptographic proof** - Bundle hash links on-chain to off-chain data

### Trust Model

```
Prediction Market ──trusts──▶ Oracle API ──proves──▶ Kaspa Blockchain

Users can verify:
1. Oracle TX exists on Kaspa (via explorer)
2. TX payload contains correct price (via /verify endpoint)
3. Price hash matches full bundle (via hash verification)
```

## API Reference

### Events

```bash
# List events
GET /pm/events

# Get event with markets
GET /pm/events/{event_id}
```

### Markets

```bash
# Get market details
GET /pm/markets/{market_id}
```

### Trading

```bash
# Get quote (no execution)
POST /pm/quote
{
  "market_id": "mkt_...",
  "side": "YES",
  "amount_kas": 10
}

# Execute trade
POST /pm/trade
{
  "wallet": "kaspatest:qz...",
  "market_id": "mkt_...",
  "side": "YES",
  "amount_kas": 10,
  "max_slippage": 0.1
}
```

### User

```bash
# Get balance and positions
GET /pm/user/{wallet}

# Deposit (demo mode)
POST /pm/deposit
{
  "wallet": "kaspatest:qz...",
  "amount": 100
}
```

### Oracle

```bash
# Get current oracle state
GET /pm/oracle

# Trigger sync (normally automatic)
POST /pm/sync

# Verify oracle transaction
GET /pm/verify/{txid}
```

## Running the Demo

### Prerequisites
- Node.js 18+
- Running kaspad (testnet-10)
- Oracle running (`npm start`)

### Steps

```bash
# Terminal 1: Start Oracle
npm start

# Terminal 2: Seed and start Prediction Market
npm run pm:seed
npm run pm

# Terminal 3: Serve Frontend
npm run pm:serve

# Open browser
open http://localhost:8080/pm/
```

### Simulate Trading

```bash
# Run trade simulation (creates demo activity)
npm run pm:simulate
```

## Data Model

### Event
```typescript
{
  id: string;
  title: string;
  description: string;
  asset: string;        // "BTC"
  deadline: number;     // Unix ms
  created_at: number;
}
```

### Market
```typescript
{
  id: string;
  event_id: string;
  threshold_price: number;  // e.g., 100000
  direction: '>=' | '<=';
  status: 'OPEN' | 'RESOLVED';
  resolved_outcome: 'YES' | 'NO' | null;
  resolved_txid: string | null;
  resolved_price: number | null;
  liquidity_b: number;      // LMSR parameter
  q_yes: number;            // Outstanding YES tokens
  q_no: number;             // Outstanding NO tokens
  volume: number;           // Total KAS traded
}
```

### Trade
```typescript
{
  id: string;
  user_wallet: string;
  market_id: string;
  side: 'BUY_YES' | 'BUY_NO';
  amount_tokens: number;
  cost_kas: number;
  price: number;            // Average price paid
  created_at: number;
}
```

### Position
```typescript
{
  user_wallet: string;
  market_id: string;
  yes_tokens: number;
  no_tokens: number;
  total_cost: number;
}
```

## Hackathon Notes

### Simplifications Made
- In-memory storage (persisted to JSON file)
- Custodial balances (real integration would use Kaspa wallet)
- Demo deposit function (real integration would verify on-chain transfers)

### Production Considerations
- Use proper database (PostgreSQL, etc.)
- Implement real Kaspa wallet integration (WalletConnect)
- Add authentication/signatures for trades
- Consider on-chain escrow for large markets
- Add more sophisticated AMM (constant product, etc.)
