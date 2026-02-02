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
  
  // Create transaction with createTransactions
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
  
  const tx = result.transactions[0].transaction;
  console.log('TX id:', tx.id);
  
  // Check the tx inputs for utxo property
  const serialized = tx.serializeToObject();
  console.log('\nInput utxo:', serialized.inputs[0].utxo);
  
  // Check if there's a way to get entries from result
  console.log('\nResult keys:', Object.keys(result.transactions[0]));
  
  // Try using createInputSignature
  console.log('\n=== Trying createInputSignature ===');
  console.log('createInputSignature:', typeof kaspaWasm.createInputSignature);
  
  // For createInputSignature, we might need to set up utxo entries on the tx first
  // Let's check what the input has
  const inputs = tx.inputs;
  console.log('tx.inputs:', inputs);
  console.log('tx.inputs length:', inputs?.length);
  
  // Check if inputs have utxo
  if (inputs && inputs.length > 0) {
    console.log('First input:', inputs[0]);
    console.log('First input utxo:', inputs[0]?.utxo);
  }
  
  // Try to manually create a signature
  console.log('\n=== Trying manual signature ===');
  
  // Create the signature using TransactionSigningHash
  console.log('TransactionSigningHash:', typeof kaspaWasm.TransactionSigningHash);
  
  // Let's see what we need
  const sigHash = new kaspaWasm.TransactionSigningHash();
  console.log('SigHash methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(sigHash)));
}

main().catch(console.error);
