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
  
  // Commit info
  const commitTxId = 'ee8c237fd7056c859c79d1009ba41d8e39420ff73f6df24a756abfca9e66b8b8';
  const inputAmount = 50000000n;
  const outputAmount = 49990000n;
  
  // Build transaction
  const commitTxIdHash = new kaspaWasm.Hash(commitTxId);
  const outpoint = new kaspaWasm.TransactionOutpoint(commitTxIdHash, 0);
  
  const input = new kaspaWasm.TransactionInput({
    previousOutpoint: outpoint,
    signatureScript: new Uint8Array(),
    sequence: 0,
    sigOpCount: 1
  });
  
  const destSpkData = kaspaWasm.payToAddressScript(address);
  const destScriptBytes = new Uint8Array(Buffer.from(destSpkData.script, 'hex'));
  const destSPK = new kaspaWasm.ScriptPublicKey(destSpkData.version, destScriptBytes);
  const output = new kaspaWasm.TransactionOutput(outputAmount, destSPK);
  
  const tx = new kaspaWasm.Transaction({
    inputs: [input],
    outputs: [output],
    version: 0,
    lockTime: 0n,
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: 0n,
    payload: ''
  });
  
  console.log('TX id:', tx.id);
  
  // Compute hash using TransactionSigningHash
  const sigHash = new kaspaWasm.TransactionSigningHash();
  sigHash.update(tx);
  const hash = sigHash.finalize();
  console.log('TX hash:', hash);
  
  // Try signing with signScriptHash
  console.log('\n=== signScriptHash ===');
  
  // signScriptHash expects a hash (probably as a Hash object or hex string)
  try {
    // Try with hex string
    const signature = kaspaWasm.signScriptHash(hash, privateKey);
    console.log('Signature type:', typeof signature);
    console.log('Signature:', signature);
    
    if (signature instanceof Uint8Array) {
      const sigHex = Buffer.from(signature).toString('hex');
      console.log('Signature hex:', sigHex);
      console.log('Signature length:', sigHex.length / 2, 'bytes');
      
      // Try to build P2SH sig script
      const p2shSigScript = kaspaWasm.payToScriptHashSignatureScript(redeemScriptHex, sigHex);
      console.log('\nP2SH sig script:', p2shSigScript.slice(0, 40) + '...');
      
      // Create final transaction
      const finalInput = new kaspaWasm.TransactionInput({
        previousOutpoint: outpoint,
        signatureScript: new Uint8Array(Buffer.from(p2shSigScript, 'hex')),
        sequence: 0,
        sigOpCount: 1
      });
      
      const finalTx = new kaspaWasm.Transaction({
        inputs: [finalInput],
        outputs: [output],
        version: 0,
        lockTime: 0n,
        subnetworkId: '0000000000000000000000000000000000000000',
        gas: 0n,
        payload: ''
      });
      
      console.log('\nFinal TX id:', finalTx.id);
      
      // Submit
      console.log('\n=== Submitting ===');
      const resolver = new kaspaWasm.Resolver();
      const rpc = new kaspaWasm.RpcClient({ resolver, networkId });
      await rpc.connect();
      
      const submitResult = await rpc.submitTransaction({ transaction: finalTx });
      console.log('SUCCESS! TxID:', submitResult.transactionId);
      
      await rpc.disconnect();
    }
    
  } catch (e: any) {
    console.log('Error:', e.message || e);
  }
}

main().catch(console.error);
