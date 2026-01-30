# Kaspa Spot Oracle

A TypeScript/Node.js oracle that fetches BTC/USD prices from aggregator APIs, calculates a median-based spot index, and anchors results to Kaspa testnet-11 via CBOR-encoded transaction payloads.

## Features

- **Multi-source price aggregation**: CoinGecko + CoinMarketCap
- **Median-based index**: Outlier filtering with 1% threshold
- **Quorum validation**: Minimum 2 valid sources required
- **CBOR payload encoding**: Compact on-chain data format
- **Proof archival**: Local JSON bundles with SHA-256 hashes

## Prerequisites

- Node.js 20+
- A running Kaspa testnet-11 node with `--utxoindex` enabled
- CoinMarketCap API key (optional but recommended)

## Installation

```bash
npm install
```

This will automatically download and install the Kaspa WASM SDK from GitHub releases.

## Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Configure your environment variables:
```env
# Kaspa testnet private key (hex-encoded)
KASPA_PRIVATE_KEY=<your-private-key>

# Optional: override RPC URL (default: ws://127.0.0.1:16310)
KASPA_RPC_URL=ws://127.0.0.1:16310

# CoinMarketCap API keys (at least one recommended)
CMC_API_KEY=<your-cmc-api-key>
```

3. Fund your testnet address via the faucet:
   https://faucet-testnet-11.kaspa.org/

## Usage

### Smoke Tests (Verification)

Run in order to verify setup:

```bash
# 1. Test RPC connection (requires running Kaspa node)
npm run smoke:rpc

# 2. Test price collectors
npm run smoke:collector

# 3. Test aggregation logic
npm run smoke:aggregator

# 4. Test transaction creation (dry run)
npm run smoke:kaspa:dry

# 5. Submit test transaction (live)
npm run smoke:kaspa:live
```

### Run Oracle

```bash
npm start
```

The oracle will:
1. Fetch prices every 60 seconds (±5s jitter)
2. Calculate median index from valid sources
3. Store proof bundles in `proofs/` directory
4. Anchor to Kaspa if quorum is met

## Architecture

```
src/
├── index.ts              # Main entry + orchestration loop
├── types.ts              # TypeScript interfaces
├── config.ts             # Config loader
├── collector/
│   ├── index.ts          # Collector orchestrator
│   ├── coingecko.ts      # CoinGecko adapter
│   └── coinmarketcap.ts  # CoinMarketCap adapter (with key rotation)
├── aggregator/
│   └── index.ts          # Median, outlier filter, quorum
├── proofs/
│   └── index.ts          # Bundle creation, hashing, storage
└── kaspa-anchor/
    └── index.ts          # UTXO mgmt, tx build, sign, broadcast
```

## Payload Format

On-chain payloads are CBOR-encoded with the following structure:

```typescript
{
  v: 1,           // version
  t: 1706659200,  // timestamp (unix seconds)
  a: "BTC",       // asset
  p: 97500.00,    // price (USD)
  n: 2,           // number of sources
  d: 0.0001,      // dispersion ratio
  h: "sha256..."  // hash of full proof bundle
}
```

## Explorer

View transactions on Kaspa testnet-11 explorer:
https://explorer-tn11.kaspa.org/

## License

MIT
