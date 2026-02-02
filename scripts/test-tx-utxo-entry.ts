import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');

  console.log('=== TransactionUtxoEntry ===');
  if (kaspaWasm.TransactionUtxoEntry) {
    console.log('Available');
    console.log('Constructor args:', kaspaWasm.TransactionUtxoEntry.length);
    console.log('Prototype:', Object.getOwnPropertyNames(kaspaWasm.TransactionUtxoEntry.prototype || {}));

    // Try to create one
    const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
    const publicKey = privateKey.toPublicKey();
    const networkId = new kaspaWasm.NetworkId('testnet-10');
    const address = publicKey.toAddress(networkId);

    const spkData = kaspaWasm.payToAddressScript(address);
    const spkBytes = new Uint8Array(Buffer.from(spkData.script, 'hex'));
    const spk = new kaspaWasm.ScriptPublicKey(spkData.version, spkBytes);

    // Try different constructor signatures
    console.log('\nTrying constructors:');

    try {
      const entry = new kaspaWasm.TransactionUtxoEntry(1000000n, spk, 0n, false);
      console.log('(amount, spk, daaScore, isCoinbase) worked');
      console.log('  Properties:', Object.keys(entry));
    } catch (e: any) {
      console.log('(amount, spk, daaScore, isCoinbase) failed:', e.message);
    }

    try {
      const entry = new kaspaWasm.TransactionUtxoEntry({
        amount: 1000000n,
        scriptPublicKey: spk,
        blockDaaScore: 0n,
        isCoinbase: false
      });
      console.log('({amount, spk, ...}) worked');
    } catch (e: any) {
      console.log('({amount, spk, ...}) failed:', e.message);
    }
  } else {
    console.log('Not available');
  }

  // Check UtxoEntryReference more carefully
  console.log('\n=== UtxoEntryReference ===');
  console.log('Prototype:', Object.getOwnPropertyNames(kaspaWasm.UtxoEntryReference.prototype || {}));

  // Check how createTransactions creates transactions with UTXOs
  console.log('\n=== Inspecting createTransactions result ===');

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

    console.log('Inner TX type:', innerTx.constructor.name);
    console.log('Inner TX inputs:', innerTx.inputs.length);

    const input0 = innerTx.inputs[0];
    console.log('Input[0] type:', input0.constructor.name);
    console.log('Input[0] utxo:', input0.utxo);

    // Check if we can access the utxo entry from the pending tx differently
    console.log('\n=== Pending TX UTXO access ===');

    // getUtxoEntries returns an array
    const utxoEntries = pendingTx.getUtxoEntries();
    console.log('UTXO entries count:', utxoEntries.length);

    if (utxoEntries.length > 0) {
      const ue = utxoEntries[0];
      console.log('Entry[0] type:', typeof ue);
      console.log('Entry[0] keys:', Object.keys(ue));

      // Check if this entry has a reference we can use
      if (ue.entry) {
        console.log('Entry[0].entry:', ue.entry);
      }
    }

    // Check if createInputSignature uses the UTXO entries
    console.log('\n=== Testing createInputSignature ===');
    try {
      const sig = pendingTx.createInputSignature(0, privateKey, kaspaWasm.SighashType.All);
      console.log('Signature created (hex):', Buffer.from(sig).toString('hex').slice(0, 40) + '...');
      console.log('Signature length:', sig.length);

      // Check the signature bytes
      console.log('First byte:', sig[0].toString(16));
      console.log('Last byte:', sig[sig.length - 1].toString(16));
    } catch (e: any) {
      console.log('Failed:', e.message);
    }

    // Now let's see what happens if we manually create a PendingTransaction
    // with a different UTXO scriptPubKey
    console.log('\n=== Manual PendingTransaction with custom SPK ===');

    // The idea: what if we could attach UTXO info to a Transaction
    // before wrapping it in PendingTransaction?

    // Check Transaction.serializeToObject() output
    const txObj = innerTx.serializeToObject();
    console.log('TX object:', JSON.stringify(txObj, (k, v) => typeof v === 'bigint' ? v.toString() : v).slice(0, 500));
  }
}

main().catch(console.error);
