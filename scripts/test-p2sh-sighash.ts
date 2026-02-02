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
  
  console.log('Address:', address.toString());
  
  // Create inscription
  const inscription = new Inscription('mint', { tick: 'YBTCA' });
  const script = new kaspaWasm.ScriptBuilder();
  inscription.write(script, xOnlyPubKey.toString());
  
  // Get redeem script
  const redeemScriptHex = script.encodePayToScriptHashSignatureScript(xOnlyPubKey.toString());
  console.log('\nRedeem script hex:', redeemScriptHex);
  console.log('Redeem script length:', redeemScriptHex.length / 2, 'bytes');
  
  // Build a test reveal transaction
  // Use a recent commit txid (from our last test)
  const commitTxId = '4d43f14d3664b064d35e772728e0a794eee6314c4e299d7a400f8070afa0016e';
  const inputAmount = 50000000n;
  const outputAmount = 49990000n;
  
  // Create transaction with empty signature
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
  
  console.log('\nTransaction created:', tx.id);
  
  // For P2SH, we need to sign the sighash computed with the redeem script
  // Check if there's a way to compute sighash
  
  console.log('\n=== Looking for sighash computation ===');
  
  // Check if TransactionSigningHash can help
  const sigHash = new kaspaWasm.TransactionSigningHash();
  console.log('TransactionSigningHash:', sigHash);
  
  // Check if there's a createInputSignature that works with custom script
  console.log('\n=== createInputSignature ===');
  console.log(kaspaWasm.createInputSignature.toString().slice(0, 300));
  
  // createInputSignature(tx, input_index, private_key, sighash_type)
  // This might work if the tx has the right UTXO entry
  
  // Let's check if we can attach a UTXO entry to the input
  console.log('\n=== Checking input utxo ===');
  const inputs = tx.inputs;
  console.log('Input[0]:', inputs[0]);
  
  // Try to set utxo on the input
  // The utxo should use the REDEEM script as scriptPublicKey
  
  // Maybe we need to use PSKT for this
  console.log('\n=== Trying PSKT ===');
  
  try {
    // Create PSKT from transaction
    const pskt = new kaspaWasm.PSKT(tx);
    console.log('PSKT created from transaction');
    console.log('PSKT role:', pskt.role);
    console.log('PSKT methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(pskt)));
    
    // Check inputAndRedeemScript
    if (typeof pskt.inputAndRedeemScript === 'function') {
      console.log('\nTrying inputAndRedeemScript...');
      // This might let us set the redeem script for the input
    }
    
    // Check toSigner
    if (typeof pskt.toSigner === 'function') {
      console.log('\nConverting to signer...');
      const signer = pskt.toSigner();
      console.log('Signer:', signer);
    }
    
  } catch (e: any) {
    console.log('PSKT error:', e.message || e);
  }
}

main().catch(console.error);
