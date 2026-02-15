# Threshold - Prediction Markets on Kaspa

Threshold is a decentralized prediction market platform built on the Kaspa blockchain. It combines a real-time price oracle with binary outcome markets, powered by KRC-20 tokens and LMSR automated market making.

**Live demo**: [threshold-kaspa.vercel.app](https://threshold-kaspa.vercel.app)

## How it works

1. **Oracle** fetches BTC, ETH, and KAS prices from CoinGecko + CoinMarketCap every 15 seconds
2. **Aggregator** computes a median-based spot index with outlier filtering
3. **Anchor** writes a CBOR-encoded proof to the Kaspa blockchain (via public Resolver nodes)
4. **Markets** let users bet on price thresholds (e.g. "BTC >= $100,000 before March 1")
5. **KRC-20 tokens** (YES/NO) represent shares, deployed on-chain via Kasplex inscriptions
6. **LMSR pricing** ensures continuous liquidity - no order book needed

```
User connects wallet (Kasware/Kastle)
  -> Buys YES shares on "BTC >= $100K"
  -> Sends KAS to platform address
  -> Receives KRC-20 YES tokens
  -> If BTC hits $100K before deadline: each YES token pays 1 KAS
  -> If not: NO token holders get paid
```

## Architecture

```
                    Vercel (Frontend)
                    threshold-kaspa.vercel.app
                           |
                     Next.js rewrites
                      /api/pm/*  /api/oracle/*
                           |
                    Railway (Backend)
                    oracle-kaspa-production.up.railway.app
                           |
              +------------+------------+
              |                         |
        Oracle API               PM API
        /health                  /pm/events
        /latest                  /pm/trade
        /verify/:txid            /pm/quote
              |                         |
              |                    LMSR Engine
              |                    KRC-20 Service
              |                         |
              +-------+  +-----------+--+
                      |  |
                Kaspa Testnet-10
                (via public Resolver)
```

### Backend (`src/`)

| Module | Description |
|--------|-------------|
| `collector/` | Price fetching from CoinGecko + CoinMarketCap (key rotation) |
| `aggregator/` | Median calculation, outlier filtering (1% threshold), quorum check |
| `proofs/` | Bundle creation, SHA-256 hashing, local archival |
| `kaspa-anchor/` | On-chain anchoring via CBOR payloads (Resolver or direct RPC) |
| `api/` | Oracle HTTP API (`/health`, `/latest`, `/bundle/:h`, `/verify/:txid`) |
| `pm/engine/` | Market resolution engine, oracle sync loop |
| `pm/math/` | LMSR (Logarithmic Market Scoring Rule) pricing |
| `pm/krc20/` | KRC-20 token deployment, minting, transfers via Kasplex |
| `pm/api/` | Prediction market HTTP API |
| `server.ts` | Combined entrypoint (single port for Railway) |

### Frontend (`apps/pm-web/`)

Next.js 14 app with TailwindCSS. Pages:

- `/pm` - Markets overview with live prices and scrolling ticker
- `/pm/market/:id` - Market detail with trading panel, chart, trade history
- `/pm/wallet` - Portfolio view with positions and P&L

Wallet support: Kasware, Kastle, and demo mode.

## Quick Start (Local Development)

```bash
# Install dependencies + Kaspa WASM SDK
npm install

# Copy environment config
cp .env.example .env
# Edit .env with your keys

# Start Oracle (port 3000)
npm start

# Start PM server (port 3001)
npm run pm

# Start frontend (port 3002)
npm run pm:web
```

Or run everything on one port:
```bash
npm run start:combined
```

## Deployment

### Backend (Railway)

The backend runs both Oracle and PM APIs on a single port via `src/server.ts`.

**Environment variables:**

| Variable | Value | Required |
|----------|-------|----------|
| `KASPA_PRIVATE_KEY` | Hex-encoded private key | Yes |
| `PLATFORM_PRIVATE_KEY` | Same as above (for KRC-20 ops) | Yes |
| `KASPA_NETWORK` | `testnet-10` | Yes |
| `KASPA_RPC_URL` | Empty = use public Resolver | No |
| `USE_REAL_KRC20` | `true` for on-chain tokens | Yes |
| `KASPLEX_INDEXER_API` | `https://tn10api.kasplex.org` | Yes |
| `CMC_API_KEY` | CoinMarketCap API key | Yes |
| `API_PORT` | `3000` | No |
| `PM_API_PORT` | `3001` | No |

Railway auto-deploys from the `main` branch. The `railway.toml` configures the build.

### Frontend (Vercel)

| Variable | Value |
|----------|-------|
| `BACKEND_URL` | `https://<railway-app>.up.railway.app` |
| `NEXT_PUBLIC_PLATFORM_ADDRESS` | Platform's Kaspa testnet address |

Set Root Directory to `apps/pm-web` in Vercel project settings.

## On-Chain Payload Format

Each oracle tick anchors a CBOR-encoded payload to Kaspa:

```typescript
{
  d: 0.0001,           // dispersion ratio between sources
  h: "f4895c9144fd6bb9", // SHA-256 hash of full proof bundle (16 chars)
  n: 2,                // number of valid price sources
  p: 68497.66           // aggregated price (USD)
}
```

Keys are alphabetically sorted for deterministic encoding. Payload fits within 80 bytes.

## KRC-20 Token System

Each market has a YES and NO token pair deployed as KRC-20 inscriptions on Kaspa:

- **Deploy**: Commit-reveal inscription (~1000 KAS protocol fee per token)
- **Buy**: Platform transfers pre-minted tokens to buyer
- **Sell**: Tokens return to platform pool
- **Resolution**: Winning tokens pay 1 KAS each, losing tokens are worthless

Token tickers follow the pattern: `Y{ASSET}{MONTH}{INDEX}` / `N{ASSET}{MONTH}{INDEX}`
(e.g. `YBTCCA` = YES BTC March Market A)

## API Endpoints

### Oracle

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Service health, oracle state, Kaspa node info |
| `GET /latest` | Latest price bundle with proof |
| `GET /bundle/:h` | Specific bundle by hash |
| `GET /verify/:txid` | Verify an anchored transaction |

### Prediction Market

| Endpoint | Description |
|----------|-------------|
| `GET /pm/events` | All events with oracle prices |
| `GET /pm/event/:id` | Event detail with markets |
| `GET /pm/market/:id` | Market detail with trades |
| `GET /pm/quote` | Get trade quote (price, shares, fees) |
| `POST /pm/trade` | Execute a trade |
| `GET /pm/wallet/:addr` | User positions and balance |
| `GET /pm/oracle` | Current oracle state |
| `POST /pm/sync` | Force oracle sync |

## Tech Stack

- **Backend**: TypeScript, Node.js 20, Kaspa WASM SDK, cbor-x
- **Frontend**: Next.js 14, React 18, TailwindCSS
- **Blockchain**: Kaspa testnet-10, KRC-20 via Kasplex
- **Infrastructure**: Railway (backend), Vercel (frontend)
- **Pricing**: LMSR (Logarithmic Market Scoring Rule)

## License

MIT
