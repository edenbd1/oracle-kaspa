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

Oracle data flow:

```
CoinGecko ----+
              |---> Aggregator ---> Bundle ---> Hash ---> CBOR ---> Kaspa TX
CoinMarketCap-+                       |
                                      v
                                 data/bundles/<h>.json
                                      |
                                      v
                                 HTTP API :3000
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
| `scripts/verify-tx.ts` | Standalone TX verification tool |

### Frontend (`apps/pm-web/`)

Next.js 14 app with TailwindCSS. Pages:

- `/pm` - Markets overview with live prices and scrolling ticker
- `/pm/market/:id` - Market detail with trading panel, chart, trade history
- `/pm/wallet` - Portfolio view with positions and P&L

Wallet support: Kasware, Kastle, and demo mode.

## Quick Start (Local Development)

```bash
# Clone and install
git clone <repo-url>
cd oracle-kaspa
npm install

# Configure environment
cp .env.example .env
# Edit .env with your keys:
#   KASPA_PRIVATE_KEY=<hex-private-key>
#   KASPA_ADDRESS=kaspatest:<your-address>
#   CMC_API_KEY=<coinmarketcap-api-key>

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

## Demo Walkthrough

### 1. Verify RPC Connection

```bash
npm run smoke:rpc
```

Expected output:
```
Connecting to ws://127.0.0.1:17210 (network: testnet-10)...
Connected!
Server info: { ... }
UTXOs for kaspatest:...: 5
Balance: 50000000000 sompi
RPC smoke test passed!
```

### 2. Start the Oracle

```bash
npm start
```

Expected output:
```
Starting Kaspa Spot Oracle...
Network: testnet-10
Interval: 60s (+-5s jitter)
[CMC] Initialized with 5 API key(s)
Connected to Kaspa. Address: kaspatest:...
API server listening on http://localhost:3000

[TICK] 2025-01-15T10:30:00.000Z
  Providers: 2/2 OK
    coingecko: $96250.00
    coinmarketcap: $96248.50
  Index: $96249.25 [OK]
  Bundle: a1b2c3d4e5f6g7h8...
  TX: abc123def456...
  Done in 1523ms
```

### 3. Verify a Transaction

Copy a TXID from the oracle logs, then:

```bash
npm run verify:tx -- <txid>
```

Expected output:
```
=== Oracle TX Verification ===

TXID: abc123def456789...

Connecting to ws://127.0.0.1:17210...
Fetching transaction...

Payload (hex): a4616400616836...
Payload size: 47 bytes

--- Decoded Payload ---
  p (price):       $96249.25
  n (num_sources): 2
  d (dispersion):  0.0016%
  h (bundle_hash): a1b2c3d4e5f6g7h8

Validation: PASSED

--- Local Bundle Verification ---
Bundle found locally!
Hash verification: PASSED (a1b2c3d4e5f6g7h8)

--- Bundle Summary ---
  Tick ID:    2025-01-15T10:30:00.000Z
  Network:    testnet-10
  Price:      $96249.25
  Sources:    coingecko, coinmarketcap
  Dispersion: 0.0016%

Verification complete.
```

## On-Chain Verification

The oracle provides **cryptographic verifiability**:

1. **On-chain**: The Kaspa transaction contains CBOR-encoded `{p, n, d, h}`:
   - `p` = BTC/USD price (2 decimal places)
   - `n` = number of sources used
   - `d` = dispersion (max-min)/median
   - `h` = first 16 chars of bundle hash

2. **Off-chain**: The full bundle is stored and accessible via API:
   - Contains raw responses from each provider
   - Contains aggregation metadata (outlier filtering, etc.)

3. **Verification**: Anyone can verify by:
   ```
   SHA256(canonical_json(bundle))[0:16] === on_chain_h
   ```

This proves the anchored price was computed from the specific provider responses.

