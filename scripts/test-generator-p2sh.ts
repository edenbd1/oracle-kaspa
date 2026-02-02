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

  // Commit info
  const commitTxId = '2a20c496408389953bbdc79c311ba6c8809684fe9d9c4f7ddcc5899deac1855b';
  const inputAmount = 50000000n;
  const outputAmount = 49990000n;

  console.log('\n=== Using Generator API ===');

  // Create a "fake" UTXO entry using the commit tx
  // The key is to set scriptPublicKey to the redeem script for proper sighash computation
  const fakeUtxoEntry = {
    address: address.toString(), // Still use valid address for selection
    outpoint: {
      transactionId: commitTxId,
      index: 0
    },
    amount: inputAmount,
    // Use redeem script as scriptPublicKey
    scriptPublicKey: {
      script: redeemScriptHex,
      version: 0
    },
    blockDaaScore: 0n,
    isCoinbase: false
  };

  console.log('Fake UTXO entry:', JSON.stringify(fakeUtxoEntry, (k, v) => typeof v === 'bigint' ? v.toString() : v).slice(0, 200));

  // Try Generator
  try {
    const generator = new kaspaWasm.Generator({
      entries: [fakeUtxoEntry],
      outputs: [[address.toString(), outputAmount]],
      changeAddress: address.toString(),
      priorityFee: 10000n,
      sigOpCount: 1
    });

    console.log('Generator created');

    // Generate transaction
    const summary = await generator.next();
    console.log('Summary:', summary);

    if (summary.transactions?.length > 0) {
      const tx = summary.transactions[0].transaction;
      console.log('TX id:', tx.id);

      // Check if UTXO is attached
      console.log('Input[0] utxo:', tx.inputs[0]?.utxo);

      // Try signing
      kaspaWasm.signTransaction(tx, [privateKey], true);
      console.log('Signed!');

      const signedObj = tx.serializeToObject();
      console.log('Signature:', signedObj.inputs[0].signatureScript);
    }
  } catch (e: any) {
    console.log('Generator failed:', e.message);
    if (e.stack) console.log(e.stack.split('\n').slice(0, 5).join('\n'));
  }

  // Try PendingTransaction directly
  console.log('\n=== Using PendingTransaction ===');
  try {
    if (kaspaWasm.PendingTransaction) {
      console.log('PendingTransaction available');
      console.log('Methods:', Object.getOwnPropertyNames(kaspaWasm.PendingTransaction.prototype || {}));
    } else {
      console.log('PendingTransaction not available');
    }
  } catch (e: any) {
    console.log('Error:', e.message);
  }

  // Check all UTXO-related classes
  console.log('\n=== UTXO-related exports ===');
  const utxoExports = Object.keys(kaspaWasm).filter(k =>
    k.toLowerCase().includes('utxo') ||
    k.toLowerCase().includes('entry')
  ).sort();
  console.log(utxoExports);

  // Check UtxoProcessor
  console.log('\n=== UtxoProcessor ===');
  if (kaspaWasm.UtxoProcessor) {
    console.log('Available');
    console.log('Methods:', Object.getOwnPropertyNames(kaspaWasm.UtxoProcessor.prototype || {}));
  }

  // Check if there's a way to manually attach UTXO to a created transaction
  console.log('\n=== Checking MutableTransaction ===');
  if (kaspaWasm.MutableTransaction) {
    console.log('MutableTransaction available');
    console.log('Methods:', Object.getOwnPropertyNames(kaspaWasm.MutableTransaction.prototype || {}));
  } else {
    console.log('MutableTransaction not available');
  }

  // Check SignableTransaction
  console.log('\n=== SignableTransaction ===');
  if (kaspaWasm.SignableTransaction) {
    console.log('SignableTransaction available');
    console.log('Methods:', Object.getOwnPropertyNames(kaspaWasm.SignableTransaction.prototype || {}));
  } else {
    console.log('SignableTransaction not available');
  }
}

main().catch(console.error);
