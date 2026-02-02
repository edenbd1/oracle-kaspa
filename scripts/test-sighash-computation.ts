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
  console.log('Redeem script length:', redeemScriptHex.length / 2, 'bytes');

  // Recent commit TX
  const commitTxId = '2a20c496408389953bbdc79c311ba6c8809684fe9d9c4f7ddcc5899deac1855b';
  const inputAmount = 50000000n;
  const outputAmount = 49990000n;

  // Create the reveal transaction
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
  console.log('\n=== TransactionSigningHash ===');
  const tsh = new kaspaWasm.TransactionSigningHash();
  tsh.update(tx);
  const hash = tsh.finalize();
  console.log('Hash type:', typeof hash);
  console.log('Hash:', hash);

  // Sign with signScriptHash
  console.log('\n=== signScriptHash ===');
  const sig = kaspaWasm.signScriptHash(hash, privateKey);
  console.log('Signature type:', typeof sig);
  console.log('Signature:', sig);
  console.log('Signature length:', sig.length);

  // The signature should be 65 bytes (64-byte Schnorr + 1-byte sighash type)
  // or just the hex string representation

  // Check if it's already hex
  if (typeof sig === 'string' && /^[0-9a-fA-F]+$/.test(sig)) {
    console.log('Signature is hex string');
    console.log('Decoded length:', sig.length / 2, 'bytes');
  }

  // Build P2SH signature script
  console.log('\n=== payToScriptHashSignatureScript ===');
  const p2shSigScript = kaspaWasm.payToScriptHashSignatureScript(redeemScriptHex, sig);
  console.log('P2SH sig script type:', typeof p2shSigScript);
  console.log('P2SH sig script:', p2shSigScript.slice(0, 60) + '...');
  console.log('P2SH sig script length:', p2shSigScript.length / 2, 'bytes');

  // Now let's understand what the P2SH sig script structure should be
  // Format: <push sig> <sig> <push script> <script>
  console.log('\n=== Parsing P2SH sig script ===');
  const p2shBytes = Buffer.from(p2shSigScript, 'hex');
  console.log('Total bytes:', p2shBytes.length);
  console.log('Byte 0 (sig push opcode):', p2shBytes[0].toString(16));
  const sigLen = p2shBytes[0];
  console.log('Sig length:', sigLen);
  const sigBytes = p2shBytes.slice(1, 1 + sigLen);
  console.log('Sig bytes:', sigBytes.toString('hex').slice(0, 40) + '...');
  console.log('Remaining after sig:', p2shBytes.length - 1 - sigLen);

  if (p2shBytes.length > 1 + sigLen) {
    console.log('Script push opcode:', p2shBytes[1 + sigLen].toString(16));
    const scriptPush = p2shBytes[1 + sigLen];
    if (scriptPush === 0x4c) {
      // OP_PUSHDATA1
      const scriptLen = p2shBytes[2 + sigLen];
      console.log('Script length (OP_PUSHDATA1):', scriptLen);
    } else {
      console.log('Script length (direct):', scriptPush);
    }
  }

  // Create final transaction with P2SH sig script
  console.log('\n=== Creating final TX ===');
  const finalSigScriptBytes = new Uint8Array(Buffer.from(p2shSigScript, 'hex'));
  const finalInput = new kaspaWasm.TransactionInput({
    previousOutpoint: outpoint,
    signatureScript: finalSigScriptBytes,
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

  // Try to submit
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
