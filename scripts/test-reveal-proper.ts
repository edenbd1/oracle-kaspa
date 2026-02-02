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

  // Create inscription and get script
  const inscription = new Inscription('mint', { tick: 'YBTCA' });
  const script = new kaspaWasm.ScriptBuilder();
  inscription.write(script, xOnlyPubKey.toString());

  // Get the P2SH address (commit address)
  const p2shScript = script.createPayToScriptHashScript();
  const commitAddress = kaspaWasm.addressFromScriptPublicKey(p2shScript, 'testnet-10');

  console.log('P2SH commit address:', commitAddress.toString());
  console.log('Platform address:', address.toString());

  // Recent commit TX
  const commitTxId = '2a20c496408389953bbdc79c311ba6c8809684fe9d9c4f7ddcc5899deac1855b';

  // Fetch the UTXO from the P2SH commit address
  console.log('\n=== Fetching UTXOs from commit address ===');
  const apiBase = 'https://api-tn10.kaspa.org';

  // Try fetching UTXOs from the commit address
  const commitUtxoRes = await fetch(`${apiBase}/addresses/${commitAddress.toString()}/utxos`);
  const commitUtxos = await commitUtxoRes.json();

  console.log('Commit UTXOs response:', commitUtxos);
  const commitUtxoCount = Array.isArray(commitUtxos) ? commitUtxos.length : 0;
  console.log('Commit UTXOs count:', commitUtxoCount);

  if (commitUtxoCount === 0) {
    console.log('No UTXOs at commit address. Need to create a new commit transaction.');

    // Let's create a fresh commit and reveal flow
    console.log('\n=== Creating fresh commit transaction ===');

    // Get platform wallet UTXOs
    const platformUtxoRes = await fetch(`${apiBase}/addresses/${address.toString()}/utxos`);
    const platformUtxos = await platformUtxoRes.json();

    if (platformUtxos.length === 0) {
      console.log('No UTXOs in platform wallet!');
      return;
    }

    // Select a UTXO for the commit
    const utxo = platformUtxos.sort((a: any, b: any) =>
      Number(BigInt(a.utxoEntry.amount) - BigInt(b.utxoEntry.amount))
    )[0];

    const commitAmount = 50000000n; // 0.5 KAS

    console.log('Using UTXO:', utxo.outpoint.transactionId, 'amount:', utxo.utxoEntry.amount);

    // Create commit transaction
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

    const commitResult = await kaspaWasm.createTransactions({
      entries: [entry],
      outputs: [{
        address: commitAddress.toString(),
        amount: commitAmount
      }],
      priorityFee: 10000n,
      changeAddress: address.toString(),
      networkId: 'testnet-10'
    });

    const commitPending = commitResult.transactions[0];
    const commitTx = commitPending.transaction;
    console.log('Commit TX id:', commitTx.id);

    // Sign and submit commit
    kaspaWasm.signTransaction(commitTx, [privateKey], true);
    console.log('Commit TX signed');

    // Submit via RPC
    const resolver = new kaspaWasm.Resolver();
    const rpc = new kaspaWasm.RpcClient({ resolver, networkId });
    await rpc.connect();

    const commitSubmitResult = await rpc.submitTransaction({ transaction: commitTx });
    console.log('Commit submitted:', commitSubmitResult.transactionId);

    // Wait for confirmation
    console.log('Waiting for commit confirmation...');
    await new Promise(r => setTimeout(r, 3000));

    // Now create the reveal transaction
    console.log('\n=== Creating reveal transaction ===');

    // Get the commit UTXO
    const newCommitUtxoRes = await fetch(`${apiBase}/addresses/${commitAddress.toString()}/utxos`);
    const newCommitUtxos = await newCommitUtxoRes.json();

    console.log('Commit UTXOs after wait:', newCommitUtxos.length);

    if (newCommitUtxos.length > 0) {
      await createAndSubmitReveal(
        kaspaWasm,
        script,
        newCommitUtxos[0],
        commitAddress.toString(),
        address.toString(),
        privateKey,
        rpc
      );
    } else {
      console.log('Commit UTXO not yet visible. Try running the script again in a few seconds.');
    }

    await rpc.disconnect();
  } else {
    // Use existing commit UTXO
    console.log('Found existing commit UTXO');
    console.log('UTXO details:', JSON.stringify(commitUtxos[0], null, 2));

    const resolver = new kaspaWasm.Resolver();
    const rpc = new kaspaWasm.RpcClient({ resolver, networkId });
    await rpc.connect();

    await createAndSubmitReveal(
      kaspaWasm,
      script,
      commitUtxos[0],
      commitAddress.toString(),
      address.toString(),
      privateKey,
      rpc
    );

    await rpc.disconnect();
  }
}

