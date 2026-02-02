import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');
  
  console.log('Available kaspa-wasm exports:');
  console.log(Object.keys(kaspaWasm).sort().join('\n'));
  
  console.log('\n\n=== Checking for high-level APIs ===');
  const highLevel = ['createTransactions', 'Generator', 'PendingTransaction', 'UtxoContext', 'UtxoProcessor'];
  for (const name of highLevel) {
    console.log(`${name}: ${typeof (kaspaWasm as any)[name]}`);
  }
  
  console.log('\n\n=== Transaction signature methods ===');
  const tx = new kaspaWasm.Transaction({
    inputs: [],
    outputs: [],
    version: 0,
    lockTime: 0n,
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: 0n,
    payload: ''
  });
  console.log('Transaction methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(tx)));
  
  console.log('\n\n=== signTransaction function ===');
  console.log('signTransaction:', typeof (kaspaWasm as any).signTransaction);
}

main().catch(console.error);
