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

  // Recent commit TX
  const commitTxId = '2a20c496408389953bbdc79c311ba6c8809684fe9d9c4f7ddcc5899deac1855b';
  const inputAmount = 50000000n;
  const outputAmount = 49990000n;

  // Get the output SPK
  const destSpkData = kaspaWasm.payToAddressScript(address);

  // Create a transaction object with UTXO included in the input
  // The scriptPublicKey format in serializeToObject is: version (4 hex) + script
  const redeemSpkHex = '0000' + redeemScriptHex; // version 0 + script

  const txObj = {
    version: 0,
    inputs: [{
      previousOutpoint: {
        transactionId: commitTxId,
        index: 0
      },
      sequence: 0n,
      sigOpCount: 1,
      signatureScript: '',
      utxo: {
        address: address.toString(),
        amount: inputAmount.toString(),
        scriptPublicKey: redeemSpkHex,
        blockDaaScore: '0',
        isCoinbase: false
      }
    }],
    outputs: [{
      value: outputAmount,
      scriptPublicKey: '0000' + destSpkData.script
    }],
    lockTime: 0n,
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: 0n,
    payload: ''
  };

  console.log('TX object with UTXO:', JSON.stringify(txObj, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2).slice(0, 800));

  // Try to create a Transaction from this object
  console.log('\n=== Creating Transaction from object ===');
  try {
    const tx = new kaspaWasm.Transaction(txObj);
    console.log('Transaction created!');
    console.log('TX id:', tx.id);

    // Check if UTXO is attached
    const inputs = tx.inputs;
    console.log('Input[0] utxo:', inputs[0]?.utxo);

    // Try to create a PendingTransaction
    const pending = new kaspaWasm.PendingTransaction(tx);
    console.log('PendingTransaction created');

    // Try createInputSignature
    const sig = pending.createInputSignature(0, privateKey, kaspaWasm.SighashType.All);
    console.log('Signature:', Buffer.from(sig).toString('hex').slice(0, 40) + '...');

    // Build P2SH signature script
    const sigHex = Buffer.from(sig).toString('hex');
    const p2shSigScript = kaspaWasm.payToScriptHashSignatureScript(redeemScriptHex, sigHex);
    console.log('P2SH sig script:', p2shSigScript.slice(0, 60) + '...');

    // Create final transaction
    const finalTxObj = {
      version: 0,
      inputs: [{
        previousOutpoint: {
          transactionId: commitTxId,
          index: 0
        },
        sequence: 0n,
        sigOpCount: 1,
        signatureScript: p2shSigScript
      }],
      outputs: [{
        value: outputAmount,
        scriptPublicKey: '0000' + destSpkData.script
      }],
      lockTime: 0n,
      subnetworkId: '0000000000000000000000000000000000000000',
      gas: 0n,
      payload: ''
    };

    const finalTx = new kaspaWasm.Transaction(finalTxObj);
    console.log('Final TX id:', finalTx.id);

    // Submit
    console.log('\n=== Submitting ===');
    const resolver = new kaspaWasm.Resolver();
    const rpc = new kaspaWasm.RpcClient({ resolver, networkId });

    await rpc.connect();
    const submitResult = await rpc.submitTransaction({ transaction: finalTx });
    console.log('SUCCESS! TxID:', submitResult.transactionId);
    await rpc.disconnect();

  } catch (e: any) {
    console.log('Error:', e.message);
    if (e.stack) console.log(e.stack.split('\n').slice(0, 5).join('\n'));
  }
}

main().catch(console.error);
