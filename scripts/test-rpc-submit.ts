import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');
  
  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  const networkId = new kaspaWasm.NetworkId('testnet-10');
  const address = publicKey.toAddress(networkId);
  
  console.log('Address:', address.toString());
  
  // Create RpcClient
  console.log('\nCreating RPC client...');
  const resolver = new kaspaWasm.Resolver();
  const rpc = new kaspaWasm.RpcClient({
    resolver,
    networkId
  });
  
  console.log('Connecting...');
  await rpc.connect();
  console.log('Connected!');
  
  // Get server info
  try {
    const info = await rpc.getServerInfo();
    console.log('Server info:', info);
  } catch (e) {
    console.log('getServerInfo not available');
  }
  
  // Fetch UTXOs from API
  const apiBase = 'https://api-tn10.kaspa.org';
  const res = await fetch(`${apiBase}/addresses/${address.toString()}/utxos`);
  const utxos = await res.json();
  
  const utxo = utxos.find((u: any) => {
    const amt = BigInt(u.utxoEntry.amount);
    return amt >= 50000000n && amt <= 500000000n;
  });
  
  console.log('\nUsing UTXO:', utxo.outpoint.transactionId);
  
  const generator = new kaspaWasm.Generator({
    entries: [{
      address: utxo.address,
      outpoint: {
        transactionId: utxo.outpoint.transactionId,
        index: utxo.outpoint.index
      },
      amount: BigInt(utxo.utxoEntry.amount),
      scriptPublicKey: utxo.utxoEntry.scriptPublicKey.scriptPublicKey,
      blockDaaScore: BigInt(utxo.utxoEntry.blockDaaScore),
      isCoinbase: utxo.utxoEntry.isCoinbase
    }],
    outputs: new kaspaWasm.PaymentOutputs([{
      address: address.toString(),
      amount: BigInt(utxo.utxoEntry.amount) / 2n
    }]),
    priorityFee: 10000n,
    changeAddress: address,
    networkId: networkId,
    sigOpCount: 1,
    minimumSignatures: 1
  });
  
  const pendingTx = await generator.next();
  console.log('TX id:', pendingTx.id);
  
  // Sign
  pendingTx.signInput(0, privateKey);
  console.log('Signed!');
  
  // Submit via RPC
  console.log('\nSubmitting via RPC...');
  try {
    const result = await pendingTx.submit(rpc);
    console.log('Submit result:', result);
  } catch (e: any) {
    console.log('Submit error:', e.message || e);
  }
  
  await rpc.disconnect();
}

main().catch(console.error);
