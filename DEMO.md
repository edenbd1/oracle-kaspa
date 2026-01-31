# Kaspa Spot Oracle - Hackathon Demo

This guide walks through a complete demo of the Kaspa Spot Oracle, showing:
1. Price collection from multiple sources (CoinGecko + CoinMarketCap)
2. Anchoring BTC/USD price data to Kaspa testnet-10
3. Verifying anchored data and retrieving bundles

## Prerequisites

- Node.js 18+
- Running kaspad on testnet-10 with wRPC enabled (port 17210)
- Funded testnet wallet (at least 10 KAS for demo)

## 1. Setup

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
#   CMC_API_KEY=<coinmarketcap-api-key>  # optional but recommended
```

## 2. Verify RPC Connection

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

## 3. Start the Oracle

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

**Copy a TXID from the logs** for the next step.

## 4. Verify a Transaction

In a new terminal, verify an anchored transaction:

```bash
npm run verify:tx -- <txid>
```

Example:
```bash
npm run verify:tx -- abc123def456789...
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

--- Provider Responses ---
  coingecko: $96250.00
  coinmarketcap: $96248.50

Verification complete.
```

## 5. Query the API

While the oracle is running, query the HTTP API:

### Get Latest Bundle

```bash
curl http://localhost:3000/latest | jq
```

Response:
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
    "responses": [...],
    "index": {
      "price": 96249.25,
      "sources_used": ["coingecko", "coinmarketcap"],
      "num_sources": 2,
      "dispersion": 0.000016
    }
  }
}
```

### Get Bundle by Hash

```bash
curl http://localhost:3000/bundle/a1b2c3d4e5f6g7h8 | jq
```

## 6. The Verification Story

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

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Full health status (oracle + kaspad) |
| `GET /latest` | Latest bundle + txid |
| `GET /bundle/:h` | Bundle by hash (16 hex chars) |
| `GET /verify/:txid` | Verify a transaction (64 hex chars) |

### Health Endpoint Example

```bash
curl http://localhost:3000/health | jq
```

Response:
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

Status values:
- `healthy` - All systems operational
- `degraded` - Some providers failing or lag elevated (60-120s)
- `unhealthy` - Critical issue (all providers down, kaspad not synced, no UTXOs, lag >120s)

### Verify Endpoint Example

```bash
curl http://localhost:3000/verify/<txid> | jq
```

Response:
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

Status values:
- `PASSED` - TX found, payload valid, bundle verified
- `PARTIAL` - TX valid but bundle not found locally
- `FAILED` - Validation or hash verification failed
- `ERROR` - TX not found or invalid TXID

## Architecture

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

## Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Main oracle loop |
| `src/collector/` | Price fetching (CG + CMC with key rotation) |
| `src/aggregator/` | Median + outlier filtering |
| `src/proofs/` | Bundle creation, hashing, storage |
| `src/kaspa-anchor/` | CBOR encoding + Kaspa TX |
| `src/api/` | HTTP server for bundle access |
| `scripts/verify-tx.ts` | TX verification tool |

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
