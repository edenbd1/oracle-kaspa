import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');
  const kasplexModule = await import('kasplexbuilder');
  const { Inscription } = kasplexModule;
  
  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  const networkId = new kaspaWasm.NetworkId('testnet-10');
  const address = publicKey.toAddress(networkId);
  
  console.log('Address:', address.toString());
  
  // Create a test inscription
  const inscription = new Inscription('mint', { tick: 'TEST' });
  
  // Create script with inscription
  const script = new kaspaWasm.ScriptBuilder();
  inscription.write(script, publicKey);
  
  console.log('\nScript created');
  console.log('Script methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(script)));
  
  // Check what encodePayToScriptHashSignatureScript does
  console.log('\n=== encodePayToScriptHashSignatureScript ===');
  const sigScript = script.encodePayToScriptHashSignatureScript(publicKey);
  console.log('Sig script type:', sigScript?.constructor?.name);
  console.log('Sig script:', sigScript);
  
  // Check if there's a sign method on script
  console.log('\n=== Checking for signing methods ===');
  
  // Maybe we need signScriptHash?
  console.log('signScriptHash:', typeof kaspaWasm.signScriptHash);
  
  // Check payToScriptHashSignatureScript
  console.log('payToScriptHashSignatureScript:', typeof kaspaWasm.payToScriptHashSignatureScript);
  
  // Look at what the sigScript actually contains
  if (sigScript instanceof Uint8Array) {
    const hex = Buffer.from(sigScript).toString('hex');
    console.log('\nSig script hex:', hex);
    console.log('Length:', hex.length / 2, 'bytes');
  }
}

main().catch(console.error);
