import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');
  const kasplexModule = await import('kasplexbuilder');
  const { Inscription } = kasplexModule;
  
  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  const xOnlyPubKey = publicKey.toXOnlyPublicKey();
  
  console.log('XOnly pubkey:', xOnlyPubKey.toString());
  
  // Create inscription
  const inscription = new Inscription('mint', { tick: 'YBTCA' });
  
  // Create script
  const script = new kaspaWasm.ScriptBuilder();
  inscription.write(script, xOnlyPubKey.toString());
  
  // Get raw script BEFORE any encoding
  console.log('\n=== Raw script from hexView ===');
  const rawHex = script.hexView();
  console.log(rawHex);
  
  // Now get encoded version
  const script2 = new kaspaWasm.ScriptBuilder();
  inscription.write(script2, xOnlyPubKey.toString());
  const encodedHex = script2.encodePayToScriptHashSignatureScript(xOnlyPubKey.toString());
  console.log('\n=== encodePayToScriptHashSignatureScript ===');
  console.log('Hex:', encodedHex);
  console.log('Length:', encodedHex.length / 2, 'bytes');
  
  // Also check what drain() returns
  const script3 = new kaspaWasm.ScriptBuilder();
  inscription.write(script3, xOnlyPubKey.toString());
  const drained = script3.drain();
  console.log('\n=== drain() ===');
  console.log('Type:', typeof drained);
  console.log('Value:', drained);
  
  // For a P2SH signature script, we need:
  // <sig_len> <signature + sighash> <script_len> <redeem_script>
  // Where redeem_script is the raw script (what gets hashed to create P2SH address)
  
  // Let's manually build what the signature script should look like
  // 1. First, get the raw script bytes (not encoded)
  
  // The raw script should be:
  // 20 <32-byte pubkey> ac 00 63 07 "kasplex" 00 <len> <json> 68
  
  // Let's verify by looking at P2SH script
  const script4 = new kaspaWasm.ScriptBuilder();
  inscription.write(script4, xOnlyPubKey.toString());
  const p2shScript = script4.createPayToScriptHashScript();
  console.log('\n=== P2SH script ===');
  console.log('P2SH script:', p2shScript);
  
  // The P2SH address comes from hashing the raw script
  // So the redeem script for unlocking should be the raw script
  
  // Check if there's a way to get raw bytes
  console.log('\n=== Trying to get raw script bytes ===');
  const script5 = new kaspaWasm.ScriptBuilder();
  inscription.write(script5, xOnlyPubKey.toString());
  
  // Maybe hexView returns the bytes in a different format
  const hexLines = script5.hexView().split('\n');
  let rawBytes = '';
  for (const line of hexLines) {
    // Extract hex from format: "00000000  XX XX XX XX..."
    const match = line.match(/^[0-9a-fA-F]+\s+(.+?)\s*\|/);
    if (match) {
      rawBytes += match[1].replace(/\s+/g, '');
    }
  }
  console.log('Raw bytes extracted:', rawBytes);
  console.log('Length:', rawBytes.length / 2, 'bytes');
}

main().catch(console.error);
