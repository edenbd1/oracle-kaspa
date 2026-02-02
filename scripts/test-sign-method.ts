import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');
  
  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  const networkId = new kaspaWasm.NetworkId('testnet-10');
  const address = publicKey.toAddress(networkId);
  
  console.log('Address:', address.toString());
  
  // Fetch UTXOs
  const apiBase = 'https://api-tn10.kaspa.org';
  const res = await fetch(`${apiBase}/addresses/${address.toString()}/utxos`);
  const utxos = await res.json();
  
  const utxo = utxos.find((u: any) => {
    const amt = BigInt(u.utxoEntry.amount);
    return amt >= 50000000n && amt <= 500000000n;
  });
  
  console.log('Using UTXO:', utxo.outpoint.transactionId);
  
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
  
  // Try the sign method (instead of signInput)
  console.log('\nTrying sign([privateKey])...');
  try {
    pendingTx.sign([privateKey]);
    console.log('sign() succeeded!');
    
    const signedTx = pendingTx.transaction;
    const serialized = signedTx.serializeToObject();
    console.log('sigScript:', serialized.inputs[0].signatureScript);
    
    // Submit via RPC
    console.log('\nConnecting to RPC...');
    const resolver = new kaspaWasm.Resolver();
    const rpc = new kaspaWasm.RpcClient({ resolver, networkId });
    await rpc.connect();
    console.log('Connected!');
    
    console.log('Submitting...');
    const result = await pendingTx.submit(rpc);
    console.log('Submit result:', result);
    
    await rpc.disconnect();
  } catch (e: any) {
    console.log('Error:', e.message || e);
  }
}

main().catch(console.error);
