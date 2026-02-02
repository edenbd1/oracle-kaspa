import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');

  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  const networkId = new kaspaWasm.NetworkId('testnet-10');
  const address = publicKey.toAddress(networkId);

  // Create proper scriptPublicKey from address
  const spkData = kaspaWasm.payToAddressScript(address);
  console.log('SPK data:', spkData);

  // Create a proper UTXO entry
  const spkBytes = new Uint8Array(Buffer.from(spkData.script, 'hex'));
  const spk = new kaspaWasm.ScriptPublicKey(spkData.version, spkBytes);

  console.log('=== ScriptPublicKey ===');
  console.log('SPK type:', typeof spk);

  // Try UtxoEntry with different constructors
  console.log('\n=== Trying different UtxoEntry approaches ===');

  // Approach 1: Constructor with amount, spk, daaScore, isCoinbase
  let utxoEntry;
  try {
    utxoEntry = new kaspaWasm.UtxoEntry(1000000n, spk, 0n, false);
    console.log('UtxoEntry created (4 args)');
    console.log('  amount:', utxoEntry.amount);
    console.log('  blockDaaScore:', utxoEntry.blockDaaScore);
    console.log('  isCoinbase:', utxoEntry.isCoinbase);
  } catch (e: any) {
    console.log('UtxoEntry (4 args) failed:', e.message);
  }

  // Create input without UTXO
  console.log('\n=== Creating TransactionInput ===');
  const commitTxId = '0'.repeat(64);
  const outpoint = new kaspaWasm.TransactionOutpoint(new kaspaWasm.Hash(commitTxId), 0);

  const input = new kaspaWasm.TransactionInput({
    previousOutpoint: outpoint,
    signatureScript: new Uint8Array(),
    sequence: 0,
    sigOpCount: 1
  });
  console.log('Input created');

  // Create output
  const destSpkBytes = new Uint8Array(Buffer.from(spkData.script, 'hex'));
  const output = new kaspaWasm.TransactionOutput(
    500000n,
    new kaspaWasm.ScriptPublicKey(spkData.version, destSpkBytes)
  );

  // Create transaction
  const tx = new kaspaWasm.Transaction({
    inputs: [input],
    outputs: [output],
    version: 0,
    lockTime: 0n,
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: 0n,
    payload: ''
  });

  console.log('\n=== Transaction ===');
  console.log('TX id:', tx.id);

  // Check inputs
  const inputs = tx.inputs;
  console.log('Inputs count:', inputs.length);
  console.log('Input[0] utxo:', inputs[0]?.utxo);

  // Try createInputSignature
  console.log('\n=== createInputSignature ===');
  try {
    const sig = kaspaWasm.createInputSignature(tx, 0, privateKey, kaspaWasm.SighashType.All);
    console.log('Signature:', Buffer.from(sig).toString('hex').slice(0, 40) + '...');
  } catch (e: any) {
    console.log('createInputSignature failed:', e.message);
  }

  // Try TransactionSigningHash
  console.log('\n=== TransactionSigningHash ===');
  try {
    const tsh = new kaspaWasm.TransactionSigningHash();
    tsh.update(tx);
    const hash = tsh.finalize();
    console.log('Hash:', hash);
  } catch (e: any) {
    console.log('TransactionSigningHash failed:', e.message);
  }

  // Check all signing-related exports
  console.log('\n=== All sign-related exports ===');
  const signExports = Object.keys(kaspaWasm).filter(k =>
    k.toLowerCase().includes('sign')
  ).sort();
  for (const exp of signExports) {
    const val = (kaspaWasm as any)[exp];
    if (typeof val === 'function') {
      console.log(`${exp}(${val.length} args)`);
    } else if (typeof val === 'object') {
      console.log(`${exp}: object`);
    }
  }

  // Try signScriptHash with a computed hash
  console.log('\n=== signScriptHash ===');
  try {
    const tsh = new kaspaWasm.TransactionSigningHash();
    tsh.update(tx);
    const hash = tsh.finalize();

    const sig = kaspaWasm.signScriptHash(hash, privateKey);
    console.log('signScriptHash result type:', typeof sig);
    console.log('signScriptHash result:', sig.slice ? sig.slice(0, 40) + '...' : sig);
  } catch (e: any) {
    console.log('signScriptHash failed:', e.message);
  }

  // Check if there's TransactionSigningHashECDSA
  console.log('\n=== TransactionSigningHashECDSA ===');
  if (kaspaWasm.TransactionSigningHashECDSA) {
    console.log('Available');
    try {
      const tshEcdsa = new kaspaWasm.TransactionSigningHashECDSA();
      console.log('Created, methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(tshEcdsa)));
    } catch (e: any) {
      console.log('Failed:', e.message);
    }
  } else {
    console.log('Not available');
  }

  // Check calcScriptSigHash - might be what we need
  console.log('\n=== Looking for sighash computation ===');
  const hashExports = Object.keys(kaspaWasm).filter(k =>
    k.toLowerCase().includes('hash') ||
    k.toLowerCase().includes('sighash') ||
    k.toLowerCase().includes('scriptsig')
  ).sort();
  console.log('Hash-related exports:', hashExports);

  for (const exp of hashExports) {
    const val = (kaspaWasm as any)[exp];
    if (typeof val === 'function') {
      console.log(`  ${exp}: ${val.length} args`);
    }
  }
}

main().catch(console.error);
