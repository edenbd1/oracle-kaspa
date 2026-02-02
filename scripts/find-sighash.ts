import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');
  
  // Search for hash/sign related functions
  const exports = Object.keys(kaspaWasm);
  
  console.log('=== Hash/Sign related exports ===');
  const relevant = exports.filter(e => 
    e.toLowerCase().includes('hash') ||
    e.toLowerCase().includes('sign') ||
    e.toLowerCase().includes('sighash') ||
    e.toLowerCase().includes('script')
  ).sort();
  
  for (const name of relevant) {
    const val = (kaspaWasm as any)[name];
    if (typeof val === 'function') {
      console.log(`${name}: ${val.toString().slice(0, 100).replace(/\n/g, ' ')}...`);
    }
  }
  
  // Check TransactionSigningHash more closely
  console.log('\n=== TransactionSigningHash ===');
  const tsh = new kaspaWasm.TransactionSigningHash();
  console.log('update:', tsh.update.toString().slice(0, 200));
  console.log('finalize:', tsh.finalize.toString().slice(0, 200));
  
  // Check TransactionSigningHashECDSA
  console.log('\n=== TransactionSigningHashECDSA ===');
  console.log('Available:', typeof kaspaWasm.TransactionSigningHashECDSA);
  if (kaspaWasm.TransactionSigningHashECDSA) {
    console.log('Methods:', Object.getOwnPropertyNames(kaspaWasm.TransactionSigningHashECDSA.prototype));
  }
}

main().catch(console.error);
