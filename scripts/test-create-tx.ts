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
  console.log('Amount:', utxo.utxoEntry.amount);
  
  // Check createTransaction
  console.log('\ncreateTransaction:', typeof kaspaWasm.createTransaction);
  
  // Try using createTransactions (plural)
  console.log('createTransactions:', typeof kaspaWasm.createTransactions);
  
  // Let's check what createTransactions returns
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
  
  console.log('\nTrying createTransactions...');
  try {
    const result = kaspaWasm.createTransactions({
      entries: utxoEntries,
      outputs: [{
        address: address.toString(),
        amount: BigInt(utxo.utxoEntry.amount) / 2n
      }],
      priorityFee: 10000n,
      changeAddress: address.toString(),
      networkId: 'testnet-10'
    });
    
    console.log('createTransactions result:', result);
    console.log('Type:', result?.constructor?.name);
    
    // If it's a promise
    if (result && result.then) {
      const resolved = await result;
      console.log('Resolved:', resolved);
    }
    
    // If it's an array or iterable
    if (Array.isArray(result)) {
      console.log('Is array, length:', result.length);
      if (result[0]) {
        console.log('First item type:', result[0]?.constructor?.name);
        console.log('First item:', result[0]);
      }
    }
    
  } catch (e: any) {
    console.log('Error:', e.message || e);
  }
}

main().catch(console.error);
