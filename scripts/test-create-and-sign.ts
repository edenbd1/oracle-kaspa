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
  
  const utxoEntries = [{
    address: utxo.address,
    outpoint: {
      transactionId: utxo.outpoint.transactionId,
      index: utxo.outpoint.index
    },
    amount: BigInt(utxo.utxoEntry.amount),
    scriptPublicKey: utxo.utxoEntry.scriptPublicKey.scriptPublicKey,
    blockDaaScore: BigInt(utxo.utxoEntry.blockDaaScore),
    isCoinbase: utxo.utxoEntry.isCoinbase
  }];
  
  const result = await kaspaWasm.createTransactions({
    entries: utxoEntries,
    outputs: [{
      address: address.toString(),
      amount: BigInt(utxo.utxoEntry.amount) / 2n
    }],
    priorityFee: 10000n,
    changeAddress: address.toString(),
    networkId: 'testnet-10'
  });
  
  console.log('Created', result.transactions.length, 'transactions');
  
  const txData = result.transactions[0];
  console.log('TX id:', txData.id);
  console.log('TX type:', txData.type);
  
  // Check the transaction object
  const tx = txData.transaction;
  console.log('\nTransaction object:');
  console.log('  type:', tx?.constructor?.name);
  console.log('  methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(tx)));
  
  // Check if it's serializable
  if (tx.serializeToObject) {
    const serialized = tx.serializeToObject();
    console.log('\nPre-sign serialized:');
    console.log('  inputs:', serialized.inputs?.length);
    console.log('  input sigScript:', serialized.inputs?.[0]?.signatureScript || '(empty)');
  }
  
  // Try signTransaction function
  console.log('\nTrying signTransaction...');
  try {
    kaspaWasm.signTransaction(tx, [privateKey], true);
    console.log('signTransaction succeeded!');
    
    const signedSerialized = tx.serializeToObject();
    console.log('Post-sign sigScript:', signedSerialized.inputs[0].signatureScript);
  } catch (e: any) {
    console.log('signTransaction error:', e.message || e);
  }
  
  // Now try to submit via RPC
  console.log('\nConnecting to RPC...');
  const resolver = new kaspaWasm.Resolver();
  const rpc = new kaspaWasm.RpcClient({ resolver, networkId });
  await rpc.connect();
  console.log('Connected!');
  
  // Check if there's a submitTransaction method on rpc
  console.log('RPC methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(rpc)).filter(m => m.includes('submit') || m.includes('Transaction')));
  
  // Try to find how to submit
  if (typeof rpc.submitTransaction === 'function') {
    console.log('\nSubmitting via rpc.submitTransaction...');
    try {
      const submitResult = await rpc.submitTransaction({ transaction: tx });
      console.log('Submit result:', submitResult);
    } catch (e: any) {
      console.log('Submit error:', e.message || e);
    }
  }
  
  await rpc.disconnect();
}

main().catch(console.error);
