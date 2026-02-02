import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');
  
  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  const networkId = new kaspaWasm.NetworkId('testnet-10');
  const address = publicKey.toAddress(networkId);
  
  console.log('Address:', address.toString());
  console.log('Public key:', publicKey.toString());
  
  // Fetch UTXOs
  const apiBase = 'https://api-tn10.kaspa.org';
  const res = await fetch(`${apiBase}/addresses/${address.toString()}/utxos`);
  const utxos = await res.json();
  
  console.log('\nTotal UTXOs:', utxos.length);
  
  // Use the largest UTXO that's reasonable in size
  const sortedUtxos = utxos
    .map((u: any) => ({ ...u, amountN: BigInt(u.utxoEntry.amount) }))
    .sort((a: any, b: any) => Number(b.amountN - a.amountN));
  
  // Find one around 1 KAS
  const utxo = sortedUtxos.find((u: any) => u.amountN >= 50000000n && u.amountN <= 500000000n) || sortedUtxos[sortedUtxos.length - 1];
  
  console.log('\nUsing UTXO:');
  console.log('  txid:', utxo.outpoint.transactionId);
  console.log('  index:', utxo.outpoint.index);
  console.log('  amount:', utxo.amountN.toString(), 'sompi');
  console.log('  SPK:', utxo.utxoEntry.scriptPublicKey.scriptPublicKey);
  
  // Check that the scriptPublicKey matches our address
  const addressSpk = kaspaWasm.payToAddressScript(address);
  console.log('\nExpected SPK from our address:', addressSpk.script);
  console.log('Match:', utxo.utxoEntry.scriptPublicKey.scriptPublicKey === addressSpk.script);
  
  // Build a very simple transaction: send half to self
  const outputAmount = utxo.amountN / 2n;
  
  const generator = new kaspaWasm.Generator({
    entries: [{
      address: utxo.address,
      outpoint: {
        transactionId: utxo.outpoint.transactionId,
        index: utxo.outpoint.index
      },
      amount: utxo.amountN,
      scriptPublicKey: utxo.utxoEntry.scriptPublicKey.scriptPublicKey,
      blockDaaScore: BigInt(utxo.utxoEntry.blockDaaScore),
      isCoinbase: utxo.utxoEntry.isCoinbase
    }],
    outputs: new kaspaWasm.PaymentOutputs([{
      address: address.toString(),
      amount: outputAmount
    }]),
    priorityFee: 10000n,
    changeAddress: address,
    networkId: networkId,
    sigOpCount: 1,
    minimumSignatures: 1
  });
  
  const pendingTx = await generator.next();
  console.log('\nPending TX id:', pendingTx.id);
  
  // Check the pending tx before signing
  const preTx = pendingTx.transaction;
  const preSerialized = preTx.serializeToObject();
  console.log('Pre-sign sigScript:', preSerialized.inputs[0].signatureScript);
  
  // Sign
  pendingTx.signInput(0, privateKey);
  
  // Check after signing
  const signedTx = pendingTx.transaction;
  const serialized = signedTx.serializeToObject();
  console.log('Post-sign sigScript:', serialized.inputs[0].signatureScript);
  console.log('sigScript length:', serialized.inputs[0].signatureScript.length / 2, 'bytes');
  
  // Decode signature
  const sigScript = serialized.inputs[0].signatureScript;
  const sigLen = parseInt(sigScript.slice(0, 2), 16);
  console.log('\nSignature analysis:');
  console.log('  Length prefix:', sigLen, 'bytes expected');
  console.log('  Signature (first 32 bytes):', sigScript.slice(2, 66));
  console.log('  Signature (last 32 bytes):', sigScript.slice(66, 130));
  console.log('  Sighash type:', sigScript.slice(130, 132));
}

main().catch(console.error);
