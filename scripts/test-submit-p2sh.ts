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
  
  console.log('Redeem script:', redeemScriptHex.slice(0, 40) + '...');
  console.log('Length:', redeemScriptHex.length / 2, 'bytes');
  
  // Commit info
  const commitTxId = 'ee8c237fd7056c859c79d1009ba41d8e39420ff73f6df24a756abfca9e66b8b8';
  const outputAmount = 49990000n;
  
  // Build transaction
  const outpoint = new kaspaWasm.TransactionOutpoint(new kaspaWasm.Hash(commitTxId), 0);
  
  const destSpkData = kaspaWasm.payToAddressScript(address);
  const destScriptBytes = new Uint8Array(Buffer.from(destSpkData.script, 'hex'));
  const destSPK = new kaspaWasm.ScriptPublicKey(destSpkData.version, destScriptBytes);
  const output = new kaspaWasm.TransactionOutput(outputAmount, destSPK);
  
  // Create empty tx for hash computation
  const input = new kaspaWasm.TransactionInput({
    previousOutpoint: outpoint,
    signatureScript: new Uint8Array(),
    sequence: 0,
    sigOpCount: 1
  });
  
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
  
  // Compute hash
  const sigHash = new kaspaWasm.TransactionSigningHash();
  sigHash.update(tx);
  const hash = sigHash.finalize();
  console.log('Hash:', hash);
  
  // Sign
  const signature = kaspaWasm.signScriptHash(hash, privateKey);
  console.log('Signature:', signature.slice(0, 40) + '...');
  
  // Build P2SH sig script
  const p2shSigScript = kaspaWasm.payToScriptHashSignatureScript(redeemScriptHex, signature);
  console.log('P2SH sig script:', p2shSigScript.slice(0, 60) + '...');
  console.log('P2SH sig script length:', p2shSigScript.length / 2, 'bytes');
  
  // Parse the P2SH sig script to understand its structure
  console.log('\nP2SH sig script analysis:');
  const bytes = Buffer.from(p2shSigScript, 'hex');
  console.log('  First byte (sig push):', bytes[0].toString(16));
  console.log('  Bytes 1-65 (sig):', bytes.slice(1, 66).toString('hex').slice(0, 40) + '...');
  if (bytes.length > 66) {
    console.log('  Byte 66 (script push):', bytes[66].toString(16));
    console.log('  Rest (script):', bytes.slice(67).toString('hex').slice(0, 40) + '...');
  }
  
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
  
  try {
    const submitResult = await rpc.submitTransaction({ transaction: finalTx });
    console.log('SUCCESS! TxID:', submitResult.transactionId);
  } catch (e: any) {
    console.log('Submit error:', e.message || e);
  }
  
  await rpc.disconnect();
}

main().catch(console.error);
