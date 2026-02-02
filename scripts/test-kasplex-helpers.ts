import 'dotenv/config';

async function main() {
  const kasplexModule = await import('kasplexbuilder');
  const kaspaWasm = await import('kaspa-wasm');

  console.log('=== KasplexBuilder exports ===');
  const exports = Object.keys(kasplexModule);
  console.log('Exports:', exports);

  // Check Inscription
  console.log('\n=== Inscription ===');
  const { Inscription } = kasplexModule;
  console.log('Inscription:', Inscription);
  const inst = new Inscription('mint', { tick: 'TEST' });
  console.log('Instance:', inst);
  console.log('Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(inst)));

  // Check if there's a sign or build method
  console.log('\n=== Inscription methods ===');
  console.log('write:', typeof inst.write);
  console.log('build:', typeof (inst as any).build);
  console.log('sign:', typeof (inst as any).sign);

  // Check for other helpers
  for (const exp of exports) {
    const val = (kasplexModule as any)[exp];
    if (typeof val === 'function' && val !== Inscription) {
      console.log(`${exp}: function (${val.length} args)`);
    } else if (typeof val === 'object') {
      console.log(`${exp}: object`, Object.keys(val).slice(0, 5));
    }
  }

  // Now let's check the kaspa-wasm SDK more carefully for any P2SH helpers
  console.log('\n=== kaspa-wasm P2SH exports ===');
  const p2shExports = Object.keys(kaspaWasm).filter(k =>
    k.toLowerCase().includes('p2sh') ||
    k.toLowerCase().includes('scripthash') ||
    k.toLowerCase().includes('redeem')
  );
  console.log('P2SH-related:', p2shExports);

  // Check what payToScriptHashScript does
  console.log('\n=== payToScriptHashScript ===');
  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  const xOnlyPubKey = publicKey.toXOnlyPublicKey();

  const inst2 = new Inscription('mint', { tick: 'YBTCA' });
  const script = new kaspaWasm.ScriptBuilder();
  inst2.write(script, xOnlyPubKey.toString());

  // Get the P2SH script
  const p2shScript = script.createPayToScriptHashScript();
  console.log('P2SH script type:', typeof p2shScript);
  console.log('P2SH script:', p2shScript);
  console.log('P2SH script methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(p2shScript)));

  // Check ScriptBuilder methods
  console.log('\n=== ScriptBuilder methods ===');
  const sb = new kaspaWasm.ScriptBuilder();
  console.log('Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(sb)));

  // Check if there's a way to sign P2SH directly
  console.log('\n=== Looking for signing helpers ===');
  const signHelpers = Object.keys(kaspaWasm).filter(k =>
    k.toLowerCase().includes('sign') &&
    (k.toLowerCase().includes('script') || k.toLowerCase().includes('p2sh'))
  );
  console.log('Script signing:', signHelpers);

  // Check payToScriptHashSignatureScript parameters more carefully
  console.log('\n=== payToScriptHashSignatureScript ===');
  console.log('Function length:', kaspaWasm.payToScriptHashSignatureScript.length);

  // It takes (redeemScript, signature)
  // Let's see what format the signature needs to be in

  const testRedeemScript = 'abcd1234';
  const testSig = '0'.repeat(130); // 65 bytes in hex

  try {
    const result = kaspaWasm.payToScriptHashSignatureScript(testRedeemScript, testSig);
    console.log('Result type:', typeof result);
    console.log('Result:', result.slice(0, 40) + '...');
    console.log('Result length:', result.length / 2, 'bytes');
  } catch (e: any) {
    console.log('Error:', e.message);
  }
}

main().catch(console.error);
