import websocket from 'websocket';
(globalThis as unknown as { WebSocket: unknown }).WebSocket = websocket.w3cwebsocket;

import { encode as cborEncode } from 'cbor-x';
import { AnchorPayload } from '../types.js';

// Type definitions for kaspa-wasm
interface UtxoEntryReference {
  amount: bigint;
  address: { toString(): string } | undefined;
  outpoint: { transactionId: string; index: number };
  isCoinbase: boolean;
  blockDaaScore: bigint;
}

interface PendingTransaction {
  sign(keys: unknown[]): Promise<void>;
  submit(rpc: unknown): Promise<string>;
}

interface TransactionSummary {
  finalAmount?: bigint;
  inputAmount?: bigint;
  fees?: bigint;
}

interface CreateTransactionsResult {
  transactions: PendingTransaction[];
  summary: TransactionSummary;
}

export class KaspaAnchor {
  private rpc: InstanceType<typeof import('kaspa-wasm').RpcClient> | null = null;
  private privateKey: InstanceType<typeof import('kaspa-wasm').PrivateKey> | null = null;
  private address: string = '';
  private networkId: string = 'testnet-10';
  private kaspaModule: typeof import('kaspa-wasm') | null = null;

  async connect(rpcUrl: string | undefined, privateKeyHex: string, networkId: string = 'testnet-10'): Promise<void> {
    // Dynamic import to handle WASM loading
    const kaspa = await import('kaspa-wasm');
    this.kaspaModule = kaspa;
    this.networkId = networkId;

    if (rpcUrl) {
      // Direct RPC URL (local node)
      this.rpc = new kaspa.RpcClient({
        url: rpcUrl,
        encoding: kaspa.Encoding.Borsh,
        networkId
      });
      console.log(`Connecting to Kaspa RPC: ${rpcUrl}`);
    } else {
      // Public node network via Resolver (auto-discovery + failover)
      this.rpc = new kaspa.RpcClient({
        resolver: new kaspa.Resolver(),
        networkId
      });
      console.log(`Connecting to Kaspa via public Resolver (${networkId})`);
    }
    await this.rpc.connect();

    this.privateKey = new kaspa.PrivateKey(privateKeyHex);
    this.address = this.privateKey.toKeypair().toAddress(networkId).toString();

    console.log(`Connected to Kaspa. Address: ${this.address}`);
  }

  getAddress(): string {
    return this.address;
  }

  async getBalance(): Promise<bigint> {
    if (!this.rpc) throw new Error('Not connected');
    const { entries } = await this.rpc.getUtxosByAddresses({ addresses: [this.address] });
    return (entries as UtxoEntryReference[]).reduce(
      (sum: bigint, e: UtxoEntryReference) => sum + BigInt(e.amount || 0),
      0n
    );
  }

  async anchor(payload: AnchorPayload): Promise<string | null> {
    if (!this.rpc || !this.kaspaModule || !this.privateKey) {
      console.error('Not connected');
      return null;
    }

    try {
      const kaspa = this.kaspaModule;

      // Encode payload as CBOR (with sorted keys for determinism)
      const MAX_PAYLOAD_BYTES = 80;
      const sorted: Record<string, unknown> = {};
      const payloadObj = payload as unknown as Record<string, unknown>;
      Object.keys(payloadObj).sort().forEach(k => sorted[k] = payloadObj[k]);
      const payloadBytes = cborEncode(sorted);
      if (payloadBytes.length > MAX_PAYLOAD_BYTES) {
        console.error(`Payload too large: ${payloadBytes.length} bytes (max ${MAX_PAYLOAD_BYTES})`);
        return null;
      }
      const payloadHex = Buffer.from(payloadBytes).toString('hex');

      // Get UTXOs
      const { entries } = await this.rpc.getUtxosByAddresses({ addresses: [this.address] });
      if (!entries || entries.length === 0) {
        console.error('No UTXOs available');
        return null;
      }

      // Sort UTXOs by amount (descending) - spend large first to consolidate small UTXOs
      const sortedEntries = [...entries].sort((a, b) =>
        a.amount < b.amount ? 1 : -1
      );

      // Create transaction with payload using createTransactions
      // Note: Output amount must be >= storage mass cost for the payload
      const result = await kaspa.createTransactions({
        networkId: this.networkId,
        entries: sortedEntries,
        outputs: [{
          address: this.address,
          amount: kaspa.kaspaToSompi('1')!  // 1 KAS to cover payload storage mass
        }],
        changeAddress: this.address,
        priorityFee: kaspa.kaspaToSompi('0.0001')!,
        payload: payloadHex
      }) as unknown as CreateTransactionsResult;

      const { transactions } = result;

      // Sign and submit
      for (const pending of transactions) {
        await pending.sign([this.privateKey]);
        const txId = await pending.submit(this.rpc);
        return txId;
      }

      return null;
    } catch (err) {
      console.error('Anchor failed:', err);
      return null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.rpc) {
      await this.rpc.disconnect();
    }
  }

  /**
   * Get health status for API endpoint.
   * Returns null for fields that fail to fetch (never throws).
   */
  async getHealthInfo(): Promise<{
    utxo_count: number | null;
    balance_sompi: string | null;
    is_synced: boolean | null;
    virtual_daa_score: string | null;
  }> {
    const result = {
      utxo_count: null as number | null,
      balance_sompi: null as string | null,
      is_synced: null as boolean | null,
      virtual_daa_score: null as string | null
    };

    if (!this.rpc) return result;

    try {
      const { entries } = await this.rpc.getUtxosByAddresses({ addresses: [this.address] });
      if (entries) {
        result.utxo_count = entries.length;
        const balance = (entries as Array<{ amount: bigint }>).reduce(
          (sum, e) => sum + BigInt(e.amount || 0), 0n
        );
        result.balance_sompi = balance.toString();
      }
    } catch { /* ignore */ }

    try {
      const syncStatus = await this.rpc.getSyncStatus();
      result.is_synced = (syncStatus as { isSynced?: boolean })?.isSynced ?? null;
    } catch { /* ignore */ }

    try {
      const dagInfo = await this.rpc.getBlockDagInfo();
      const score = (dagInfo as { virtualDaaScore?: bigint })?.virtualDaaScore;
      result.virtual_daa_score = score !== undefined ? score.toString() : null;
    } catch { /* ignore */ }

    return result;
  }
}
