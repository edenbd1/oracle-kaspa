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

  // Commit info (use a test commit tx)
  const commitTxId = 'ee8c237fd7056c859c79d1009ba41d8e39420ff73f6df24a756abfca9e66b8b8';
  const inputAmount = 50000000n;
  const outputAmount = 49990000n;

  // Create ScriptPublicKey from redeem script
  const redeemScriptBytes = new Uint8Array(Buffer.from(redeemScriptHex, 'hex'));
  const redeemSPK = new kaspaWasm.ScriptPublicKey(0, redeemScriptBytes);

  console.log('\n=== Testing UTXO attachment methods ===');

  // Method 1: Try including utxo in TransactionInput config object
  console.log('\n--- Method 1: utxo in config object ---');
  const outpoint = new kaspaWasm.TransactionOutpoint(new kaspaWasm.Hash(commitTxId), 0);

  // Create output
  const destSpkData = kaspaWasm.payToAddressScript(address);
  const destScriptBytes = new Uint8Array(Buffer.from(destSpkData.script, 'hex'));
  const destSPK = new kaspaWasm.ScriptPublicKey(destSpkData.version, destScriptBytes);
  const output = new kaspaWasm.TransactionOutput(outputAmount, destSPK);

  // Try creating input with utxo as an object in the config
  try {
    const inputWithUtxo = new kaspaWasm.TransactionInput({
      previousOutpoint: outpoint,
      signatureScript: new Uint8Array(),
      sequence: 0,
      sigOpCount: 1,
      utxo: {
        amount: inputAmount,
        scriptPublicKey: redeemSPK,
        blockDaaScore: 0n,
        isCoinbase: false
      }
    });
    console.log('Input created with utxo object');
    console.log('  utxo:', inputWithUtxo.utxo);
  } catch (e: any) {
    console.log('Failed:', e.message);
  }

  // Method 2: Try setting utxo after creating input
  console.log('\n--- Method 2: Set utxo property after creation ---');
  const input = new kaspaWasm.TransactionInput({
    previousOutpoint: outpoint,
    signatureScript: new Uint8Array(),
    sequence: 0,
    sigOpCount: 1
  });

  try {
    // Create UtxoEntry
    const utxoEntry = new kaspaWasm.UtxoEntry(inputAmount, redeemSPK, 0n, false);
    (input as any).utxo = utxoEntry;
    console.log('Set utxo property');
    console.log('  input.utxo:', input.utxo);
  } catch (e: any) {
    console.log('Failed:', e.message);
  }

  // Method 3: Try using serializeToObject and manipulating there
  console.log('\n--- Method 3: Serialize/deserialize with utxo ---');
  const tx = new kaspaWasm.Transaction({
    inputs: [input],
    outputs: [output],
    version: 0,
    lockTime: 0n,
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: 0n,
    payload: ''
  });

  const txObj = tx.serializeToObject();
  console.log('TX object:', JSON.stringify(txObj, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2).slice(0, 500));

  // Add UTXO to the input
  txObj.inputs[0].utxo = {
    amount: inputAmount.toString(),
    scriptPublicKey: redeemScriptHex,
    blockDaaScore: '0',
    isCoinbase: false
  };

  console.log('TX with utxo:', JSON.stringify(txObj, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2).slice(0, 800));

  // Method 4: Compute sighash manually with the redeem script
  console.log('\n--- Method 4: Manual sighash computation ---');

  // In Kaspa (like Bitcoin), the P2SH sighash is computed by:
  // 1. Taking the transaction
  // 2. For the input being signed, replacing the scriptSig with the redeem script
  // 3. Computing the hash

  // However, Kaspa uses a different sighash algorithm based on BIP-143 / BIP-340
  // which includes the scriptPubKey of the UTXO being spent

  // Let's try to see if TransactionSigningHash can take additional data
  const tsh = new kaspaWasm.TransactionSigningHash();
  console.log('TransactionSigningHash methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(tsh)));

  // Check if update can take different types of data
  console.log('\n--- Trying different update() inputs ---');

  // Try 1: Update with redeem script bytes
  try {
    const tsh1 = new kaspaWasm.TransactionSigningHash();
    tsh1.update(redeemScriptBytes);
    tsh1.update(tx);
    const hash1 = tsh1.finalize();
    console.log('Redeem + tx hash:', hash1);
  } catch (e: any) {
    console.log('Redeem + tx failed:', e.message);
  }

  // Try 2: Check if there's a way to specify the scriptPubKey for hashing
  console.log('\n--- Looking for scriptPubKey-aware hashing ---');

  // Check if Transaction has any method to set/get input UTXOs
  console.log('Transaction methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(tx)));

  // Method 5: Use signTransaction with a transaction that has UTXOs attached
  console.log('\n--- Method 5: Using signTransaction ---');

  // signTransaction expects the transaction to have UTXOs attached to inputs
  // Let's see if we can create a Transaction from JSON with UTXOs
  try {
    // Create tx with utxo in the input
    const txWithUtxo = new kaspaWasm.Transaction({
      inputs: [{
        previousOutpoint: { transactionId: commitTxId, index: 0 },
        signatureScript: '',
        sequence: 0,
        sigOpCount: 1,
        utxo: {
          amount: inputAmount,
          scriptPublicKey: { script: redeemScriptHex, version: 0 },
          blockDaaScore: 0n,
          isCoinbase: false
        }
      }],
      outputs: [output],
      version: 0,
      lockTime: 0n,
      subnetworkId: '0000000000000000000000000000000000000000',
      gas: 0n,
      payload: ''
    });

    console.log('TX with utxo in input created');
    console.log('Input utxo:', txWithUtxo.inputs[0]?.utxo);

    // Try to sign
    kaspaWasm.signTransaction(txWithUtxo, [privateKey], true);
    console.log('signTransaction succeeded!');

    const signedObj = txWithUtxo.serializeToObject();
    console.log('Signature:', signedObj.inputs[0].signatureScript.slice(0, 40) + '...');
  } catch (e: any) {
    console.log('Failed:', e.message);
  }
}

main().catch(console.error);
