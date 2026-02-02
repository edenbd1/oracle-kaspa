import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');
  
  // The correct SPK format from UTXO
  const spkHex = '20bf59d237b8106e3c1f163460c85755ec531590eb111c1e9a92afefbf6fb1df2dac';
  
  console.log('SPK hex:', spkHex);
  console.log('Length:', spkHex.length / 2, 'bytes');
  
  // Parse manually
  console.log('\nParsed:');
  console.log('  Byte 0 (0x20):', parseInt(spkHex.slice(0, 2), 16), '= OP_DATA_32');
  console.log('  Bytes 1-32 (pubkey):', spkHex.slice(2, 66));
  console.log('  Byte 33 (0xac):', parseInt(spkHex.slice(66), 16), '= OP_CHECKSIG');
  
  // The issue: when creating UTXO entries, the scriptPublicKey should be passed as:
  // - Either a hex string directly
  // - Or as an object { version: 0, scriptPublicKey: "20bf..." }
  
  // Let's see what format createTransactions expects
  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  const networkId = new kaspaWasm.NetworkId('testnet-10');
  const address = publicKey.toAddress(networkId);
  
  // Get UTXO
  const apiBase = 'https://api-tn10.kaspa.org';
  const res = await fetch(`${apiBase}/addresses/${address.toString()}/utxos`);
  const utxos = await res.json();
  const utxo = utxos[0];
  
  // Try different formats for scriptPublicKey
  console.log('\n=== Testing different SPK formats ===');
  
  // Format 1: Plain hex string
  console.log('\nFormat 1: Plain hex string');
  try {
    const result1 = await kaspaWasm.createTransactions({
      entries: [{
        address: utxo.address,
        outpoint: { transactionId: utxo.outpoint.transactionId, index: utxo.outpoint.index },
        amount: BigInt(utxo.utxoEntry.amount),
        scriptPublicKey: utxo.utxoEntry.scriptPublicKey.scriptPublicKey, // hex string
        blockDaaScore: BigInt(utxo.utxoEntry.blockDaaScore),
        isCoinbase: utxo.utxoEntry.isCoinbase
      }],
      outputs: [{ address: address.toString(), amount: 50000000n }],
      priorityFee: 10000n,
      changeAddress: address.toString(),
      networkId: 'testnet-10'
    });
    const tx1 = result1.transactions[0].transaction;
    const inp1 = tx1.inputs[0];
    console.log('  utxo.scriptPublicKey.version:', inp1.utxo.scriptPublicKey.version);
    console.log('  utxo.scriptPublicKey.script:', inp1.utxo.scriptPublicKey.script);
  } catch (e: any) {
    console.log('  Error:', e.message);
  }
  
  // Format 2: Object with version and scriptPublicKey
  console.log('\nFormat 2: Object { version, scriptPublicKey }');
  try {
    const result2 = await kaspaWasm.createTransactions({
      entries: [{
        address: utxo.address,
        outpoint: { transactionId: utxo.outpoint.transactionId, index: utxo.outpoint.index },
        amount: BigInt(utxo.utxoEntry.amount),
        scriptPublicKey: { version: 0, scriptPublicKey: utxo.utxoEntry.scriptPublicKey.scriptPublicKey },
        blockDaaScore: BigInt(utxo.utxoEntry.blockDaaScore),
        isCoinbase: utxo.utxoEntry.isCoinbase
      }],
      outputs: [{ address: address.toString(), amount: 50000000n }],
      priorityFee: 10000n,
      changeAddress: address.toString(),
      networkId: 'testnet-10'
    });
    const tx2 = result2.transactions[0].transaction;
    const inp2 = tx2.inputs[0];
    console.log('  utxo.scriptPublicKey.version:', inp2.utxo.scriptPublicKey.version);
    console.log('  utxo.scriptPublicKey.script:', inp2.utxo.scriptPublicKey.script);
  } catch (e: any) {
    console.log('  Error:', e.message);
  }
  
  // Format 3: Object with script only
  console.log('\nFormat 3: Object { script, version }');
  try {
    const result3 = await kaspaWasm.createTransactions({
      entries: [{
        address: utxo.address,
        outpoint: { transactionId: utxo.outpoint.transactionId, index: utxo.outpoint.index },
        amount: BigInt(utxo.utxoEntry.amount),
        scriptPublicKey: { script: utxo.utxoEntry.scriptPublicKey.scriptPublicKey, version: 0 },
        blockDaaScore: BigInt(utxo.utxoEntry.blockDaaScore),
        isCoinbase: utxo.utxoEntry.isCoinbase
      }],
      outputs: [{ address: address.toString(), amount: 50000000n }],
      priorityFee: 10000n,
      changeAddress: address.toString(),
      networkId: 'testnet-10'
    });
    const tx3 = result3.transactions[0].transaction;
    const inp3 = tx3.inputs[0];
    console.log('  utxo.scriptPublicKey.version:', inp3.utxo.scriptPublicKey.version);
    console.log('  utxo.scriptPublicKey.script:', inp3.utxo.scriptPublicKey.script);
  } catch (e: any) {
    console.log('  Error:', e.message);
  }
}

main().catch(console.error);
