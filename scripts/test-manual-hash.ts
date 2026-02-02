import 'dotenv/config';
import * as crypto from 'crypto';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');
  const kasplexModule = await import('kasplexbuilder');
  const { Inscription } = kasplexModule;
  
  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  const xOnlyPubKey = publicKey.toXOnlyPublicKey();
  const networkId = new kaspaWasm.NetworkId('testnet-10');
  const address = publicKey.toAddress(networkId);
  
  // Create inscription
  const inscription = new Inscription('mint', { tick: 'YBTCA' });
  const script = new kaspaWasm.ScriptBuilder();
  inscription.write(script, xOnlyPubKey.toString());
  const redeemScriptHex = script.drain();
  
  // Commit info
  const commitTxId = 'ee8c237fd7056c859c79d1009ba41d8e39420ff73f6df24a756abfca9e66b8b8';
  const inputAmount = 50000000n;
  const outputAmount = 49990000n;
  
  // Build the transaction
  const commitTxIdHash = new kaspaWasm.Hash(commitTxId);
  const outpoint = new kaspaWasm.TransactionOutpoint(commitTxIdHash, 0);
  
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
  
  // Try to use TransactionSigningHash
  console.log('\n=== TransactionSigningHash ===');
  
  const sigHash = new kaspaWasm.TransactionSigningHash();
  
  // The update method might take the transaction or specific data
  // Let's see what it accepts
  
  console.log('Trying to update with different data...');
  
  // Try 1: TX object
  try {
    const tsh1 = new kaspaWasm.TransactionSigningHash();
    tsh1.update(tx);
    const hash1 = tsh1.finalize();
    console.log('TX object -> hash:', hash1);
  } catch (e: any) {
    console.log('TX object -> error:', e.message);
  }
  
  // Try 2: TX serialized
  try {
    const tsh2 = new kaspaWasm.TransactionSigningHash();
    const txJson = tx.serializeToJSON();
    tsh2.update(txJson);
    const hash2 = tsh2.finalize();
    console.log('TX JSON -> hash:', hash2);
  } catch (e: any) {
    console.log('TX JSON -> error:', e.message);
  }
  
  // Try 3: Just a byte array
  try {
    const tsh3 = new kaspaWasm.TransactionSigningHash();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    tsh3.update(bytes);
    const hash3 = tsh3.finalize();
    console.log('Bytes -> hash:', hash3);
  } catch (e: any) {
    console.log('Bytes -> error:', e.message);
  }
  
  // Try 4: String
  try {
    const tsh4 = new kaspaWasm.TransactionSigningHash();
    tsh4.update('test');
    const hash4 = tsh4.finalize();
    console.log('String -> hash:', hash4);
  } catch (e: any) {
    console.log('String -> error:', e.message);
  }
  
  // Let's also check if there's a direct way to compute sighash
  // Maybe through the Transaction class
  console.log('\n=== Transaction methods ===');
  console.log('TX prototype:', Object.getOwnPropertyNames(Object.getPrototypeOf(tx)));
}

main().catch(console.error);
