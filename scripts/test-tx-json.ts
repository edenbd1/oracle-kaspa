import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');

  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  const networkId = new kaspaWasm.NetworkId('testnet-10');
  const address = publicKey.toAddress(networkId);

  // Get a real UTXO
  const apiBase = 'https://api-tn10.kaspa.org';
  const utxoRes = await fetch(`${apiBase}/addresses/${address.toString()}/utxos`);
  const utxos = await utxoRes.json();

  if (utxos.length > 0) {
    const utxo = utxos[0];
    const entry = {
      address: address.toString(),
      outpoint: {
        transactionId: utxo.outpoint.transactionId,
        index: utxo.outpoint.index
      },
      amount: BigInt(utxo.utxoEntry.amount),
      scriptPublicKey: {
        script: utxo.utxoEntry.scriptPublicKey.scriptPublicKey,
        version: 0
      },
      blockDaaScore: BigInt(utxo.utxoEntry.blockDaaScore),
      isCoinbase: false
    };

    const result = await kaspaWasm.createTransactions({
      entries: [entry],
      outputs: [{
        address: address.toString(),
        amount: BigInt(utxo.utxoEntry.amount) - 100000n
      }],
      priorityFee: 10000n,
      changeAddress: address.toString(),
      networkId: 'testnet-10'
    });

    const pendingTx = result.transactions[0];
    const innerTx = pendingTx.transaction;

    // Try serializeToJSON
    console.log('=== serializeToJSON ===');
    const jsonStr = innerTx.serializeToJSON();
    console.log('JSON string:', jsonStr.slice(0, 500) + '...');

    // Parse and check
    const parsed = JSON.parse(jsonStr);
    console.log('Parsed keys:', Object.keys(parsed));
    console.log('Input format:', JSON.stringify(parsed.inputs[0], null, 2).slice(0, 300));

    // Try serializeToSafeJSON
    console.log('\n=== serializeToSafeJSON ===');
    const safeJson = innerTx.serializeToSafeJSON();
    console.log('Safe JSON:', safeJson.slice(0, 500) + '...');

    // See if signTransaction modifies the transaction in place
    console.log('\n=== Testing signTransaction ===');

    // Clone the pending tx's transaction before signing
    const txBefore = pendingTx.transaction.serializeToObject();
    console.log('Before signing - sigScript:', txBefore.inputs[0].signatureScript);

    // Sign via signTransaction
    kaspaWasm.signTransaction(innerTx, [privateKey], true);

    const txAfter = innerTx.serializeToObject();
    console.log('After signing - sigScript:', txAfter.inputs[0].signatureScript.slice(0, 40) + '...');

    // The signature is in the transaction now
    // For P2SH, we need to sign with the redeem script as the SPK

    // Check if we can get the signature separately
    console.log('\n=== Getting signature from PendingTransaction ===');
    try {
      // Note: pendingTx might already be signed now
      const sig = pendingTx.createInputSignature(0, privateKey, kaspaWasm.SighashType.All);
      console.log('Signature from pending:', Buffer.from(sig).toString('hex').slice(0, 40) + '...');
    } catch (e: any) {
      console.log('Failed:', e.message);
    }

    // Now let's try a workaround:
    // 1. Create a normal transaction from a valid UTXO
    // 2. Before signing, modify the UTXO's scriptPublicKey to be the redeem script
    // 3. Sign - this should compute the sighash using the redeem script
    // 4. Extract the signature
    // 5. Build the P2SH signature script
    console.log('\n=== Workaround: Modify UTXO before signing ===');

    // We need a fresh pending transaction
    const result2 = await kaspaWasm.createTransactions({
      entries: [entry],
      outputs: [{
        address: address.toString(),
        amount: BigInt(utxo.utxoEntry.amount) - 100000n
      }],
      priorityFee: 10000n,
      changeAddress: address.toString(),
      networkId: 'testnet-10'
    });

    const pending2 = result2.transactions[0];
    const tx2 = pending2.transaction;

    // Check if we can modify the UTXO on the input
    const inputs = tx2.inputs;
    console.log('Input type:', inputs[0].constructor.name);
    console.log('Input utxo available:', !!inputs[0].utxo);

    // The utxo is a getter-only property
    // Can we modify the underlying UTXO?
    const utxoObj = inputs[0].utxo;
    console.log('UTXO scriptPublicKey:', utxoObj?.scriptPublicKey);

    // Unfortunately, we can't modify the UTXO after the transaction is created
    // because it's a read-only property

    // Alternative: Use signScriptHash with a manually computed hash
    console.log('\n=== Alternative: Compute P2SH sighash manually ===');

    // For P2SH, the sighash needs to include:
    // - The redeem script as the scriptCode
    // - The input amount
    //
    // The kaspa-wasm SDK doesn't expose a direct way to compute this
    // But we can try to replicate the sighash computation

    // Actually, let's check if there's a way to access the hash computation
    // from the signing process

    // The signature format from kaspa-wasm for Schnorr is:
    // 64 bytes (sig) + 1 byte (sighash type)
    // Total: 65 bytes

    // Let's check the actual signature bytes
    console.log('\nSignature analysis:');
    const sigRaw = pending2.createInputSignature(0, privateKey, kaspaWasm.SighashType.All);
    console.log('Raw signature length:', sigRaw.length);
    console.log('Raw signature (first 10 bytes):', Array.from(sigRaw.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('Raw signature (last 5 bytes):', Array.from(sigRaw.slice(-5)).map(b => b.toString(16).padStart(2, '0')).join(' '));

    // If the signature is hex-encoded ASCII, decode it
    if (sigRaw.every(b => (b >= 0x30 && b <= 0x39) || (b >= 0x61 && b <= 0x66))) {
      const decoded = Buffer.from(Buffer.from(sigRaw).toString('utf8'), 'hex');
      console.log('Decoded signature length:', decoded.length);
      console.log('Decoded (first 10):', Array.from(decoded.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' '));
    }
  }
}

main().catch(console.error);
