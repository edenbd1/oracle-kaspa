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
  console.log('Public key hex:', publicKey.toString());
  
  // Fetch a real UTXO for testing
  const apiBase = 'https://api-tn10.kaspa.org';
  const res = await fetch(`${apiBase}/addresses/${address.toString()}/utxos`);
  const utxos = await res.json();
  const utxo = utxos.find((u: any) => BigInt(u.utxoEntry.amount) >= 50000000n && BigInt(u.utxoEntry.amount) <= 500000000n);
  
  if (!utxo) {
    console.log('No suitable UTXO found');
    return;
  }
  
  console.log('Using UTXO:', utxo.outpoint.transactionId);
  
  // Create inscription and script
  const inscription = new Inscription('mint', { tick: 'TEST' });
  const script = new kaspaWasm.ScriptBuilder();
  inscription.write(script, publicKey);
  
  // Get P2SH script
  const p2shScript = script.createPayToScriptHashScript();
  const commitAddress = kaspaWasm.addressFromScriptPublicKey(p2shScript, 'testnet-10');
  console.log('P2SH address:', commitAddress.toString());
  
  // The redeem script (what we need to reveal)
  const redeemScriptHex = script.encodePayToScriptHashSignatureScript(publicKey);
  console.log('\nRedeem script hex:', redeemScriptHex);
  
  // For spending P2SH, we need to:
  // 1. Create transaction with empty sig script
  // 2. Compute sighash over the transaction using the REDEEM script (not P2SH script)
  // 3. Sign that sighash
  // 4. Build sig script: <signature> <script_bytes>
  
  // Build the reveal transaction
  const commitTxIdHash = new kaspaWasm.Hash(utxo.outpoint.transactionId);
  const outpoint = new kaspaWasm.TransactionOutpoint(commitTxIdHash, utxo.outpoint.index);
  
  // Start with empty signature script
  const input = new kaspaWasm.TransactionInput({
    previousOutpoint: outpoint,
    signatureScript: new Uint8Array(),
    sequence: 0,
    sigOpCount: 1
  });
  
  // Output back to our address
  const destSpkData = kaspaWasm.payToAddressScript(address);
  const destScriptBytes = new Uint8Array(Buffer.from(destSpkData.script, 'hex'));
  const destSPK = new kaspaWasm.ScriptPublicKey(destSpkData.version, destScriptBytes);
  const inputAmount = BigInt(utxo.utxoEntry.amount);
  const outputAmount = inputAmount - 10000n;
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
  
  // Now try to sign using the redeem script
  // We need to compute sighash with the redeem script
  
  // Check SighashType
  console.log('\n=== SighashType ===');
  console.log('SighashType:', kaspaWasm.SighashType);
  
  // Try to use payToScriptHashSignatureScript function
  console.log('\n=== Using payToScriptHashSignatureScript ===');
  
  // First, we need to create the signature
  // The signature should sign the transaction hash computed using the redeem script
  
  // Let's try PSKT approach
  console.log('\n=== Trying PSKT ===');
  
  // PSKT might let us add a redeem script and sign
  // Check PSKT constructor
  try {
    const pskt = new kaspaWasm.PSKT({ inputs: [], outputs: [] });
    console.log('PSKT created');
    console.log('PSKT role:', pskt.role);
  } catch (e: any) {
    console.log('PSKT error:', e.message || e);
  }
  
  // Alternative: manually compute sighash
  // Looking for TransactionSigningHashECDSA or similar
  console.log('\n=== TransactionSigningHashECDSA ===');
  console.log('TransactionSigningHashECDSA:', typeof kaspaWasm.TransactionSigningHashECDSA);
  
  // Let's see what parameters signScriptHash needs
  // signScriptHash(script_hash, privkey) - it takes a hash, not the script
  // So we need to compute the hash first
  
  // Try creating a hash from the transaction
  console.log('\n=== Computing transaction sighash ===');
  const txSerialized = tx.serializeToObject();
  console.log('TX serialized inputs[0].utxo:', txSerialized.inputs[0].utxo);
}

main().catch(console.error);
