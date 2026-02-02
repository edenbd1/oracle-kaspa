import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');
  const kasplexModule = await import('kasplexbuilder');
  const { Inscription } = kasplexModule;
  
  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  const xOnlyPubKey = publicKey.toXOnlyPublicKey();
  const networkId = new kaspaWasm.NetworkId('testnet-10');
  const address = publicKey.toAddress(networkId);
  
  // Create inscription
  const inscription = new Inscription('mint', { tick: 'YBTCA' });
  const script = new kaspaWasm.ScriptBuilder();
  inscription.write(script, xOnlyPubKey.toString());
  const redeemScriptHex = script.drain();
  
  // Use a recent commit
  const commitTxId = 'ee8c237fd7056c859c79d1009ba41d8e39420ff73f6df24a756abfca9e66b8b8';
  const inputAmount = 50000000n;
  const outputAmount = 49990000n;
  
  console.log('Redeem script:', redeemScriptHex.slice(0, 40) + '...');
  console.log('Redeem script length:', redeemScriptHex.length / 2, 'bytes');
  
  // The trick: create a "fake" UTXO that uses the redeem script as its scriptPublicKey
  // This way, createTransactions will compute the sighash using the redeem script
  // which is exactly what we need for P2SH!
  
  // Create a fake address that will make the UTXO selection work
  // We use the platform address but with the redeem script
  
  const utxoEntry = {
    address: address.toString(),  // Use our address so it passes validation
    outpoint: {
      transactionId: commitTxId,
      index: 0
    },
    amount: inputAmount,
    // Key: use redeem script as scriptPublicKey
    // This makes the sighash use the redeem script, which is correct for P2SH
    scriptPublicKey: {
      script: redeemScriptHex,
      version: 0
    },
    blockDaaScore: 0n,
    isCoinbase: false
  };
  
  console.log('\n=== Creating transaction with fake UTXO ===');
  
  try {
    const result = await kaspaWasm.createTransactions({
      entries: [utxoEntry],
      outputs: [{
        address: address.toString(),
        amount: outputAmount
      }],
      priorityFee: 10000n,
      changeAddress: address.toString(),
      networkId: 'testnet-10'
    });
    
    console.log('Transaction created!');
    console.log('TX count:', result.transactions.length);
    
    const tx = result.transactions[0].transaction;
    console.log('TX id:', tx.id);
    
    // Check the UTXO in the transaction
    const serialized = tx.serializeToObject();
    console.log('Input utxo spk:', serialized.inputs[0].utxo?.scriptPublicKey);
    
    // Sign the transaction
    console.log('\n=== Signing ===');
    kaspaWasm.signTransaction(tx, [privateKey], true);
    console.log('Signed!');
    
    // Get the signature
    const signedSerialized = tx.serializeToObject();
    const signature = signedSerialized.inputs[0].signatureScript;
    console.log('Signature:', signature.slice(0, 40) + '...');
    
    // Now build the P2SH unlock script
    console.log('\n=== Building P2SH unlock script ===');
    const p2shSigScript = kaspaWasm.payToScriptHashSignatureScript(redeemScriptHex, signature);
    console.log('P2SH sig script:', p2shSigScript.slice(0, 40) + '...');
    console.log('P2SH sig script length:', p2shSigScript.length / 2, 'bytes');
    
    // Create the final reveal transaction
    console.log('\n=== Creating final reveal TX ===');
    
    const finalInput = new kaspaWasm.TransactionInput({
      previousOutpoint: new kaspaWasm.TransactionOutpoint(new kaspaWasm.Hash(commitTxId), 0),
      signatureScript: new Uint8Array(Buffer.from(p2shSigScript, 'hex')),
      sequence: 0,
      sigOpCount: 1
    });
    
    const destSpkData = kaspaWasm.payToAddressScript(address);
    const finalOutput = new kaspaWasm.TransactionOutput(
      outputAmount,
      new kaspaWasm.ScriptPublicKey(destSpkData.version, new Uint8Array(Buffer.from(destSpkData.script, 'hex')))
    );
    
    const finalTx = new kaspaWasm.Transaction({
      inputs: [finalInput],
      outputs: [finalOutput],
      version: 0,
      lockTime: 0n,
      subnetworkId: '0000000000000000000000000000000000000000',
      gas: 0n,
      payload: ''
    });
    
    console.log('Final TX id:', finalTx.id);
    
    // Submit!
    console.log('\n=== Submitting ===');
    const resolver = new kaspaWasm.Resolver();
    const rpc = new kaspaWasm.RpcClient({ resolver, networkId });
    await rpc.connect();
    
    const submitResult = await rpc.submitTransaction({ transaction: finalTx });
    console.log('SUCCESS! TxID:', submitResult.transactionId);
    
    await rpc.disconnect();
    
  } catch (e: any) {
    console.log('Error:', e.message || e);
    if (e.stack) console.log(e.stack.split('\n').slice(0, 5).join('\n'));
  }
}

main().catch(console.error);
