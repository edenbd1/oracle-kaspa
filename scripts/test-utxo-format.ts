import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');
  
  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  const address = publicKey.toAddress('testnet-10');
  
  // Fetch UTXOs
  const apiBase = 'https://api-tn10.kaspa.org';
  const res = await fetch(`${apiBase}/addresses/${address.toString()}/utxos`);
  const utxos = await res.json();
  const utxo = utxos[0];
  
  console.log('Raw UTXO from API:', JSON.stringify(utxo, null, 2));
  
  // Create input without utxo first
  const txIdHash = new kaspaWasm.Hash(utxo.outpoint.transactionId);
  const outpoint = new kaspaWasm.TransactionOutpoint(txIdHash, utxo.outpoint.index);
  
  const input = new kaspaWasm.TransactionInput({
    previousOutpoint: outpoint,
    signatureScript: new Uint8Array(),
    sequence: 0,
    sigOpCount: 1
  });
  
  console.log('\nInput created. Checking utxo property...');
  console.log('input.utxo getter:', typeof input.utxo);
  
  // Try to set utxo using a plain object format
  console.log('\n=== Trying to set utxo with plain object ===');
  const utxoSpkHex = utxo.utxoEntry.scriptPublicKey.scriptPublicKey;
  
  // Try direct object assignment
  try {
    (input as any).utxo = {
      amount: BigInt(utxo.utxoEntry.amount),
      scriptPublicKey: utxoSpkHex,  // hex string
      blockDaaScore: BigInt(utxo.utxoEntry.blockDaaScore),
      isCoinbase: utxo.utxoEntry.isCoinbase
    };
    console.log('Set utxo with object, input.utxo:', input.utxo);
  } catch (e) {
    console.log('Error setting utxo:', e);
  }
  
  // Maybe use Generator instead - it's the recommended high-level API
  console.log('\n=== Testing Generator approach ===');
  
  // PaymentOutput structure
  const paymentOutput = new kaspaWasm.PaymentOutput(address, 100000n);
  console.log('PaymentOutput:', paymentOutput);
  
  // Check Generator interface
  const genSettings = {
    utxoEntries: utxos.map((u: any) => ({
      address: u.address,
      outpoint: {
        transactionId: u.outpoint.transactionId,
        index: u.outpoint.index
      },
      amount: BigInt(u.utxoEntry.amount),
      scriptPublicKey: u.utxoEntry.scriptPublicKey.scriptPublicKey,
      blockDaaScore: BigInt(u.utxoEntry.blockDaaScore),
      isCoinbase: u.utxoEntry.isCoinbase
    })),
    outputs: [paymentOutput],
    priorityFee: 10000n,
    changeAddress: address
  };
  
  console.log('\nGenerator settings:', JSON.stringify({
    ...genSettings,
    utxoEntries: genSettings.utxoEntries.length + ' entries'
  }, (_, v) => typeof v === 'bigint' ? v.toString() : v));
  
  try {
    const generator = new kaspaWasm.Generator(genSettings);
    console.log('Generator created:', generator);
    console.log('Generator summary:', generator.summary);
  } catch (e: any) {
    console.log('Generator error:', e.message || e);
  }
}

main().catch(console.error);