async function createAndSubmitReveal(
  kaspaWasm: any,
  script: any,
  commitUtxo: any,
  commitAddress: string,
  destAddress: string,
  privateKey: any,
  rpc: any
) {
  console.log('Commit UTXO:', JSON.stringify(commitUtxo, null, 2));

  const inputAmount = BigInt(commitUtxo.utxoEntry.amount);
  const outputAmount = inputAmount - 10000n; // Fee

  // Create the P2SH UTXO entry
  // IMPORTANT: Use the actual P2SH scriptPublicKey from the commit UTXO
  const p2shEntry = {
    address: commitAddress,
    outpoint: {
      transactionId: commitUtxo.outpoint.transactionId,
      index: commitUtxo.outpoint.index
    },
    amount: inputAmount,
    scriptPublicKey: {
      script: commitUtxo.utxoEntry.scriptPublicKey.scriptPublicKey,
      version: 0
    },
    blockDaaScore: BigInt(commitUtxo.utxoEntry.blockDaaScore),
    isCoinbase: false
  };

  console.log('P2SH entry:', JSON.stringify(p2shEntry, (k, v) => typeof v === 'bigint' ? v.toString() : v));

  // Create the reveal transaction
  const revealResult = await kaspaWasm.createTransactions({
    entries: [p2shEntry],
    outputs: [{
      address: destAddress,
      amount: outputAmount
    }],
    priorityFee: 0n,
    changeAddress: destAddress,
    networkId: 'testnet-10'
  });

  console.log('Reveal TX count:', revealResult.transactions.length);

  if (revealResult.transactions.length > 0) {
    const revealPending = revealResult.transactions[0];
    const revealTx = revealPending.transaction;
    console.log('Reveal TX id:', revealTx.id);

    // Step 1: Sign with standard signing (this leaves P2SH inputs unsigned)
    revealPending.sign([privateKey], false);
    console.log('Standard signing done');

    // Step 2: Find the P2SH input (the one with empty signatureScript)
    const inputs = revealTx.inputs;
    let p2shInputIndex = -1;
    for (let i = 0; i < inputs.length; i++) {
      const serialized = revealTx.serializeToObject();
      if (serialized.inputs[i].signatureScript === '' || serialized.inputs[i].signatureScript === null) {
        p2shInputIndex = i;
        break;
      }
    }

    console.log('P2SH input index:', p2shInputIndex);

    if (p2shInputIndex !== -1) {
      // Step 3: Create signature for the P2SH input
      const signature = revealPending.createInputSignature(p2shInputIndex, privateKey, kaspaWasm.SighashType.All);
      console.log('P2SH signature created:', Buffer.from(signature).toString('hex').slice(0, 40) + '...');

      // Step 4: Encode with the P2SH script
      const p2shSigScript = script.encodePayToScriptHashSignatureScript(signature);
      console.log('P2SH sig script:', p2shSigScript.slice(0, 60) + '...');

      // Step 5: Fill the input
      revealPending.fillInput(p2shInputIndex, p2shSigScript);
      console.log('Input filled');

      // Step 6: Submit
      console.log('Submitting reveal...');
      try {
        const revealHash = await revealPending.submit(rpc);
        console.log('SUCCESS! Reveal TX:', revealHash);
      } catch (e: any) {
        console.log('Submit error:', e.message);

        // Try manual submission
        const finalTx = revealPending.transaction;
        console.log('Trying manual submission...');
        const submitResult = await rpc.submitTransaction({ transaction: finalTx });
        console.log('Manual submit result:', submitResult.transactionId);
      }
    } else {
      console.log('No P2SH input found, trying full sign');
      kaspaWasm.signTransaction(revealTx, [privateKey], true);
    }
  }
}

main().catch(console.error);
