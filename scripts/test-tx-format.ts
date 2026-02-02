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

    // Get the full serialized object
    const serialized = innerTx.serializeToObject();
    console.log('Full serialized TX:');
    console.log(JSON.stringify(serialized, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));

    // Now try to recreate the transaction from this exact object
    console.log('\n=== Recreating from serialized ===');
    try {
      const recreated = new kaspaWasm.Transaction(serialized);
      console.log('Recreated TX id:', recreated.id);
      console.log('Input[0] utxo:', recreated.inputs[0]?.utxo);
    } catch (e: any) {
      console.log('Failed:', e.message);
    }

    // Try to modify the SPK in the utxo
    console.log('\n=== Modifying UTXO SPK ===');
    const modifiedSerialized = JSON.parse(JSON.stringify(serialized, (k, v) => typeof v === 'bigint' ? v.toString() : v));

    // Change the scriptPublicKey to our redeem script
    const kasplexModule = await import('kasplexbuilder');
    const { Inscription } = kasplexModule;
    const inscription = new Inscription('mint', { tick: 'YBTCA' });
    const script = new kaspaWasm.ScriptBuilder();
    inscription.write(script, publicKey.toXOnlyPublicKey().toString());
    const redeemScriptHex = script.drain();

    // The scriptPublicKey format in serialized is: version (4 hex chars) + script
    const modifiedSpk = '0000' + redeemScriptHex;
    modifiedSerialized.inputs[0].utxo.scriptPublicKey = modifiedSpk;

    console.log('Modified SPK:', modifiedSpk.slice(0, 40) + '...');

    try {
      const modifiedTx = new kaspaWasm.Transaction(modifiedSerialized);
      console.log('Modified TX created!');
      console.log('TX id:', modifiedTx.id);

      // Check UTXO
      console.log('Input[0] utxo:', modifiedTx.inputs[0]?.utxo);

      // Create PendingTransaction and sign
      const pending = new kaspaWasm.PendingTransaction(modifiedTx);
      console.log('PendingTransaction created');

      // Create signature with the modified SPK (redeem script)
      const sig = pending.createInputSignature(0, privateKey, kaspaWasm.SighashType.All);
      console.log('Signature:', Buffer.from(sig).toString('hex').slice(0, 40) + '...');
    } catch (e: any) {
      console.log('Failed:', e.message);
    }
  }
}

main().catch(console.error);
