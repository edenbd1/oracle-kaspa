import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');
  
  console.log('=== Testing signTransaction function ===');
  console.log(kaspaWasm.signTransaction.toString().slice(0, 500));
  
  console.log('\n=== Testing createTransactions function ===');
  console.log(kaspaWasm.createTransactions.toString().slice(0, 500));
  
  console.log('\n=== Testing Generator ===');
  console.log('Generator:', kaspaWasm.Generator.toString().slice(0, 500));
  
  // Let's also check createInputSignature
  console.log('\n=== Testing createInputSignature ===');
  console.log(kaspaWasm.createInputSignature.toString().slice(0, 500));
  
  // Check TransactionUtxoEntry
  console.log('\n=== TransactionUtxoEntry ===');
  console.log(kaspaWasm.TransactionUtxoEntry.toString().slice(0, 500));
}

main().catch(console.error);
