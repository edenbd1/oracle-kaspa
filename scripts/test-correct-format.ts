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
  
  // Create transaction with correct SPK format
  const result = await kaspaWasm.createTransactions({
    entries: [{
      address: utxo.address,
      outpoint: {
        transactionId: utxo.outpoint.transactionId,
        index: utxo.outpoint.index
      },
      amount: BigInt(utxo.utxoEntry.amount),
      // Use correct format: { script, version }
      scriptPublicKey: {
        script: utxo.utxoEntry.scriptPublicKey.scriptPublicKey,
        version: 0
      },
      blockDaaScore: BigInt(utxo.utxoEntry.blockDaaScore),
      isCoinbase: utxo.utxoEntry.isCoinbase
    }],
    outputs: [{
      address: address.toString(),
      amount: BigInt(utxo.utxoEntry.amount) / 2n
    }],
    priorityFee: 10000n,
    changeAddress: address.toString(),
    networkId: 'testnet-10'
  });
  
  const tx = result.transactions[0].transaction;
  console.log('TX id:', tx.id);
  
  // Verify the SPK version
  const inp = tx.inputs[0];
  console.log('Input SPK version:', inp.utxo.scriptPublicKey.version);
  console.log('Input SPK script:', inp.utxo.scriptPublicKey.script.slice(0, 20) + '...');
  
  // Try signing
  console.log('\nSigning transaction...');
  try {
    kaspaWasm.signTransaction(tx, [privateKey], true);
    console.log('Signing succeeded!');
    
    const serialized = tx.serializeToObject();
    console.log('Signature script:', serialized.inputs[0].signatureScript);
    
    // Submit via RPC
    console.log('\nConnecting to RPC...');
    const resolver = new kaspaWasm.Resolver();
    const rpc = new kaspaWasm.RpcClient({ resolver, networkId });
    await rpc.connect();
    console.log('Connected!');
    
    console.log('Submitting...');
    const submitResult = await rpc.submitTransaction({ transaction: tx });
    console.log('Submit result:', submitResult);
    
    await rpc.disconnect();
    
  } catch (e: any) {
    console.log('Error:', e.message || e);
  }
}

main().catch(console.error);
