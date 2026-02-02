import 'dotenv/config';

async function main() {
  const kasplexModule = await import('kasplexbuilder');
  const kaspaWasm = await import('kaspa-wasm');

  console.log('=== KasplexBuilder Indexer ===');
  const { Indexer, Inscription } = kasplexModule;

  console.log('Indexer:', Indexer);
  console.log('Indexer.length:', Indexer.length);

  // Try to create an Indexer instance
  const privateKey = new kaspaWasm.PrivateKey(process.env.PLATFORM_PRIVATE_KEY!);

  try {
    const indexer = new Indexer(privateKey);
    console.log('Indexer instance:', indexer);
    console.log('Indexer methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(indexer)));
  } catch (e: any) {
    console.log('Indexer creation failed:', e.message);
  }

  // Check what Indexer expects
  try {
    const indexer = new Indexer({});
    console.log('Indexer with object:', indexer);
  } catch (e: any) {
    console.log('Indexer({}) failed:', e.message);
  }

  // Look at the Indexer class definition
  console.log('\n=== Indexer class ===');
  console.log('Indexer.prototype:', Object.getOwnPropertyNames(Indexer.prototype || {}));

  // Check if there are static methods
  console.log('Indexer static:', Object.getOwnPropertyNames(Indexer));

  // Let's also check if kaspa-wasm has any transaction builder class
  console.log('\n=== kaspa-wasm transaction-related ===');
  const txExports = Object.keys(kaspaWasm).filter(k =>
    k.toLowerCase().includes('transaction') ||
    k.toLowerCase().includes('builder') ||
    k.toLowerCase().includes('generator') ||
    k.toLowerCase().includes('pending')
  );
  console.log(txExports);

  // Check Generator more carefully
  console.log('\n=== Generator ===');
  console.log('Generator.prototype:', Object.getOwnPropertyNames(kaspaWasm.Generator.prototype || {}));

  // Try creating a Generator with custom settings
  const publicKey = privateKey.toPublicKey();
  const address = publicKey.toAddress('testnet-10');

  const genConfig = {
    entries: [],
    outputs: [],
    changeAddress: address.toString(),
    priorityFee: 0n,
    networkId: 'testnet-10',
    sigOpCount: 1
  };

  try {
    const gen = new kaspaWasm.Generator(genConfig);
    console.log('Generator created');
    console.log('Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(gen)));
  } catch (e: any) {
    console.log('Generator failed:', e.message);
  }

  // Check if there's a way to use Generator with custom UTXO scripts
  console.log('\n=== Checking Generator settings ===');

  // Look for settings that might affect script handling
  const generatorMethods = Object.getOwnPropertyNames(kaspaWasm.Generator.prototype || {});
  console.log('Generator methods:', generatorMethods);
}

main().catch(console.error);
