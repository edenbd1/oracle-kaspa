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

  // Generate the P2SH commit address
  const scriptForAddr = new kaspaWasm.ScriptBuilder();
  const inscription2 = new Inscription('mint', { tick: 'YBTCA' });
  inscription2.write(scriptForAddr, xOnlyPubKey.toString());
  const p2shScript = scriptForAddr.createPayToScriptHashScript();
  const commitAddress = kaspaWasm.addressFromScriptPublicKey(p2shScript, 'testnet-10');

  console.log('P2SH commit address:', commitAddress.toString());

  // Recent commit TX
  const commitTxId = '2a20c496408389953bbdc79c311ba6c8809684fe9d9c4f7ddcc5899deac1855b';
  const inputAmount = 50000000n;
  const outputAmount = 49990000n;

  // Create a UTXO entry using the P2SH commit address
  // but with the redeem script as scriptPublicKey for sighash computation
  const fakeUtxoEntry = {
    address: commitAddress.toString(), // Use the P2SH address
    outpoint: {
      transactionId: commitTxId,
      index: 0
    },
    amount: inputAmount,
    // Use redeem script as scriptPublicKey for correct sighash
    scriptPublicKey: {
      script: redeemScriptHex,
      version: 0
    },
    blockDaaScore: 0n,
    isCoinbase: false
  };

  console.log('\n=== Creating transaction with P2SH UTXO ===');
  console.log('UTXO address:', fakeUtxoEntry.address);
  console.log('UTXO SPK (redeem script):', fakeUtxoEntry.scriptPublicKey.script.slice(0, 40) + '...');

  try {
    const result = await kaspaWasm.createTransactions({
      entries: [fakeUtxoEntry],
      outputs: [{
        address: address.toString(), // Send to platform address
        amount: outputAmount
      }],
      priorityFee: 10000n,
      changeAddress: address.toString(),
      networkId: 'testnet-10'
    });

    console.log('Transaction created!');
    console.log('TX count:', result.transactions.length);

    if (result.transactions.length > 0) {
      const pending = result.transactions[0];
      const tx = pending.transaction;
      console.log('TX id:', tx.id);

      // Check the UTXO in the transaction
      const utxo = tx.inputs[0]?.utxo;
      console.log('Input UTXO SPK:', utxo?.scriptPublicKey);

      // Sign
      kaspaWasm.signTransaction(tx, [privateKey], true);
      console.log('Transaction signed!');

      // Get the signature script
      const signedObj = tx.serializeToObject();
      const sigScript = signedObj.inputs[0].signatureScript;
      console.log('Signature script:', sigScript.slice(0, 40) + '...');

      // Build P2SH signature script
      const p2shSigScript = kaspaWasm.payToScriptHashSignatureScript(redeemScriptHex, sigScript);
      console.log('P2SH sig script:', p2shSigScript.slice(0, 60) + '...');

      // Create final reveal transaction
      console.log('\n=== Creating final reveal TX ===');
      const outpoint = new kaspaWasm.TransactionOutpoint(new kaspaWasm.Hash(commitTxId), 0);
      const finalInput = new kaspaWasm.TransactionInput({
        previousOutpoint: outpoint,
        signatureScript: new Uint8Array(Buffer.from(p2shSigScript, 'hex')),
        sequence: 0,
        sigOpCount: 1
      });

      const destSpkData = kaspaWasm.payToAddressScript(address);
      const finalOutput = new kaspaWasm.TransactionOutput(
        outputAmount,
        new kaspaWasm.ScriptPublicKey(destSpkData.version, new Uint8Array(Buffer.from(destSpkData.script, 'hex')))
      );

      const finalTx = new kaspaWasm.Transaction({
        inputs: [finalInput],
        outputs: [finalOutput],
        version: 0,
        lockTime: 0n,
        subnetworkId: '0000000000000000000000000000000000000000',
        gas: 0n,
        payload: ''
      });

      console.log('Final TX id:', finalTx.id);

      // Submit
      console.log('\n=== Submitting ===');
      const resolver = new kaspaWasm.Resolver();
      const rpc = new kaspaWasm.RpcClient({ resolver, networkId });

      await rpc.connect();
      const submitResult = await rpc.submitTransaction({ transaction: finalTx });
      console.log('SUCCESS! TxID:', submitResult.transactionId);
      await rpc.disconnect();
    }
  } catch (e: any) {
    console.log('Error:', e.message);
    if (e.stack) console.log(e.stack.split('\n').slice(0, 5).join('\n'));
  }
}

main().catch(console.error);
