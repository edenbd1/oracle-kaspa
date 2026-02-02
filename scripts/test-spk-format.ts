import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');
  
  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  const networkId = new kaspaWasm.NetworkId('testnet-10');
  const address = publicKey.toAddress(networkId);
  
  console.log('Address:', address.toString());
  
  // Get payToAddressScript
  const spkData = kaspaWasm.payToAddressScript(address);
  console.log('\npayToAddressScript result:');
  console.log('  version:', spkData.version);
  console.log('  script:', spkData.script);
  
  // Create ScriptPublicKey object
  const spk = new kaspaWasm.ScriptPublicKey(spkData.version, new Uint8Array(Buffer.from(spkData.script, 'hex')));
  console.log('\nScriptPublicKey object:');
  console.log('  version:', spk.version);
  console.log('  script (hex):', spk.script);
  
  // Check what the serialized output looks like
  const apiBase = 'https://api-tn10.kaspa.org';
  const res = await fetch(`${apiBase}/addresses/${address.toString()}/utxos`);
  const utxos = await res.json();
  
  console.log('\nUTXO scriptPublicKey from API:');
  console.log('  raw:', utxos[0].utxoEntry.scriptPublicKey);
  
  // The raw SPK from API
  const apiSpk = utxos[0].utxoEntry.scriptPublicKey.scriptPublicKey;
  console.log('  spk string:', apiSpk);
  console.log('  length:', apiSpk.length / 2, 'bytes');
  
  // Parse it
  console.log('\nParsing API SPK:');
  console.log('  Byte 0-1 (version?):', apiSpk.slice(0, 2));
  console.log('  Rest:', apiSpk.slice(2));
  
  // Now check the wasm serialized format
  const generator = new kaspaWasm.Generator({
    entries: utxos.slice(0, 1).map((u: any) => ({
      address: u.address,
      outpoint: { transactionId: u.outpoint.transactionId, index: u.outpoint.index },
      amount: BigInt(u.utxoEntry.amount),
      scriptPublicKey: u.utxoEntry.scriptPublicKey.scriptPublicKey,
      blockDaaScore: BigInt(u.utxoEntry.blockDaaScore),
      isCoinbase: u.utxoEntry.isCoinbase
    })),
    outputs: new kaspaWasm.PaymentOutputs([{ address: address.toString(), amount: 50000000n }]),
    priorityFee: 10000n,
    changeAddress: address,
    networkId: networkId,
    sigOpCount: 1,
    minimumSignatures: 1
  });
  
  const pendingTx = await generator.next();
  pendingTx.signInput(0, privateKey);
  const signedTx = pendingTx.transaction;
  const serialized = signedTx.serializeToObject();
  
  console.log('\nWASM serialized output SPK:', serialized.outputs[0].scriptPublicKey);
  console.log('  First 2 chars:', serialized.outputs[0].scriptPublicKey.slice(0, 2));
  console.log('  Next 2 chars:', serialized.outputs[0].scriptPublicKey.slice(2, 4));
  console.log('  Rest:', serialized.outputs[0].scriptPublicKey.slice(4));
}

main().catch(console.error);
