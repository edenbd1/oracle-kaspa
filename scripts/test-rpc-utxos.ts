import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');

  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  const networkId = new kaspaWasm.NetworkId('testnet-10');
  const address = publicKey.toAddress(networkId);

  console.log('Address:', address.toString());

  // Connect to RPC
  const resolver = new kaspaWasm.Resolver();
  const rpc = new kaspaWasm.RpcClient({ resolver, networkId });
  await rpc.connect();

  // Get UTXOs
  console.log('\n=== getUtxosByAddresses ===');
  const result = await rpc.getUtxosByAddresses([address.toString()]);
  console.log('Result type:', typeof result);
  console.log('Result:', result);

  if (result && typeof result === 'object') {
    console.log('Keys:', Object.keys(result));

    // Check if it has entries property
    if (result.entries) {
      console.log('Entries:', result.entries);
      console.log('Entries length:', result.entries.length);
      if (result.entries.length > 0) {
        console.log('First entry:', JSON.stringify(result.entries[0], (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
      }
    }

    // Check if it's directly an array-like
    if (Array.isArray(result)) {
      console.log('Is array with', result.length, 'items');
    }

    // Check iterator
    if (typeof result[Symbol.iterator] === 'function') {
      console.log('Has iterator');
      const items = [...result];
      console.log('Spread items:', items.length);
    }
  }

  await rpc.disconnect();
}

main().catch(console.error);
