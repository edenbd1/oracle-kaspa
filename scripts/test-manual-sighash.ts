import 'dotenv/config';
import { createHash } from 'crypto';

// Kaspa uses BLAKE2B-256 for sighash
function blake2b256(data: Buffer): Buffer {
  // Node.js doesn't have built-in BLAKE2B, we'll need to use kaspa-wasm's hash
  // For now, let's check what hash functions are available
  return data; // placeholder
}

async function main() {
  const kaspaWasm = await import('kaspa-wasm');
  const kasplexModule = await import('kasplexbuilder');
  const { Inscription } = kasplexModule;

  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  const xOnlyPubKey = publicKey.toXOnlyPublicKey();
  const networkId = new kaspaWasm.NetworkId('testnet-10');
  const address = publicKey.toAddress(networkId);

  // Check if kaspa-wasm has BLAKE2B
  console.log('=== Looking for hash functions ===');
  const hashExports = Object.keys(kaspaWasm).filter(k =>
    k.toLowerCase().includes('hash') ||
    k.toLowerCase().includes('blake')
  );
  console.log('Hash exports:', hashExports);

  // Check Hash class
  console.log('\n=== Hash class ===');
  const testHash = new kaspaWasm.Hash('0'.repeat(64));
  console.log('Hash methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(testHash)));

  // Check if there's a way to compute arbitrary hashes
  console.log('\n=== Looking for hash computation ===');

  // Let's see if TransactionSigningHash can be used differently
  // It's a streaming hasher that might accept arbitrary data

  const tsh = new kaspaWasm.TransactionSigningHash();
  console.log('TSH methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(tsh)));

  // Create the transaction components
  const commitTxId = '2a20c496408389953bbdc79c311ba6c8809684fe9d9c4f7ddcc5899deac1855b';
  const inputAmount = 50000000n;
  const outputAmount = 49990000n;

  const inscription = new Inscription('mint', { tick: 'YBTCA' });
  const script = new kaspaWasm.ScriptBuilder();
  inscription.write(script, xOnlyPubKey.toString());
  const redeemScriptHex = script.drain();

  console.log('Redeem script:', redeemScriptHex.slice(0, 40) + '...');

  // Build the transaction
  const outpoint = new kaspaWasm.TransactionOutpoint(new kaspaWasm.Hash(commitTxId), 0);
  const input = new kaspaWasm.TransactionInput({
    previousOutpoint: outpoint,
    signatureScript: new Uint8Array(),
    sequence: 0,
    sigOpCount: 1
  });

  const destSpkData = kaspaWasm.payToAddressScript(address);
  const destScriptBytes = new Uint8Array(Buffer.from(destSpkData.script, 'hex'));
  const destSPK = new kaspaWasm.ScriptPublicKey(destSpkData.version, destScriptBytes);
  const output = new kaspaWasm.TransactionOutput(outputAmount, destSPK);

  const tx = new kaspaWasm.Transaction({
    inputs: [input],
    outputs: [output],
    version: 0,
    lockTime: 0n,
    subnetworkId: '0000000000000000000000000000000000000000',
    gas: 0n,
    payload: ''
  });

  console.log('TX id:', tx.id);

  // Check if we can compute different hashes
  console.log('\n=== Comparing hashes ===');

  // Hash 1: Using TransactionSigningHash with tx
  const tsh1 = new kaspaWasm.TransactionSigningHash();
  tsh1.update(tx);
  const hash1 = tsh1.finalize();
  console.log('Hash from tx:', hash1);

  // Hash 2: Try updating with additional data after tx
  const tsh2 = new kaspaWasm.TransactionSigningHash();
  tsh2.update(tx);
  tsh2.update(Buffer.from(redeemScriptHex, 'hex'));
  const hash2 = tsh2.finalize();
  console.log('Hash from tx + redeem:', hash2);

  // Hash 3: Try with redeem script bytes first
  const tsh3 = new kaspaWasm.TransactionSigningHash();
  tsh3.update(Buffer.from(redeemScriptHex, 'hex'));
  tsh3.update(tx);
  const hash3 = tsh3.finalize();
  console.log('Hash from redeem + tx:', hash3);

  // Try using TransactionSigningHashECDSA (might have different behavior)
  console.log('\n=== TransactionSigningHashECDSA ===');
  const tshEcdsa = new kaspaWasm.TransactionSigningHashECDSA();
  tshEcdsa.update(tx);
  const hashEcdsa = tshEcdsa.finalize();
  console.log('ECDSA hash from tx:', hashEcdsa);

  // Let's look at what data the update method actually hashes
  console.log('\n=== Analyzing update behavior ===');

  // Try with just bytes
  const tsh4 = new kaspaWasm.TransactionSigningHash();
  tsh4.update(new Uint8Array([1, 2, 3, 4]));
  const hash4 = tsh4.finalize();
  console.log('Hash from bytes [1,2,3,4]:', hash4);

  // Try with same bytes again
  const tsh5 = new kaspaWasm.TransactionSigningHash();
  tsh5.update(new Uint8Array([1, 2, 3, 4]));
  const hash5 = tsh5.finalize();
  console.log('Hash from bytes [1,2,3,4] again:', hash5);

  // They should be the same
  console.log('Same?', hash4 === hash5);

  // Now let's look at what the proper sighash should include
  // According to Kaspa's sighash algorithm (KIP-0002), for a P2SH input:
  // - scriptCode = the redeem script (not the P2SH scriptPubKey)
  // - value = the input amount

  // The TransactionSigningHash.update(tx) probably uses:
  // - scriptCode = empty or some default
  // - value = 0 or some default

  // We need to compute the hash with the correct scriptCode and value

  // Let me check if there's a way to get the hash computation internals
  console.log('\n=== Looking for internal hash computation ===');

  // Check if Transaction has any methods that might help
  const txProto = Object.getOwnPropertyNames(Object.getPrototypeOf(tx));
  console.log('TX methods:', txProto);

  // Check for mass calculation (might give hints about hash computation)
  if (tx.mass) {
    console.log('TX mass:', tx.mass);
  }

  // Let me try a different approach: look at how the signature is verified
  // The verify function might give hints about what hash is expected
  console.log('\n=== Looking for verify functions ===');
  const verifyExports = Object.keys(kaspaWasm).filter(k =>
    k.toLowerCase().includes('verify')
  );
  console.log('Verify exports:', verifyExports);
}

main().catch(console.error);
