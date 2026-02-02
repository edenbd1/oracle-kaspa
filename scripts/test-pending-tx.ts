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

  // Recent commit TX
  const commitTxId = '2a20c496408389953bbdc79c311ba6c8809684fe9d9c4f7ddcc5899deac1855b';
  const inputAmount = 50000000n;
  const outputAmount = 49990000n;

  // Check PendingTransaction constructor
  console.log('\n=== PendingTransaction constructor ===');
  console.log('Constructor args:', kaspaWasm.PendingTransaction.length);

  // Try to create PendingTransaction with various input types
  const testInputs = [
    { name: 'transaction only', args: [null] },
    { name: 'empty object', args: [{}] }
  ];

  // Check if PendingTransaction can be constructed from a Transaction
  console.log('\n=== Testing PendingTransaction creation ===');

  // First create a regular transaction
  const outpoint = new kaspaWasm.TransactionOutpoint(new kaspaWasm.Hash(commitTxId), 0);
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

  console.log('TX id:', tx.id);

  // Try creating PendingTransaction
  try {
    const pending = new kaspaWasm.PendingTransaction(tx);
    console.log('PendingTransaction created from Transaction');
  } catch (e: any) {
    console.log('Failed:', e.message);
  }

  // Try with UTXO entries
  console.log('\n=== Testing with UTXO entries ===');

  // Create ScriptPublicKey from redeem script
  const redeemScriptBytes = new Uint8Array(Buffer.from(redeemScriptHex, 'hex'));
  const redeemSPK = new kaspaWasm.ScriptPublicKey(0, redeemScriptBytes);

  // Create UtxoEntry for the P2SH input
  const utxoEntry = new kaspaWasm.UtxoEntry(inputAmount, redeemSPK, 0n, false);
  console.log('UtxoEntry created');
  console.log('  amount:', utxoEntry.amount);

  // Check UtxoEntries
  console.log('\n=== UtxoEntries ===');
  const utxoEntries = new kaspaWasm.UtxoEntries([utxoEntry]);
  console.log('UtxoEntries created');
  console.log('  length:', utxoEntries.length);

  // Try creating PendingTransaction with tx + utxoEntries
  try {
    const pending = new kaspaWasm.PendingTransaction(tx, utxoEntries);
    console.log('PendingTransaction created with UTXOs!');
    console.log('  getUtxoEntries:', pending.getUtxoEntries());
  } catch (e: any) {
    console.log('Failed with 2 args:', e.message);
  }

  // Check createTransactions more carefully
  console.log('\n=== createTransactions return type ===');

  // Get a normal UTXO to test
  const apiBase = 'https://api-tn10.kaspa.org';
  const utxoRes = await fetch(`${apiBase}/addresses/${address.toString()}/utxos`);
  const utxos = await utxoRes.json();

  if (utxos.length > 0) {
    const utxo = utxos[0];
    const normalEntry = {
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

    console.log('Normal UTXO entry ready');

    const result = await kaspaWasm.createTransactions({
      entries: [normalEntry],
      outputs: [{
        address: address.toString(),
        amount: 1000000n
      }],
      priorityFee: 10000n,
      changeAddress: address.toString(),
      networkId: 'testnet-10'
    });

    console.log('createTransactions result type:', typeof result);
    console.log('Result keys:', Object.keys(result));

    if (result.transactions?.length > 0) {
      const pendingTx = result.transactions[0];
      console.log('PendingTransaction from createTransactions:');
      console.log('  Type:', pendingTx.constructor.name);
      console.log('  Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(pendingTx)));

      // Check the transaction inside
      const innerTx = pendingTx.transaction;
      console.log('  Inner TX id:', innerTx.id);

      // Check input UTXOs
      const inputs = innerTx.inputs;
      console.log('  Input[0] utxo:', inputs[0]?.utxo);

      // Try signing
      console.log('\n=== Signing with createInputSignature ===');
      try {
        const sig = pendingTx.createInputSignature(0, privateKey, kaspaWasm.SighashType.All);
        console.log('Signature created:', Buffer.from(sig).toString('hex').slice(0, 40) + '...');

        // The signature includes the sighash type
        console.log('Signature length:', sig.length, 'bytes');
      } catch (e: any) {
        console.log('createInputSignature failed:', e.message);
      }
    }
  }
}

main().catch(console.error);
