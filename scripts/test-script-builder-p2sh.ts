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

  // Get redeem script before drain
  console.log('=== Script before drain ===');
  console.log('hexView:', script.hexView());

  const redeemScriptHex = script.drain();
  console.log('Redeem script:', redeemScriptHex.slice(0, 40) + '...');
  console.log('Redeem script length:', redeemScriptHex.length / 2, 'bytes');

  // Check encodePayToScriptHashSignatureScript
  console.log('\n=== encodePayToScriptHashSignatureScript ===');

  // Create a new ScriptBuilder with the redeem script
  const redeemScript = new kaspaWasm.ScriptBuilder();
  redeemScript.addData(Buffer.from(redeemScriptHex, 'hex'));

  // Check method signature
  console.log('Method exists:', typeof redeemScript.encodePayToScriptHashSignatureScript);

  // Try calling it
  // It might take a signature as parameter
  const testSig = new Uint8Array(65).fill(0x42);
  const testSigHex = Buffer.from(testSig).toString('hex');

  try {
    // Try with hex string
    const encoded = (redeemScript as any).encodePayToScriptHashSignatureScript(testSigHex);
    console.log('Encoded (hex string):', encoded?.slice(0, 40) + '...');
  } catch (e: any) {
    console.log('hex string failed:', e.message);
  }

  try {
    // Try with Uint8Array
    const encoded = (redeemScript as any).encodePayToScriptHashSignatureScript(testSig);
    console.log('Encoded (Uint8Array):', encoded?.slice(0, 40) + '...');
  } catch (e: any) {
    console.log('Uint8Array failed:', e.message);
  }

  // Let's rebuild the script and try encode
  console.log('\n=== Rebuild script and encode ===');
  const inscription2 = new Inscription('mint', { tick: 'YBTCA' });
  const script2 = new kaspaWasm.ScriptBuilder();
  inscription2.write(script2, xOnlyPubKey.toString());

  try {
    const encoded = script2.encodePayToScriptHashSignatureScript(testSigHex);
    console.log('Encoded:', encoded?.slice(0, 60) + '...');
    console.log('Encoded length:', encoded?.length / 2, 'bytes');
  } catch (e: any) {
    console.log('Failed:', e.message);
  }

  // Now let's try a complete flow:
  // 1. Create the reveal transaction
  // 2. Compute the sighash using TransactionSigningHash
  // 3. Sign with signScriptHash
  // 4. Encode using encodePayToScriptHashSignatureScript or payToScriptHashSignatureScript
  console.log('\n=== Complete P2SH flow ===');

  const commitTxId = '2a20c496408389953bbdc79c311ba6c8809684fe9d9c4f7ddcc5899deac1855b';
  const inputAmount = 50000000n;
  const outputAmount = 49990000n;

  // Create the reveal transaction (unsigned)
  const outpoint = new kaspaWasm.TransactionOutpoint(new kaspaWasm.Hash(commitTxId), 0);
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
  const tsh = new kaspaWasm.TransactionSigningHash();
  tsh.update(tx);
  const hash = tsh.finalize();
  console.log('Hash:', hash);

  // Sign with signScriptHash
  const signature = kaspaWasm.signScriptHash(hash, privateKey);
  console.log('Signature:', signature.slice(0, 40) + '...');
  console.log('Signature length:', signature.length / 2, 'bytes');

  // Use script's encodePayToScriptHashSignatureScript
  const inscription3 = new Inscription('mint', { tick: 'YBTCA' });
  const script3 = new kaspaWasm.ScriptBuilder();
  inscription3.write(script3, xOnlyPubKey.toString());

  try {
    const sigScript = script3.encodePayToScriptHashSignatureScript(signature);
    console.log('Encoded sig script:', sigScript?.slice(0, 60) + '...');
    console.log('Encoded sig script length:', sigScript?.length / 2, 'bytes');
  } catch (e: any) {
    console.log('encodePayToScriptHashSignatureScript failed:', e.message);
  }

  // Also try the module-level function
  const redeemHex = script3.drain();
  const sigScript2 = kaspaWasm.payToScriptHashSignatureScript(redeemHex, signature);
  console.log('Module-level sig script:', sigScript2.slice(0, 60) + '...');
  console.log('Module-level sig script length:', sigScript2.length / 2, 'bytes');

  // Create final transaction
  const finalInput = new kaspaWasm.TransactionInput({
    previousOutpoint: outpoint,
    signatureScript: new Uint8Array(Buffer.from(sigScript2, 'hex')),
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

  console.log('Final TX id:', finalTx.id);

  // Submit
  console.log('\n=== Submitting ===');
  const resolver = new kaspaWasm.Resolver();
  const rpc = new kaspaWasm.RpcClient({ resolver, networkId });

  try {
    await rpc.connect();
    const submitResult = await rpc.submitTransaction({ transaction: finalTx });
    console.log('SUCCESS! TxID:', submitResult.transactionId);
    await rpc.disconnect();
  } catch (e: any) {
    console.log('Submit error:', e.message || e);
    await rpc.disconnect().catch(() => {});
  }
}

main().catch(console.error);
