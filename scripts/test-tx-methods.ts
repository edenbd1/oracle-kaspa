import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');

  // Check Transaction class methods
  console.log('=== Transaction prototype ===');
  const tx = new kaspaWasm.Transaction({
    inputs: [],
    outputs: [],
    version: 0,
    lockTime: 0n,
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: 0n,
    payload: ''
  });

  const txProto = Object.getOwnPropertyNames(Object.getPrototypeOf(tx));
  console.log('Transaction methods:', txProto.sort().join(', '));

  // Check if there's a way to set UTXO entries
  console.log('\n=== Looking for UTXO/entry methods ===');
  const relevantMethods = txProto.filter(m =>
    m.toLowerCase().includes('utxo') ||
    m.toLowerCase().includes('entry') ||
    m.toLowerCase().includes('input') ||
    m.toLowerCase().includes('sign')
  );
  console.log('Relevant:', relevantMethods);

  // Check if inputs have any UTXO methods
  console.log('\n=== TransactionInput ===');
  const inp = new kaspaWasm.TransactionInput({
    previousOutpoint: new kaspaWasm.TransactionOutpoint(new kaspaWasm.Hash('0'.repeat(64)), 0),
    signatureScript: new Uint8Array(),
    sequence: 0,
    sigOpCount: 1
  });
  const inpProto = Object.getOwnPropertyNames(Object.getPrototypeOf(inp));
  console.log('TransactionInput methods:', inpProto.sort().join(', '));

  // Check signTransaction signature
  console.log('\n=== signTransaction ===');
  console.log('Type:', typeof kaspaWasm.signTransaction);
  console.log('Length (args):', kaspaWasm.signTransaction.length);

  // Check if there's a way to set utxo on Transaction
  console.log('\n=== Transaction properties ===');
  console.log('Has setUtxoEntries:', 'setUtxoEntries' in tx);
  console.log('Has setInputUtxo:', 'setInputUtxo' in tx);
  console.log('Has fillUtxoEntries:', 'fillUtxoEntries' in tx);

  // Check what signTransaction expects
  console.log('\n=== Checking UtxoEntryReference ===');
  if (kaspaWasm.UtxoEntryReference) {
    console.log('UtxoEntryReference available');
    const ueRefProto = Object.getOwnPropertyNames(kaspaWasm.UtxoEntryReference.prototype || {});
    console.log('Methods:', ueRefProto);
  } else {
    console.log('UtxoEntryReference not available');
  }

  // Check UtxoEntry
  console.log('\n=== UtxoEntry ===');
  if (kaspaWasm.UtxoEntry) {
    console.log('UtxoEntry available');
    const spk = new kaspaWasm.ScriptPublicKey(0, new Uint8Array([1,2,3]));
    const entry = new kaspaWasm.UtxoEntry(1000n, spk, 0n, false);
    const entryProto = Object.getOwnPropertyNames(Object.getPrototypeOf(entry));
    console.log('Methods:', entryProto.sort().join(', '));
  }

  // Check if signTransaction has special handling for P2SH
  console.log('\n=== SighashType ===');
  console.log('SighashType:', kaspaWasm.SighashType);

  // Check createInputSignature more carefully
  console.log('\n=== createInputSignature ===');
  console.log('Available:', typeof kaspaWasm.createInputSignature);
  console.log('Args:', kaspaWasm.createInputSignature?.length);
}

main().catch(console.error);
