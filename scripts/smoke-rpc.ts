import 'dotenv/config';
import websocket from 'websocket';
(globalThis as unknown as { WebSocket: unknown }).WebSocket = websocket.w3cwebsocket;

async function main() {
  const kaspa = await import('kaspa-wasm');
  // wRPC port: testnet-10=17210, testnet-11=17310, mainnet=17110
  const rpcUrl = process.env.KASPA_RPC_URL || 'ws://127.0.0.1:17210';
  const networkId = process.env.KASPA_NETWORK || 'testnet-10';

  console.log(`Connecting to ${rpcUrl} (network: ${networkId})...`);

  const rpc = new kaspa.RpcClient({
    url: rpcUrl,
    encoding: kaspa.Encoding.Borsh,
    networkId
  });

  try {
    await rpc.connect();
    console.log('Connected!');

    const info = await rpc.getServerInfo();
    // BigInt serialization helper
    const replacer = (_key: string, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value;
    console.log('Server info:', JSON.stringify(info, replacer, 2));

    // Test UTXO query (requires --utxoindex on node)
    const address = process.env.KASPA_ADDRESS;
    if (address) {
      const { entries } = await rpc.getUtxosByAddresses({ addresses: [address] });
      console.log(`UTXOs for ${address}: ${entries?.length || 0}`);
      if (entries && entries.length > 0) {
        // UtxoEntryReference has .amount directly
        const balance = entries.reduce((sum: bigint, e: { amount: bigint }) =>
          sum + BigInt(e.amount || 0), 0n);
        console.log(`Balance: ${balance} sompi`);
      }
    } else {
      console.log('No KASPA_ADDRESS set, skipping UTXO query');
    }

    await rpc.disconnect();
    console.log('RPC smoke test passed!');
  } catch (err) {
    console.error('RPC smoke test FAILED:', err);
    process.exit(1);
  }
}

main();