### On-Chain Payload Format

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
| `GET /health` | Full health status (oracle + kaspad) |
| `GET /latest` | Latest bundle + txid |
| `GET /bundle/:h` | Bundle by hash (16 hex chars) |
| `GET /verify/:txid` | Verify a transaction (64 hex chars) |

#### `GET /health`

```bash
curl http://localhost:3000/health | jq
```

```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:35:00.000Z",
  "oracle": {
    "network": "testnet-10",
    "last_tick_id": "2025-01-15T10:30:00.000Z",
    "last_updated_at": "2025-01-15T10:30:05.000Z",
    "lag_seconds": 295,
    "last_txid": "abc123def456...",
    "last_hash": "a1b2c3d4e5f6g7h8",
    "last_price": 96249.25,
    "providers_ok": 2,
    "providers_total": 2
  },
  "kaspa": {
    "is_synced": true,
    "virtual_daa_score": "123456789",
    "utxo_count": 5,
    "balance_sompi": "50000000000"
  }
}
```

Status values: `healthy` (all systems operational), `degraded` (some providers failing or lag 60-120s), `unhealthy` (critical issue).

#### `GET /latest`

```bash
curl http://localhost:3000/latest | jq
```

```json
{
  "latest": {
    "h": "a1b2c3d4e5f6g7h8",
    "hash_full": "a1b2c3d4e5f6g7h8...",
    "txid": "abc123def456789...",
    "updated_at": "2025-01-15T10:30:00.000Z"
  },
  "bundle": {
    "tick_id": "2025-01-15T10:30:00.000Z",
    "network": "testnet-10",
    "responses": ["..."],
    "index": {
      "price": 96249.25,
      "sources_used": ["coingecko", "coinmarketcap"],
      "num_sources": 2,
      "dispersion": 0.000016
    }
  }
}
```

#### `GET /verify/:txid`

```bash
curl http://localhost:3000/verify/<txid> | jq
```

```json
{
  "txid": "abc123...",
  "network": "testnet-10",
  "status": "PASSED",
  "tx_found": true,
  "block_time": "2025-01-15T10:30:00.000Z",
  "payload_hex": "a4616400...",
  "payload_size": 47,
  "decoded": {
    "p": 96249.25,
    "n": 2,
    "d": 0.000016,
    "h": "a1b2c3d4e5f6g7h8"
  },
  "validation": { "valid": true, "errors": [] },
  "bundle_found": true,
  "hash_verified": true,
  "bundle_summary": {
    "tick_id": "2025-01-15T10:30:00.000Z",
    "network": "testnet-10",
    "price": 96249.25,
    "sources_used": ["coingecko", "coinmarketcap"],
    "dispersion": 0.000016
  },
  "provider_responses": [
    { "provider": "coingecko", "price": 96250.00, "ok": true, "error": null },
    { "provider": "coinmarketcap", "price": 96248.50, "ok": true, "error": null }
  ]
}
```

Status values: `PASSED` (TX found, payload valid, bundle verified), `PARTIAL` (TX valid but bundle not found locally), `FAILED` (validation or hash verification failed), `ERROR` (TX not found or invalid TXID).

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

## Tech Stack

- **Backend**: TypeScript, Node.js 20, Kaspa WASM SDK, cbor-x
- **Frontend**: Next.js 14, React 18, TailwindCSS
- **Blockchain**: Kaspa testnet-10, KRC-20 via Kasplex
- **Infrastructure**: Railway (backend), Vercel (frontend)
- **Pricing**: LMSR (Logarithmic Market Scoring Rule)

## Troubleshooting

**"No UTXOs available"**
- Fund your testnet wallet at https://faucet.kaspa.org/

**"Transaction not found"**
- Wait for confirmation (1-2 seconds on testnet)
- Check kaspad is synced

**"All CMC keys rate-limited"**
- CoinGecko-only mode still works
- Anchoring continues with 1 source (status: STALE)

**API returns 404 for bundle**
- Oracle must be running to store bundles
- Check `data/bundles/` directory exists

## License

ISC
