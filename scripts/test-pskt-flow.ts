import 'dotenv/config';

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
  
  // Get P2SH info
  const p2shScript = script.createPayToScriptHashScript();
  const p2shAddress = kaspaWasm.addressFromScriptPublicKey(p2shScript, 'testnet-10');
  
  // Recreate for drain
  const script2 = new kaspaWasm.ScriptBuilder();
  inscription.write(script2, xOnlyPubKey.toString());
  const redeemScriptHex = script2.drain();
  
  // Commit tx info
  const commitTxId = 'ee8c237fd7056c859c79d1009ba41d8e39420ff73f6df24a756abfca9e66b8b8';
  const inputAmount = 50000000n;
  const outputAmount = 49990000n;
  
  console.log('P2SH Address:', p2shAddress.toString());
  console.log('Redeem script:', redeemScriptHex.slice(0, 40) + '...');
  
  console.log('\n=== PSKT Flow ===');
  
  // Start with Creator role
  let pskt = new kaspaWasm.PSKT();
  console.log('1. Created PSKT, role:', pskt.role);
  
  // Convert to Constructor role
  console.log('\n2. Converting to Constructor...');
  try {
    pskt = pskt.toConstructor();
    console.log('   Role:', pskt.role);
  } catch (e: any) {
    console.log('   Error:', e.message || e);
  }
  
  // Add input with UTXO entry and redeem script
  console.log('\n3. Adding input with redeemScript...');
  try {
    // The UTXO entry needs:
    // - amount
    // - scriptPublicKey (the P2SH script, not redeem script)
    // - blockDaaScore
    // - isCoinbase
    
    pskt.inputAndRedeemScript({
      utxoEntry: {
        amount: inputAmount,
        scriptPublicKey: {
          script: p2shScript.script,
          version: p2shScript.version
        },
        blockDaaScore: 0n,
        isCoinbase: false
      },
      previousOutpoint: {
        transactionId: commitTxId,
        index: 0
      },
      sequence: 0,
      sigOpCount: 1,
      redeemScript: redeemScriptHex
    });
    console.log('   Input added!');
  } catch (e: any) {
    console.log('   Error:', e.message || e);
  }
  
  // Add output
  console.log('\n4. Adding output...');
  try {
    pskt.output({
      value: outputAmount,
      scriptPublicKey: {
        script: kaspaWasm.payToAddressScript(address).script,
        version: 0
      }
    });
    console.log('   Output added!');
  } catch (e: any) {
    console.log('   Error:', e.message || e);
  }
  
  // Finalize inputs/outputs
  console.log('\n5. Finalizing structure...');
  try {
    pskt.noMoreInputs();
    pskt.noMoreOutputs();
    console.log('   Finalized!');
  } catch (e: any) {
    console.log('   Error:', e.message || e);
  }
  
  // Convert to Signer
  console.log('\n6. Converting to Signer...');
  try {
    pskt = pskt.toSigner();
    console.log('   Role:', pskt.role);
    console.log('   Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(pskt)));
  } catch (e: any) {
    console.log('   Error:', e.message || e);
  }
}

main().catch(console.error);
