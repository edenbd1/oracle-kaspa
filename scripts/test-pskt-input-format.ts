import 'dotenv/config';

async function main() {
  const kaspaWasm = await import('kaspa-wasm');
  const kasplexModule = await import('kasplexbuilder');
  const { Inscription } = kasplexModule;
  
  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);
  const publicKey = privateKey.toPublicKey();
  const xOnlyPubKey = publicKey.toXOnlyPublicKey();
  const address = publicKey.toAddress('testnet-10');
  
  // Create inscription
  const inscription = new Inscription('mint', { tick: 'YBTCA' });
  const script = new kaspaWasm.ScriptBuilder();
  inscription.write(script, xOnlyPubKey.toString());
  const p2shScript = script.createPayToScriptHashScript();
  
  const script2 = new kaspaWasm.ScriptBuilder();
  inscription.write(script2, xOnlyPubKey.toString());
  const redeemScriptHex = script2.drain();
  
  const commitTxId = 'ee8c237fd7056c859c79d1009ba41d8e39420ff73f6df24a756abfca9e66b8b8';
  const inputAmount = 50000000n;
  
  // Try different formats for inputAndRedeemScript
  const formats = [
    // Format 1: Nested utxoEntry
    {
      name: 'Nested utxoEntry',
      data: {
        utxoEntry: {
          amount: inputAmount,
          scriptPublicKey: p2shScript.script,
          blockDaaScore: 0n,
          isCoinbase: false
        },
        previousOutpoint: { transactionId: commitTxId, index: 0 },
        sequence: 0,
        sigOpCount: 1,
        redeemScript: redeemScriptHex
      }
    },
    // Format 2: Flat with utxo
    {
      name: 'Flat with utxo',
      data: {
        utxo: {
          amount: inputAmount,
          scriptPublicKey: p2shScript.script,
          blockDaaScore: 0n,
          isCoinbase: false
        },
        previousOutpoint: { transactionId: commitTxId, index: 0 },
        sequence: 0,
        sigOpCount: 1,
        redeemScript: redeemScriptHex
      }
    },
    // Format 3: Flat properties
    {
      name: 'Flat properties',
      data: {
        amount: inputAmount,
        scriptPublicKey: p2shScript.script,
        blockDaaScore: 0n,
        isCoinbase: false,
        previousOutpoint: { transactionId: commitTxId, index: 0 },
        sequence: 0,
        sigOpCount: 1,
        redeemScript: redeemScriptHex
      }
    },
    // Format 4: With address
    {
      name: 'With address',
      data: {
        address: address.toString(),
        amount: inputAmount,
        scriptPublicKey: { script: p2shScript.script, version: 0 },
        blockDaaScore: 0n,
        isCoinbase: false,
        outpoint: { transactionId: commitTxId, index: 0 },
        redeemScript: redeemScriptHex
      }
    }
  ];
  
  for (const format of formats) {
    console.log(`\n=== ${format.name} ===`);
    try {
      let pskt = new kaspaWasm.PSKT();
      pskt = pskt.toConstructor();
      pskt.inputAndRedeemScript(format.data);
      console.log('SUCCESS!');
    } catch (e: any) {
      console.log('Error:', e.message || e);
    }
  }
  
  // Let's also try without redeemScript first, then add it
  console.log('\n=== Try regular input first ===');
  try {
    let pskt = new kaspaWasm.PSKT();
    pskt = pskt.toConstructor();
    
    // Try regular input
    pskt.input({
      previousOutpoint: { transactionId: commitTxId, index: 0 },
      sequence: 0,
      sigOpCount: 1,
      utxoEntry: {
        amount: inputAmount,
        scriptPublicKey: { script: p2shScript.script, version: 0 },
        blockDaaScore: 0n,
        isCoinbase: false
      }
    });
    console.log('Regular input added!');
  } catch (e: any) {
    console.log('Error:', e.message || e);
  }
}

main().catch(console.error);
