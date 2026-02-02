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
  
  // Find a small UTXO
  const smallUtxos = utxos
    .map((u: any) => ({ ...u, amountN: BigInt(u.utxoEntry.amount) }))
    .filter((u: any) => u.amountN >= 50000000n && u.amountN <= 200000000n)
    .sort((a: any, b: any) => Number(a.amountN - b.amountN));
    
  const utxo = smallUtxos[0];
  const utxoEntries = [{
    address: utxo.address,
    outpoint: {
      transactionId: utxo.outpoint.transactionId,
      index: utxo.outpoint.index
    },
    amount: utxo.amountN,
    scriptPublicKey: utxo.utxoEntry.scriptPublicKey.scriptPublicKey,
    blockDaaScore: BigInt(utxo.utxoEntry.blockDaaScore),
    isCoinbase: utxo.utxoEntry.isCoinbase
  }];
  
  console.log('Using UTXO:', utxoEntries[0].amount.toString(), 'sompi');
  
  const outputAmount = utxoEntries[0].amount / 2n;
  
  const outputs = new kaspaWasm.PaymentOutputs([{
    address: address.toString(),
    amount: outputAmount
  }]);
  
  const generator = new kaspaWasm.Generator({
    entries: utxoEntries,
    outputs: outputs,
    priorityFee: 10000n,
    changeAddress: address,
    networkId: networkId,
    sigOpCount: 1,
    minimumSignatures: 1
  });
  
  let tx;
  while ((tx = await generator.next())) {
    console.log('TX id:', tx.id);
    console.log('Amounts - input:', tx.aggregateInputAmount.toString(), 
                'payment:', tx.paymentAmount.toString(),
                'change:', tx.changeAmount.toString(),
                'fee:', tx.feeAmount.toString());
    
    // Try sign and catch full error
    try {
      tx.sign([privateKey]);
      console.log('Sign successful!');
    } catch (e) {
      console.log('Sign error object:', e);
      console.log('Sign error type:', typeof e);
      if (e && typeof e === 'object') {
        console.log('Error keys:', Object.keys(e));
      }
    }
    
    // Check tx.transaction property
    console.log('\ntx.transaction:', typeof tx.transaction);
    const innerTx = tx.transaction;
    console.log('Inner TX:', innerTx?.constructor?.name);
    
    // Try signInput method
    console.log('\nTrying signInput(0, privateKey)...');
    try {
      tx.signInput(0, privateKey);
      console.log('signInput successful!');
    } catch (e: any) {
      console.log('signInput error:', e?.message || e);
    }
    
    // Try createInputSignature on pending tx
    console.log('\nTrying createInputSignature...');
    try {
      const sig = tx.createInputSignature(0, privateKey);
      console.log('Signature created, length:', sig?.length);
      
      // Now fill the input with the signature
      console.log('Filling input with signature...');
      tx.fillInput(0, sig);
      console.log('Input filled!');
      
      // Get the transaction
      const signedTx = tx.transaction;
      console.log('Signed TX id:', signedTx.id);
      
      // Serialize
      const serialized = signedTx.serializeToObject();
      console.log('\n=== Signed TX ===');
      console.log('Inputs:', serialized.inputs?.length);
      console.log('Outputs:', serialized.outputs?.length);
      console.log('Sig script:', serialized.inputs?.[0]?.signatureScript?.slice(0, 50) + '...');
      
    } catch (e: any) {
      console.log('createInputSignature error:', e?.message || e);
    }
    
    break;
  }
}

main().catch(console.error);
