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
  
  // Create a test inscription
  const inscription = new Inscription('mint', { tick: 'TEST' });
  
  // Create script with inscription
  const script = new kaspaWasm.ScriptBuilder();
  inscription.write(script, publicKey);
  
  // Get P2SH script and address
  const p2shScript = script.createPayToScriptHashScript();
  const commitAddress = kaspaWasm.addressFromScriptPublicKey(p2shScript, 'testnet-10');
  
  console.log('P2SH commit address:', commitAddress.toString());
  
  // Check signScriptHash signature
  console.log('\n=== signScriptHash ===');
  console.log(kaspaWasm.signScriptHash.toString().slice(0, 500));
  
  // Check payToScriptHashSignatureScript
  console.log('\n=== payToScriptHashSignatureScript ===');
  console.log(kaspaWasm.payToScriptHashSignatureScript.toString().slice(0, 500));
  
  // Build a test reveal transaction
  console.log('\n=== Building test reveal transaction ===');
  
  // For a proper reveal, we need:
  // 1. Create the transaction
  // 2. Compute the sighash
  // 3. Sign the sighash
  // 4. Assemble: <sig> <pubkey> <script>
  
  // Let's check if there's a method to get the sighash for an input
  const {
    Transaction,
    TransactionInput,
    TransactionOutput,
    TransactionOutpoint,
    SighashType
  } = kaspaWasm;
  
  // Create a dummy transaction
  const commitTxIdHash = new kaspaWasm.Hash('0000000000000000000000000000000000000000000000000000000000000000');
  const outpoint = new TransactionOutpoint(commitTxIdHash, 0);
  
  // Encode the P2SH sig script (this is the redeem script)
  const redeemScript = script.encodePayToScriptHashSignatureScript(publicKey);
  console.log('Redeem script type:', typeof redeemScript);
  
  // Create input with empty signature (we'll fill it later)
  const input = new TransactionInput({
    previousOutpoint: outpoint,
    signatureScript: new Uint8Array(),
    sequence: 0,
    sigOpCount: 1
  });
  
  // Create output
  const destSpkData = kaspaWasm.payToAddressScript(address);
  const destScriptBytes = new Uint8Array(Buffer.from(destSpkData.script, 'hex'));
  const destSPK = new kaspaWasm.ScriptPublicKey(destSpkData.version, destScriptBytes);
  const output = new TransactionOutput(10000000n, destSPK);
  
  // Create transaction
  const tx = new Transaction({
    inputs: [input],
    outputs: [output],
    version: 0,
    lockTime: 0n,
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: 0n,
    payload: ''
  });
  
  console.log('TX id:', tx.id);
  
  // Check TransactionSigningHash
  console.log('\n=== TransactionSigningHash ===');
  const signingHash = new kaspaWasm.TransactionSigningHash();
  console.log('TransactionSigningHash methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(signingHash)));
  
  // Check if we can compute sighash for P2SH
  // Looking for something like: computeSighash(tx, inputIndex, script, sighashType)
  
  // Try signScriptHash with the script bytes
  console.log('\n=== Trying signScriptHash ===');
  // Get the raw script bytes
  const scriptBytes = script.drain(); // This might give us the raw script
  console.log('Script bytes type:', scriptBytes?.constructor?.name);
  
  if (scriptBytes instanceof Uint8Array) {
    const hex = Buffer.from(scriptBytes).toString('hex');
    console.log('Script bytes hex:', hex.slice(0, 100) + '...');
    
    // Try signScriptHash
    try {
      // signScriptHash might need: (tx, scriptPublicKey, input_index, sighash_type, privateKey)
      const sigResult = kaspaWasm.signScriptHash(tx, scriptBytes, 0, 1, privateKey);
      console.log('signScriptHash result:', sigResult);
    } catch (e: any) {
      console.log('signScriptHash error:', e.message || e);
    }
  }
}

main().catch(console.error);
