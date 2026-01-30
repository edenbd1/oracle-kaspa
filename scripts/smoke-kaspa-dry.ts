import 'dotenv/config';
import websocket from 'websocket';
(globalThis as unknown as { WebSocket: unknown }).WebSocket = websocket.w3cwebsocket;

import { encode as cborEncode } from 'cbor-x';
import { AnchorPayload } from '../src/types.js';

async function main() {
  console.log('=== Kaspa Dry Run Smoke Test ===\n');

  const kaspa = await import('kaspa-wasm');
  // wRPC port: testnet-10=17210, testnet-11=17310, mainnet=17110
  const rpcUrl = process.env.KASPA_RPC_URL || 'ws://127.0.0.1:17210';
  const privateKeyHex = process.env.KASPA_PRIVATE_KEY;
  const networkId = process.env.KASPA_NETWORK || 'testnet-10';

  if (!privateKeyHex) {
    console.error('KASPA_PRIVATE_KEY environment variable is required');
    process.exit(1);
  }

  console.log(`Connecting to ${rpcUrl}...`);

  const rpc = new kaspa.RpcClient({
    url: rpcUrl,
    encoding: kaspa.Encoding.Borsh,
    networkId
  });

  try {
    await rpc.connect();
    console.log('Connected!');

    // Create private key and derive address
    const privateKey = new kaspa.PrivateKey(privateKeyHex);
    const address = privateKey.toKeypair().toAddress(networkId).toString();
    console.log(`Address: ${address}`);

    // Get UTXOs
    const { entries } = await rpc.getUtxosByAddresses({ addresses: [address] });
    console.log(`UTXOs: ${entries?.length || 0}`);

    if (!entries || entries.length === 0) {
      console.log('\nNo UTXOs available. Fund the address first.');
      console.log('Faucet: https://faucet-testnet-11.kaspa.org/');
      await rpc.disconnect();
      process.exit(1);
    }

    // UtxoEntryReference has .amount directly
    const balance = entries.reduce((sum: bigint, e: { amount: bigint }) =>
      sum + BigInt(e.amount || 0), 0n);
    console.log(`Balance: ${balance} sompi`);

    // Create test payload (only d, h, n, p - alphabetically sorted)
    const testPayload: AnchorPayload = {
      d: 0.0001,
      h: 'a'.repeat(16), // 16-char hash
      n: 2,
      p: 97500.00,
    };

    console.log('\nTest payload:', JSON.stringify(testPayload, null, 2));

    // Encode as CBOR
    const payloadBytes = cborEncode(testPayload);
    const payloadHex = Buffer.from(payloadBytes).toString('hex');
    console.log(`CBOR encoded (${payloadBytes.length} bytes): ${payloadHex}`);

    // Sort UTXOs by amount (ascending)
    const sortedEntries = [...entries].sort((a: { amount: bigint }, b: { amount: bigint }) =>
      a.amount > b.amount ? 1 : -1
    );

    // Try to create transaction (dry run - don't submit)
    console.log('\nCreating transaction (dry run)...');

    const { transactions, summary } = await kaspa.createTransactions({
      networkId,
      entries: sortedEntries,
      outputs: [{
        address,
        amount: kaspa.kaspaToSompi('1')!  // 1 KAS to cover payload storage mass
      }],
      changeAddress: address,
      priorityFee: kaspa.kaspaToSompi('0.0001')!,
      payload: payloadHex
    });

    console.log(`Created ${transactions.length} transaction(s)`);
    console.log('Summary:', summary);

    // Sign (but don't submit)
    for (const pending of transactions) {
      await pending.sign([privateKey]);
      console.log('Transaction signed successfully');
    }

    console.log('\n✓ Dry run successful! Transaction would be valid.');

    await rpc.disconnect();
  } catch (err) {
    console.error('Dry run FAILED:', err);
    process.exit(1);
  }
}

main();
