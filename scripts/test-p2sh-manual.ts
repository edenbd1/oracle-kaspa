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
  
  // Create inscription
  const inscription = new Inscription('mint', { tick: 'TEST' });
  const script = new kaspaWasm.ScriptBuilder();
  inscription.write(script, publicKey);
  
  // Get P2SH script
  const p2shScript = script.createPayToScriptHashScript();
  
  // Recreate script for hex view (since hexView might consume it)
  const script2 = new kaspaWasm.ScriptBuilder();
  inscription.write(script2, publicKey);
  const redeemScriptHex = script2.encodePayToScriptHashSignatureScript(publicKey);
  
  console.log('Redeem script:', redeemScriptHex);
  
  // Parse the redeem script
  const redeemBytes = Buffer.from(redeemScriptHex, 'hex');
  console.log('\nRedeem script bytes analysis:');
  console.log('Total length:', redeemBytes.length, 'bytes');
  console.log('Bytes:', redeemBytes.toString('hex'));
  
  // According to Kasplex, the P2SH signature script should be:
  // <length> <sig+sighash_type> <length> <redeem_script>
  
  // For the signature, we need to sign the transaction hash computed with the redeem script
  // Let's use the createTransactions approach but with P2SH input
  
  // First, let's see if we can find a commit UTXO on testnet
  // We'll use a placeholder for now
  
  // The key insight: for P2SH in Kaspa, we need:
  // 1. The transaction to spend
  // 2. The UTXO entry with the P2SH scriptPublicKey
  // 3. The redeem script for computing sighash
  // 4. The signature of the sighash
  
  console.log('\n=== Checking if we have a recent commit TX ===');
  
  // Look at our recent transactions to find a P2SH commit output
  const apiBase = 'https://api-tn10.kaspa.org';
  const txRes = await fetch(`${apiBase}/addresses/${address.toString()}/full-transactions?limit=5`);
  const txData = await txRes.json();
  
  console.log('Recent transactions:', txData.length);
  
  // The commit we just made should have a P2SH output
  const commitTxId = '1e11c04da90a04164f9b293f536293b7cfe297ad23dcafefe79fcc230fa014bf';
  console.log('\nLooking for commit TX:', commitTxId);
  
  const txInfoRes = await fetch(`${apiBase}/transactions/${commitTxId}`);
  if (txInfoRes.ok) {
    const txInfo = await txInfoRes.json();
    console.log('Commit TX found');
    console.log('Outputs:');
    txInfo.outputs?.forEach((out: any, i: number) => {
      console.log(`  Output ${i}:`, out.script_public_key_address, 'amount:', out.amount);
    });
  } else {
    console.log('Commit TX not found');
  }
  
  // Let's try using payToScriptHashSignatureScript correctly
  // It takes (redeem_script, signature)
  // So we need to create the signature first
  
  console.log('\n=== Understanding the signature format ===');
  
  // For a standard P2PK script, the signature script is just <sig>
  // For P2SH, it's <sig> <redeem_script>
  // Where <sig> = 64-byte schnorr signature + 1-byte sighash type
  
  // The payToScriptHashSignatureScript function should combine them
  // But we need to compute the signature ourselves
  
  // To compute the signature, we need the sighash, which requires:
  // - The transaction (inputs, outputs, etc.)
  // - The UTXO being spent (amount, scriptPublicKey)
  // - The index of the input being signed
  // - The sighash type
  
  // For P2SH, the scriptPublicKey for sighash computation is the REDEEM script
  // (the full script with inscription), not the P2SH hash
  
  console.log('\n=== Approach: Use UTXO with redeem script for signing ===');
  
  // We can trick createTransactions by providing the UTXO with the redeem script
  // as the scriptPublicKey
  
  // The redeem script starts with <pubkey> OP_CHECKSIG
  // which is exactly what we need for the sighash computation
  
  // Let's see the full script
  const script3 = new kaspaWasm.ScriptBuilder();
  inscription.write(script3, publicKey);
  
  // Get hexView before drain
  console.log('Script hexView:');
  console.log(script3.hexView());
}

main().catch(console.error);
