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

  // Create the reveal transaction
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

  // Create PendingTransaction from it
  const pending = new kaspaWasm.PendingTransaction(tx);
  console.log('PendingTransaction created');

  // Try createInputSignature on the pending tx (without UTXOs)
  console.log('\n=== Testing createInputSignature ===');
  try {
    const sig = pending.createInputSignature(0, privateKey, kaspaWasm.SighashType.All);
    console.log('Signature:', Buffer.from(sig).toString('hex').slice(0, 60) + '...');
  } catch (e: any) {
    console.log('Failed:', e.message);
  }

  // Try signInput
  console.log('\n=== Testing signInput ===');
  try {
    pending.signInput(0, privateKey);
    console.log('signInput succeeded');
    const signedObj = pending.serializeToObject();
    console.log('Signature script:', signedObj.inputs?.[0]?.signatureScript || 'N/A');
  } catch (e: any) {
    console.log('Failed:', e.message);
  }

  // Try sign
  console.log('\n=== Testing sign ===');
  try {
    pending.sign([privateKey]);
    console.log('sign succeeded');
    const signedObj = pending.serializeToObject();
    console.log('Signature script:', signedObj.inputs?.[0]?.signatureScript?.slice(0, 40) || 'N/A');
  } catch (e: any) {
    console.log('Failed:', e.message);
  }

  // Now test with createTransactions to see the correct format
  console.log('\n=== Getting correct format from createTransactions ===');

  const apiBase = 'https://api-tn10.kaspa.org';
  const utxoRes = await fetch(`${apiBase}/addresses/${address.toString()}/utxos`);
  const utxos = await utxoRes.json();

  if (utxos.length > 0) {
    // Use a small UTXO
    const smallUtxo = utxos.sort((a: any, b: any) => Number(BigInt(a.utxoEntry.amount) - BigInt(b.utxoEntry.amount)))[0];

    const normalEntry = {
      address: address.toString(),
      outpoint: {
        transactionId: smallUtxo.outpoint.transactionId,
        index: smallUtxo.outpoint.index
      },
      amount: BigInt(smallUtxo.utxoEntry.amount),
      scriptPublicKey: {
        script: smallUtxo.utxoEntry.scriptPublicKey.scriptPublicKey,
        version: 0
      },
      blockDaaScore: BigInt(smallUtxo.utxoEntry.blockDaaScore),
      isCoinbase: false
    };

    console.log('Entry SPK:', normalEntry.scriptPublicKey.script.slice(0, 40) + '...');

    const result = await kaspaWasm.createTransactions({
      entries: [normalEntry],
      outputs: [{
        address: address.toString(),
        amount: BigInt(smallUtxo.utxoEntry.amount) - 50000n
      }],
      priorityFee: 10000n,
      changeAddress: address.toString(),
      networkId: 'testnet-10'
    });

    if (result.transactions?.length > 0) {
      const pendingFromCreate = result.transactions[0];
      console.log('PendingTransaction from createTransactions');

      // Check getUtxoEntries
      try {
        const entries = pendingFromCreate.getUtxoEntries();
        console.log('UtxoEntries:', entries);
        console.log('UtxoEntries type:', typeof entries);
        if (entries && typeof entries === 'object') {
          console.log('UtxoEntries constructor:', entries.constructor?.name);
          console.log('UtxoEntries length:', (entries as any).length);
        }
      } catch (e: any) {
        console.log('getUtxoEntries failed:', e.message);
      }

      // Try createInputSignature
      console.log('\n=== createInputSignature on valid PendingTx ===');
      try {
        const sig = pendingFromCreate.createInputSignature(0, privateKey, kaspaWasm.SighashType.All);
        console.log('Signature:', Buffer.from(sig).toString('hex'));
        console.log('Signature length:', sig.length, 'bytes');
      } catch (e: any) {
        console.log('Failed:', e.message);
      }

      // Now try to use this signature format for P2SH
      console.log('\n=== Building P2SH signature script ===');

      // The signature from a normal transaction should work for P2SH
      // if we compute it with the redeem script
      const sig = pendingFromCreate.createInputSignature(0, privateKey, kaspaWasm.SighashType.All);
      const sigHex = Buffer.from(sig).toString('hex');
      console.log('Signature hex:', sigHex);

      // Build P2SH signature script
      const p2shSigScript = kaspaWasm.payToScriptHashSignatureScript(redeemScriptHex, sigHex);
      console.log('P2SH sig script:', p2shSigScript.slice(0, 60) + '...');
      console.log('P2SH sig script length:', p2shSigScript.length / 2, 'bytes');
    }
  }

  // Key insight: We need to create a PendingTransaction with the redeem script as SPK
  console.log('\n=== Creating PendingTx with redeem script SPK ===');

  // Use createTransactions with our P2SH input but redeem script as SPK
  const p2shEntry = {
    address: address.toString(), // Address for validation
    outpoint: {
      transactionId: commitTxId,
      index: 0
    },
    amount: inputAmount,
    // USE REDEEM SCRIPT as scriptPublicKey
    scriptPublicKey: {
      script: redeemScriptHex,
      version: 0
    },
    blockDaaScore: 0n,
    isCoinbase: false
  };

  console.log('P2SH entry with redeem script as SPK');

  try {
    const result = await kaspaWasm.createTransactions({
      entries: [p2shEntry],
      outputs: [{
        address: address.toString(),
        amount: outputAmount
      }],
      priorityFee: 10000n,
      changeAddress: address.toString(),
      networkId: 'testnet-10'
    });

    if (result.transactions?.length > 0) {
      const pendingP2sh = result.transactions[0];
      console.log('PendingTransaction created with redeem SPK!');

      // Create signature using the redeem script SPK
      const sig = pendingP2sh.createInputSignature(0, privateKey, kaspaWasm.SighashType.All);
      console.log('P2SH signature:', Buffer.from(sig).toString('hex'));

      // Build final P2SH script
      const sigHex = Buffer.from(sig).toString('hex');
      const p2shSigScript = kaspaWasm.payToScriptHashSignatureScript(redeemScriptHex, sigHex);
      console.log('P2SH sig script:', p2shSigScript);
    }
  } catch (e: any) {
    console.log('Failed:', e.message);
  }
}

main().catch(console.error);
