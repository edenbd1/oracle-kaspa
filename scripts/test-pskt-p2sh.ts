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
  const redeemScriptHex = script.drain();
  
  // Commit tx info
  const commitTxId = 'ee8c237fd7056c859c79d1009ba41d8e39420ff73f6df24a756abfca9e66b8b8';
  const inputAmount = 50000000n;
  const outputAmount = 49990000n;
  
  console.log('=== Creating PSKT ===');
  
  // Create empty PSKT in Creator role
  const pskt = new kaspaWasm.PSKT();
  console.log('PSKT role:', pskt.role);
  console.log('PSKT methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(pskt)));
  
  // Check inputAndRedeemScript - this might let us add a P2SH input with redeem script
  console.log('\n=== inputAndRedeemScript ===');
  try {
    // Try to add an input with redeem script
    const inputData = {
      previousOutpoint: {
        transactionId: commitTxId,
        index: 0
      },
      sequence: 0,
      sigOpCount: 1,
      // The redeem script
      redeemScript: redeemScriptHex
    };
    
    console.log('Calling inputAndRedeemScript...');
    pskt.inputAndRedeemScript(inputData);
    console.log('inputAndRedeemScript succeeded!');
  } catch (e: any) {
    console.log('inputAndRedeemScript error:', e.message || e);
  }
  
  // Check input method
  console.log('\n=== input method ===');
  try {
    pskt.input({
      previousOutpoint: {
        transactionId: commitTxId,
        index: 0
      },
      sequence: 0,
      sigOpCount: 1
    });
    console.log('input succeeded!');
  } catch (e: any) {
    console.log('input error:', e.message || e);
  }
  
  // Check output method
  console.log('\n=== output method ===');
  try {
    pskt.output({
      amount: outputAmount,
      scriptPublicKey: {
        script: kaspaWasm.payToAddressScript(address).script,
        version: 0
      }
    });
    console.log('output succeeded!');
  } catch (e: any) {
    console.log('output error:', e.message || e);
  }
  
  // Check noMoreInputs/noMoreOutputs
  console.log('\n=== Finalizing inputs/outputs ===');
  try {
    pskt.noMoreInputs();
    pskt.noMoreOutputs();
    console.log('Finalized inputs/outputs');
  } catch (e: any) {
    console.log('Finalize error:', e.message || e);
  }
  
  // Convert to signer
  console.log('\n=== toSigner ===');
  try {
    const signer = pskt.toSigner();
    console.log('Signer created');
    console.log('Signer type:', signer?.constructor?.name);
    
    // Check signer methods
    console.log('Signer methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(signer)));
  } catch (e: any) {
    console.log('toSigner error:', e.message || e);
  }
}

main().catch(console.error);
