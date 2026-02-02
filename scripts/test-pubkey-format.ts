import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');
  const kasplexModule = await import('kasplexbuilder');
  const { Inscription } = kasplexModule;
  
  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  
  console.log('PublicKey object:', publicKey);
  console.log('PublicKey string:', publicKey.toString());
  console.log('PublicKey toXOnlyPublicKey:', publicKey.toXOnlyPublicKey?.()?.toString());
  
  // Check XOnlyPublicKey (Schnorr pubkey format, 32 bytes)
  const xOnlyPubKey = publicKey.toXOnlyPublicKey();
  console.log('\nXOnlyPublicKey hex:', xOnlyPubKey.toString());
  
  // Test with different pubkey formats
  console.log('\n=== Testing script with different pubkey formats ===');
  
  const inscription = new Inscription('mint', { tick: 'TEST' });
  
  // Test 1: PublicKey object
  console.log('\n1. With PublicKey object:');
  const script1 = new kaspaWasm.ScriptBuilder();
  try {
    inscription.write(script1, publicKey);
    console.log('   hexView:', script1.hexView().split('\n')[0]);
  } catch (e: any) {
    console.log('   Error:', e.message);
  }
  
  // Test 2: PublicKey.toString()
  console.log('\n2. With PublicKey.toString():');
  const script2 = new kaspaWasm.ScriptBuilder();
  try {
    inscription.write(script2, publicKey.toString());
    console.log('   hexView:', script2.hexView().split('\n')[0]);
  } catch (e: any) {
    console.log('   Error:', e.message);
  }
  
  // Test 3: XOnlyPublicKey string
  console.log('\n3. With XOnlyPublicKey string:');
  const script3 = new kaspaWasm.ScriptBuilder();
  try {
    inscription.write(script3, xOnlyPubKey.toString());
    console.log('   hexView:', script3.hexView().split('\n')[0]);
  } catch (e: any) {
    console.log('   Error:', e.message);
  }
  
  // The correct format should have 32 bytes of pubkey after the first length byte
  // Let's see what the full pubkey hex is
  const pubKeyHex = publicKey.toString();
  console.log('\n=== Public key analysis ===');
  console.log('Full pubkey hex:', pubKeyHex);
  console.log('Length:', pubKeyHex.length / 2, 'bytes');
  console.log('Prefix (02 or 03):', pubKeyHex.slice(0, 2));
  console.log('X coordinate:', pubKeyHex.slice(2));
}

main().catch(console.error);
