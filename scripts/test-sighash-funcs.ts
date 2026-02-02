import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');

  // List all exports
  const exports = Object.keys(kaspaWasm).sort();
  console.log('Total exports:', exports.length);

  // Find hash/sighash related
  console.log('\n=== Hash-related exports ===');
  const hashFuncs = exports.filter(e =>
    e.toLowerCase().includes('hash') ||
    e.toLowerCase().includes('sig')
  );
  for (const name of hashFuncs) {
    const val = (kaspaWasm as any)[name];
    if (typeof val === 'function') {
      console.log(`${name}(${val.length} args)`);
    } else {
      console.log(`${name}: ${typeof val}`);
    }
  }

  // Find calc/compute related
  console.log('\n=== Calc/Compute exports ===');
  const calcFuncs = exports.filter(e =>
    e.toLowerCase().includes('calc') ||
    e.toLowerCase().includes('compute')
  );
  console.log(calcFuncs);

  // Check if there's something like calculateSignatureHash
  console.log('\n=== Checking specific functions ===');
  const names = [
    'calcSchnorrSignatureHash',
    'calculateSignatureHash',
    'computeSignatureHash',
    'calcSigHash',
    'sigHashCalc',
    'signatureHash',
    'calcEcdsaSignatureHash'
  ];
  for (const name of names) {
    if ((kaspaWasm as any)[name]) {
      console.log(`Found: ${name}`);
    }
  }

  // Check TransactionSigningHash internals
  console.log('\n=== TransactionSigningHash ===');
  const tsh = new kaspaWasm.TransactionSigningHash();
  const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(tsh));
  console.log('Methods:', proto);

  // Check if update can take more params
  console.log('\nupdate.length:', tsh.update.length);

  // Try calling update with different number of args
  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  const networkId = new kaspaWasm.NetworkId('testnet-10');
  const address = publicKey.toAddress(networkId);

  const outpoint = new kaspaWasm.TransactionOutpoint(new kaspaWasm.Hash('0'.repeat(64)), 0);
  const input = new kaspaWasm.TransactionInput({
    previousOutpoint: outpoint,
    signatureScript: new Uint8Array(),
    sequence: 0,
    sigOpCount: 1
  });

  const destSpkData = kaspaWasm.payToAddressScript(address);
  const output = new kaspaWasm.TransactionOutput(
    1000000n,
    new kaspaWasm.ScriptPublicKey(destSpkData.version, new Uint8Array(Buffer.from(destSpkData.script, 'hex')))
  );

  const tx = new kaspaWasm.Transaction({
    inputs: [input],
    outputs: [output],
    version: 0,
    lockTime: 0n,
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: 0n,
    payload: ''
  });

  // Try update with additional params
  console.log('\n=== Trying update with extra params ===');

  const spk = new kaspaWasm.ScriptPublicKey(0, new Uint8Array([1,2,3,4]));

  try {
    const tsh2 = new kaspaWasm.TransactionSigningHash();
    (tsh2.update as any)(tx, 0, spk, 1000n);
    console.log('update(tx, index, spk, amount) succeeded');
    const hash = tsh2.finalize();
    console.log('Hash:', hash);
  } catch (e: any) {
    console.log('update(tx, index, spk, amount) failed:', e.message);
  }

  // Check sign-related module functions that might take more params
  console.log('\n=== Checking module-level signing functions ===');
  const signFuncs = exports.filter(e => e.toLowerCase().includes('sign') && typeof (kaspaWasm as any)[e] === 'function');
  for (const name of signFuncs) {
    const fn = (kaspaWasm as any)[name];
    console.log(`${name}: ${fn.length} args`);
  }

  // Check if there's a way to set script for hash
  console.log('\n=== Looking for setScript or similar ===');
  const setFuncs = exports.filter(e =>
    e.toLowerCase().includes('set') ||
    e.toLowerCase().includes('with')
  );
  console.log(setFuncs.filter(e => typeof (kaspaWasm as any)[e] === 'function'));

  // Check Signer class
  console.log('\n=== Checking Signer/SigningContext ===');
  if (kaspaWasm.Signer) {
    console.log('Signer available');
    console.log('Methods:', Object.getOwnPropertyNames(kaspaWasm.Signer.prototype || {}));
  }
  if (kaspaWasm.SigningContext) {
    console.log('SigningContext available');
  }

  // Maybe we need to look at how the wasm computes sighash internally
  // Check for internal exports that start with __
  console.log('\n=== Internal exports (starting with __wbg) ===');
  const wbgFuncs = exports.filter(e => e.startsWith('__wbg') && (e.includes('sign') || e.includes('hash')));
  console.log(wbgFuncs.slice(0, 20));
}

main().catch(console.error);
