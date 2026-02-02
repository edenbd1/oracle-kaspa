import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');
  
  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  const networkId = new kaspaWasm.NetworkId('testnet-10');
  const address = publicKey.toAddress(networkId);
  
  console.log('Address:', address.toString());
  
  // Fetch UTXOs
  const apiBase = 'https://api-tn10.kaspa.org';
  const res = await fetch(`${apiBase}/addresses/${address.toString()}/utxos`);
  const utxos = await res.json();
  
  // Find small UTXO
  const smallUtxos = utxos
    .map((u: any) => ({ ...u, amountN: BigInt(u.utxoEntry.amount) }))
    .filter((u: any) => u.amountN >= 50000000n && u.amountN <= 200000000n)
    .sort((a: any, b: any) => Number(a.amountN - b.amountN));
    
  const utxo = smallUtxos[0];
  console.log('Using UTXO:', utxo.outpoint.transactionId, 'amount:', utxo.amountN.toString());
  
  const utxoEntries = [{
    address: utxo.address,
    outpoint: {
      transactionId: utxo.outpoint.transactionId,
      index: utxo.outpoint.index
    },
    amount: utxo.amountN,
    scriptPublicKey: utxo.utxoEntry.scriptPublicKey.scriptPublicKey,
    blockDaaScore: BigInt(utxo.utxoEntry.blockDaaScore),
    isCoinbase: utxo.utxoEntry.isCoinbase
  }];
  
  const outputAmount = utxo.amountN / 2n;
  
  const outputs = new kaspaWasm.PaymentOutputs([{
    address: address.toString(),
    amount: outputAmount
  }]);
  
  const generator = new kaspaWasm.Generator({
    entries: utxoEntries,
    outputs: outputs,
    priorityFee: 10000n,
    changeAddress: address,
    networkId: networkId,
    sigOpCount: 1,
    minimumSignatures: 1
  });
  
  const pendingTx = await generator.next();
  console.log('\nPending TX id:', pendingTx.id);
  
  // Sign using signInput
  pendingTx.signInput(0, privateKey);
  
  const signedTx = pendingTx.transaction;
  const serialized = signedTx.serializeToObject();
  
  console.log('\nSerialized TX:');
  console.log('  Input sigScript:', serialized.inputs[0].signatureScript);
  console.log('  Output SPK:', serialized.outputs[0].scriptPublicKey);
  
  // Try using serializeToJSON
  const jsonStr = signedTx.serializeToJSON();
  const json = JSON.parse(jsonStr);
  
  console.log('\nJSON TX:');
  console.log('  Input sigScript:', json.inputs[0].signatureScript);
  console.log('  Output SPK:', json.outputs[0].scriptPublicKey);
  
  // Try to submit
  console.log('\n=== Trying to submit ===');
  
  // Build API format manually
  const apiTx = {
    version: json.version,
    inputs: json.inputs.map((inp: any) => ({
      previousOutpoint: {
        transactionId: inp.transactionId,
        index: inp.index
      },
      signatureScript: inp.signatureScript,
      sequence: inp.sequence,
      sigOpCount: inp.sigOpCount
    })),
    outputs: json.outputs.map((out: any) => {
      // SPK is in format "0000xxxx..." where first 4 chars are version
      const spk = out.scriptPublicKey;
      return {
        amount: out.value,
        scriptPublicKey: {
          version: 0,
          scriptPublicKey: spk.slice(4) // Skip version prefix
        }
      };
    }),
    lockTime: json.lockTime,
    subnetworkId: json.subnetworkId,
    gas: json.gas,
    payload: json.payload || ''
  };
  
  console.log('API TX format:');
  console.log(JSON.stringify(apiTx, null, 2));
  
  const submitRes = await fetch(`${apiBase}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction: apiTx })
  });
  
  console.log('\nSubmit status:', submitRes.status);
  const submitText = await submitRes.text();
  console.log('Submit response:', submitText);
}

main().catch(console.error);
