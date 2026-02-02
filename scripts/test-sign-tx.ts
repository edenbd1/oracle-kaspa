import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');
  
  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  const address = publicKey.toAddress('testnet-10');
  
  console.log('Platform address:', address.toString());
  
  // Fetch UTXOs
  const apiBase = 'https://api-tn10.kaspa.org';
  const res = await fetch(`${apiBase}/addresses/${address.toString()}/utxos`);
  const utxos = await res.json();
  console.log('UTXOs:', utxos.length);
  
  if (utxos.length === 0) {
    console.log('No UTXOs');
    return;
  }
  
  const utxo = utxos[0];
  console.log('Using UTXO:', JSON.stringify(utxo, null, 2));
  
  // Create simple transaction: send to self
  const amount = BigInt(utxo.utxoEntry.amount);
  const fee = 10000n;
  const outputAmount = amount - fee;
  
  // Create input
  const txIdHash = new kaspaWasm.Hash(utxo.outpoint.transactionId);
  const outpoint = new kaspaWasm.TransactionOutpoint(txIdHash, utxo.outpoint.index);
  const input = new kaspaWasm.TransactionInput({
    previousOutpoint: outpoint,
    signatureScript: new Uint8Array(),
    sequence: 0,
    sigOpCount: 1
  });
  
  // Create output using payToAddressScript
  const spkData = kaspaWasm.payToAddressScript(address);
  console.log('SPK data:', spkData);
  
  const scriptBytes = new Uint8Array(Buffer.from(spkData.script, 'hex'));
  const spk = new kaspaWasm.ScriptPublicKey(spkData.version, scriptBytes);
  const output = new kaspaWasm.TransactionOutput(outputAmount, spk);
  
  // Create transaction
  const tx = new kaspaWasm.Transaction({
    inputs: [input],
    outputs: [output],
    version: 0,
    lockTime: 0n,
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: 0n,
    payload: ''
  });
  
  console.log('\nTransaction created:', tx.id);
  console.log('TX JSON:', JSON.stringify(tx.serializeToObject(), null, 2));
  
  // Try signTransaction
  console.log('\nTrying signTransaction...');
  try {
    const signed = kaspaWasm.signTransaction(tx, [privateKey], true);
    console.log('signTransaction result:', signed);
  } catch (e) {
    console.log('signTransaction error:', e);
  }
  
  // Maybe we need to create TransactionUtxoEntry for each input
  console.log('\nTrying with TransactionUtxoEntry...');
  
  // TransactionUtxoEntry constructor?
  console.log('TransactionUtxoEntry:', Object.getOwnPropertyNames(kaspaWasm.TransactionUtxoEntry.prototype));
  
  // Check if we can create one from raw data
  const utxoSpkHex = utxo.utxoEntry.scriptPublicKey.scriptPublicKey;
  console.log('UTXO SPK hex:', utxoSpkHex);
  
  // Maybe need to attach utxo entries to the transaction before signing?
  console.log('\n=== Checking if tx has setUtxoEntries method ===');
  console.log('TX prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(tx)));
}

main().catch(console.error);
