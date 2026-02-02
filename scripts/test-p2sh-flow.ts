import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');
  const kasplexModule = await import('kasplexbuilder');
  const { Inscription } = kasplexModule;
  
  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  const networkId = new kaspaWasm.NetworkId('testnet-10');
  const address = publicKey.toAddress(networkId);
  
  console.log('Address:', address.toString());
  
  // Create inscription and script
  const inscription = new Inscription('mint', { tick: 'TEST' });
  const script = new kaspaWasm.ScriptBuilder();
  inscription.write(script, publicKey);
  
  // Get P2SH address
  const p2shScript = script.createPayToScriptHashScript();
  const commitAddress = kaspaWasm.addressFromScriptPublicKey(p2shScript, 'testnet-10');
  console.log('P2SH address:', commitAddress.toString());
  
  // Build transaction
  const commitTxId = '0'.repeat(64);
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
  const output = new kaspaWasm.TransactionOutput(10000000n, destSPK);
  
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
  
  // For P2SH signing, we need to:
  // 1. Create the sighash using the redeem script instead of P2SH script
  // 2. Sign that hash
  // 3. Build the signature script with: signature + redeem_script
  
  // Check if createInputSignature works with a custom script
  console.log('\n=== Creating signature ===');
  
  // Get the redeem script (the actual script with inscription)
  const redeemScript = script.encodePayToScriptHashSignatureScript(publicKey);
  console.log('Redeem script:', redeemScript);
  
  // The UTXO for P2SH has the P2SH script as the scriptPublicKey
  // But for signing, we use the original redeem script
  
  // Let's see what the script.drain() gives us
  // Actually, we need to recreate the script since drain() consumes it
  const script2 = new kaspaWasm.ScriptBuilder();
  inscription.write(script2, publicKey);
  
  // Get the raw script bytes for signing
  const rawScript = script2.hexView();
  console.log('Raw script hex:', rawScript);
  
  // Check PSKB class - might be useful for P2SH
  console.log('\n=== PSKB (Partially Signed Kaspa Bundle?) ===');
  console.log('PSKB:', typeof kaspaWasm.PSKB);
  console.log('PSKB methods:', Object.getOwnPropertyNames(kaspaWasm.PSKB.prototype));
  
  // Check PSKT
  console.log('\n=== PSKT ===');
  console.log('PSKT:', typeof kaspaWasm.PSKT);
  console.log('PSKT methods:', Object.getOwnPropertyNames(kaspaWasm.PSKT.prototype));
}

main().catch(console.error);
