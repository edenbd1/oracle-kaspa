/**
 * Kasplex KRC-20 Inscription Client
 *
 * Creates real on-chain KRC-20 tokens using commit-reveal inscriptions.
 * Used when USE_REAL_KRC20=true.
 *
 * IMPORTANT: This module requires:
 * - KasplexBuilder: npm install KaffinPX/KasplexBuilder
 * - Kaspa WASM SDK: npm run setup:kaspa
 *
 * Costs:
 * - Deploy: ~1 KAS gas fee
 * - Mint: ~1 KAS gas fee
 * - Transfer: ~0.3 KAS
 */

import type {
  InscriptionResult,
  DeployData,
  MintData,
  TransferData,
  KasplexConfig
} from './types.js';

// Lazy-loaded dependencies (may not be available)
let Inscription: any = null;
let kaspaWasm: any = null;
let dependenciesChecked = false;
let dependenciesAvailable = false;

// Sompi per KAS
const SOMPI_PER_KAS = 100_000_000n;

// Configuration
const getConfig = (): KasplexConfig => ({
  privateKey: process.env.PLATFORM_PRIVATE_KEY || '',
  network: (process.env.KASPA_NETWORK as KasplexConfig['network']) || 'testnet-10',
  rpcUrl: process.env.KASPA_RPC_URL
});

// Minimum fees for operations (in KAS)
// These are the Kasplex protocol requirements for testnet
export const DEPLOY_FEE_KAS = 1000; // Kasplex requires 1000 KAS in reveal output
export const MINT_FEE_KAS = 1; // Kasplex requires 1 KAS in reveal output
export const TRANSFER_FEE_KAS = 0.1; // Transfer has minimal requirements

// Priority fee per mass unit (in sompi)
const PRIORITY_FEE_PER_MASS = 1n;

// Minimum output value (dust threshold)
const MIN_OUTPUT_SOMPI = 300_000n; // 0.003 KAS

// Kasplex protocol fee requirements (burnt between commit and reveal):
// - Deploy: 1000 KAS burnt (commit ~1003 KAS, reveal ~3 KAS)
// - Mint: 1 KAS burnt (commit ~2 KAS, reveal ~1 KAS)
// - Transfer: minimal
// The "feeRev" in Kasplex = commit_amount - reveal_output
const DEPLOY_COMMIT_SOMPI = 100_300_000_000n; // ~1003 KAS commit for deploy
const DEPLOY_REVEAL_SOMPI = 300_000_000n; // ~3 KAS reveal output (burns 1000 KAS)
const MINT_COMMIT_SOMPI = 200_000_000n; // ~2 KAS commit for mint
const MINT_REVEAL_SOMPI = 100_000_000n; // ~1 KAS reveal output (burns 1 KAS)
const TRANSFER_COMMIT_SOMPI = 50_000_000n; // 0.5 KAS commit for transfer
const TRANSFER_REVEAL_SOMPI = 49_000_000n; // 0.49 KAS reveal output

// Global mutex for inscription operations to prevent concurrent UTXO selection conflicts
let inscriptionLock: Promise<void> = Promise.resolve();

/**
 * Execute a function with global inscription lock
 * Prevents concurrent inscription operations that could select the same UTXOs
 */
async function withInscriptionLock<T>(fn: () => Promise<T>): Promise<T> {
  // Chain onto the current lock
  const previousLock = inscriptionLock;
  let resolve: () => void;
  inscriptionLock = new Promise(r => { resolve = r; });

  try {
    // Wait for previous operation to complete
    await previousLock;
    return await fn();
  } finally {
    resolve!();
  }
}

/**
 * Initialize dependencies (KasplexBuilder + Kaspa WASM)
 * Returns false if dependencies not available
 */
async function initDependencies(): Promise<boolean> {
  if (dependenciesChecked) return dependenciesAvailable;
  dependenciesChecked = true;

  try {
    // Try to load KasplexBuilder dynamically
    // @ts-ignore - optional dependency
    const kasplexModule = await import(/* webpackIgnore: true */ 'kasplexbuilder').catch(() => null);
    if (!kasplexModule) {
      console.warn('[Kasplex] KasplexBuilder not installed');
      console.warn('[Kasplex] Install with: npm install KaffinPX/KasplexBuilder');
      return false;
    }
    Inscription = kasplexModule.Inscription;

    // Try to load Kaspa WASM from node_modules
    try {
      // @ts-ignore - dynamic import
      kaspaWasm = await import(/* webpackIgnore: true */ 'kaspa-wasm');
    } catch (e) {
      console.warn('[Kasplex] Kaspa WASM not available:', e);
      console.warn('[Kasplex] Run: npm run setup:kaspa');
      return false;
    }

    console.log('[Kasplex] Dependencies loaded successfully');
    dependenciesAvailable = true;
    return true;
  } catch (error) {
    console.warn('[Kasplex] Failed to load dependencies:', error);
    return false;
  }
}

/**
 * Get API base URL for current network
 */
function getApiBase(): string {
  const config = getConfig();
  const isTestnet = config.network !== 'mainnet';
  return isTestnet ? 'https://api-tn10.kaspa.org' : 'https://api.kaspa.org';
}

/**
 * Get platform wallet address from private key
 */
function getPlatformAddress(): string {
  const config = getConfig();
  if (!config.privateKey) {
    throw new Error('PLATFORM_PRIVATE_KEY not configured');
  }

  const privateKey = new kaspaWasm.PrivateKey(config.privateKey);
  const publicKey = privateKey.toPublicKey();

  const networkId = config.network === 'mainnet' ? 'mainnet' : 'testnet-10';
  const address = publicKey.toAddress(networkId);

  return address.toString();
}

/**
 * Get platform wallet keys for signing
 */
function getWalletKeys(): { privateKey: any; publicKey: any; address: string } {
  const config = getConfig();
  if (!config.privateKey) {
    throw new Error('PLATFORM_PRIVATE_KEY not configured');
  }

  const privateKey = new kaspaWasm.PrivateKey(config.privateKey);
  const publicKey = privateKey.toPublicKey();
  const networkId = config.network === 'mainnet' ? 'mainnet' : 'testnet-10';
  const address = publicKey.toAddress(networkId).toString();

  return { privateKey, publicKey, address };
}

/**
 * UTXO structure from Kaspa API
 */
interface UTXO {
  transactionId: string;
  index: number;
  amount: bigint;
  scriptPublicKey: string;
  blockDaaScore: bigint;
}

/**
 * Fetch UTXOs for an address from Kaspa API
 */
async function getUtxos(address: string): Promise<UTXO[]> {
  const apiBase = getApiBase();
  const url = `${apiBase}/addresses/${address}/utxos`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch UTXOs: ${res.status}`);
  }

  const data = await res.json();

  if (!Array.isArray(data)) {
    console.warn(`[Kasplex] Unexpected UTXO response format:`, data);
    return [];
  }

  return data.map((utxo: any) => ({
    transactionId: utxo.outpoint.transactionId,
    index: utxo.outpoint.index,
    amount: BigInt(utxo.utxoEntry.amount),
    scriptPublicKey: utxo.utxoEntry.scriptPublicKey.scriptPublicKey,
    blockDaaScore: BigInt(utxo.utxoEntry.blockDaaScore)
  }));
}

/**
 * Select UTXOs to cover required amount + fees
 * Prefers smaller UTXOs to avoid storage mass issues with large inputs
 */
function selectUtxos(utxos: UTXO[], requiredSompi: bigint): { selected: UTXO[]; total: bigint } {
  // Sort by amount ASCENDING to prefer smaller UTXOs
  // This helps avoid storage mass issues when output << input
  const sorted = [...utxos].sort((a, b) => Number(a.amount - b.amount));

  const selected: UTXO[] = [];
  let total = 0n;

  // First, try to find a single UTXO that's close to the required amount
  // (within 10x) to minimize storage mass
  const maxAcceptable = requiredSompi * 10n;
  const idealUtxo = sorted.find(u => u.amount >= requiredSompi && u.amount <= maxAcceptable);

  if (idealUtxo) {
    return { selected: [idealUtxo], total: idealUtxo.amount };
  }

  // Otherwise, accumulate smallest UTXOs until we have enough
  for (const utxo of sorted) {
    selected.push(utxo);
    total += utxo.amount;

    if (total >= requiredSompi) {
      break;
    }
  }

  if (total < requiredSompi) {
    throw new Error(`Insufficient balance: have ${total} sompi, need ${requiredSompi} sompi`);
  }

  return { selected, total };
}

/**
 * Convert kaspa-wasm serialized transaction to API format
 */
function convertToApiFormat(wasmTx: any): any {
  // Parse scriptPublicKey hex string to extract version and script
  // WASM format: 4 hex chars (2 bytes little-endian) for version, then script
  const parseSpk = (spk: string) => {
    // First 4 hex chars are version as u16 little-endian
    const versionHex = spk.slice(0, 4);
    const version = parseInt(versionHex.slice(2, 4) + versionHex.slice(0, 2), 16);
    // Rest is the actual script
    const scriptPublicKey = spk.slice(4);
    return { version, scriptPublicKey };
  };

  return {
    version: wasmTx.version,
    inputs: wasmTx.inputs.map((inp: any) => ({
      previousOutpoint: {
        transactionId: inp.transactionId,
        index: inp.index
      },
      signatureScript: inp.signatureScript,
      sequence: typeof inp.sequence === 'bigint' ? Number(inp.sequence) : inp.sequence,
      sigOpCount: inp.sigOpCount
    })),
    outputs: wasmTx.outputs.map((out: any) => ({
      amount: typeof out.value === 'bigint' ? Number(out.value) : out.value,
      scriptPublicKey: parseSpk(out.scriptPublicKey)
    })),
    lockTime: typeof wasmTx.lockTime === 'bigint' ? Number(wasmTx.lockTime) : wasmTx.lockTime,
    subnetworkId: wasmTx.subnetworkId,
    gas: typeof wasmTx.gas === 'bigint' ? Number(wasmTx.gas) : wasmTx.gas,
    payload: wasmTx.payload || ''
  };
}

/**
 * Broadcast a transaction via Kaspa API
 * Accepts either a kaspa-wasm Transaction object or serialized data
 */
async function broadcastTransaction(tx: any): Promise<string> {
  const apiBase = getApiBase();
  const url = `${apiBase}/transactions`;

  // Handle kaspa-wasm Transaction objects
  let wasmTx: any;
  if (tx.serializeToObject) {
    // It's a Transaction object - serialize to object
    wasmTx = tx.serializeToObject();
  } else if (typeof tx === 'string') {
    wasmTx = JSON.parse(tx);
  } else {
    wasmTx = tx;
  }

  // Convert to API format
  const apiTx = convertToApiFormat(wasmTx);

  const body = JSON.stringify({ transaction: apiTx });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Broadcast failed: ${res.status} - ${error}`);
  }

  const data = await res.json();
  return data.transactionId;
}

/**
 * Wait for transaction confirmation
 */
async function waitForConfirmation(
  txid: string,
  maxAttempts: number = 30,
  delayMs: number = 2000
): Promise<boolean> {
  const apiBase = getApiBase();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`${apiBase}/transactions/${txid}`);
      if (response.ok) {
        const data = await response.json();
        if (data.block_time) {
          console.log(`[Kasplex] Transaction ${txid} confirmed`);
          return true;
        }
      }
    } catch {
      // Continue polling
    }

    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  console.warn(`[Kasplex] Transaction ${txid} not confirmed after ${maxAttempts} attempts`);
  return false;
}

/**
 * Build and broadcast a commit transaction using Generator API
 * Sends funds to a P2SH address that commits to the inscription
 */
async function buildAndBroadcastCommit(
  inscription: any,
  publicKey: any,
  privateKey: any,
  address: string,
  amountSompi: bigint = MIN_OUTPUT_SOMPI
): Promise<{ txid: string; script: any; commitAddress: string }> {
  const {
    ScriptBuilder,
    addressFromScriptPublicKey,
    NetworkId,
    Generator,
    PaymentOutputs
  } = kaspaWasm;

  // Create script with inscription
  // IMPORTANT: Use XOnlyPublicKey string format (32-byte Schnorr pubkey)
  const script = new ScriptBuilder();
  const xOnlyPubKey = publicKey.toXOnlyPublicKey().toString();
  inscription.write(script, xOnlyPubKey);

  // Generate commitment address (P2SH)
  const config = getConfig();
  const networkIdStr = config.network === 'mainnet' ? 'mainnet' : 'testnet-10';
  const networkId = new NetworkId(networkIdStr);
  const p2shScript = script.createPayToScriptHashScript();
  const commitAddress = addressFromScriptPublicKey(p2shScript, networkIdStr);

  console.log(`[Kasplex] Commit address: ${commitAddress}`);

  // Get UTXOs for platform wallet via RPC for consistency
  console.log(`[Kasplex] Fetching UTXOs via RPC...`);
  const utxoResolver = new kaspaWasm.Resolver();
  const rpcForUtxos = new kaspaWasm.RpcClient({ resolver: utxoResolver, networkId });
  await rpcForUtxos.connect();

  const rpcResult = await rpcForUtxos.getUtxosByAddresses([address]);
  await rpcForUtxos.disconnect();

  const rpcUtxos = rpcResult.entries || [];
  console.log(`[Kasplex] RPC returned ${rpcUtxos.length} UTXOs`);

  if (rpcUtxos.length === 0) {
    throw new Error('No UTXOs available in platform wallet');
  }

  // Convert RPC UTXOs to our format
  const utxos = rpcUtxos.map((entry: any) => ({
    transactionId: entry.outpoint.transactionId,
    index: entry.outpoint.index,
    amount: BigInt(entry.amount),
    scriptPublicKey: entry.scriptPublicKey.script,
    blockDaaScore: BigInt(entry.blockDaaScore)
  }));

  // Select UTXOs that cover the required amount plus fees
  const requiredSompi = amountSompi + 100000n; // Add buffer for fees
  const { selected } = selectUtxos(utxos, requiredSompi);

  console.log(`[Kasplex] Selected UTXO: ${selected[0].transactionId}:${selected[0].index} (${selected[0].amount} sompi)`);

  const utxoEntries = selected.map(utxo => ({
    address: address,
    outpoint: {
      transactionId: utxo.transactionId,
      index: utxo.index
    },
    amount: utxo.amount,
    // IMPORTANT: scriptPublicKey must be { script, version } format for proper signing
    scriptPublicKey: {
      script: utxo.scriptPublicKey,
      version: 0
    },
    blockDaaScore: utxo.blockDaaScore,
    isCoinbase: false
  }));

  console.log(`[Kasplex] Building commit tx with ${utxoEntries.length} inputs`);

  // Create payment output to commit address
  const outputs = new PaymentOutputs([{
    address: commitAddress.toString(),
    amount: amountSompi
  }]);

  // Create transaction using createTransactions
  const result = await kaspaWasm.createTransactions({
    entries: utxoEntries,
    outputs: [{
      address: commitAddress.toString(),
      amount: amountSompi
    }],
    priorityFee: 10000n, // 0.0001 KAS priority fee
    changeAddress: address,
    networkId: networkIdStr
  });

  if (!result.transactions || result.transactions.length === 0) {
    throw new Error('createTransactions did not produce a transaction');
  }

  const tx = result.transactions[0].transaction;
  console.log(`[Kasplex] Transaction created: ${tx.id}`);
  console.log(`[Kasplex] Fee: ${result.transactions[0].feeAmount} sompi`);

  // Sign the transaction
  kaspaWasm.signTransaction(tx, [privateKey], true);
  console.log(`[Kasplex] Transaction signed`);

  // Submit via RPC for reliable broadcast
  console.log(`[Kasplex] Broadcasting commit tx via RPC...`);
  const resolver = new kaspaWasm.Resolver();
  const rpc = new kaspaWasm.RpcClient({ resolver, networkId });

  try {
    await rpc.connect();
    const submitResult = await rpc.submitTransaction({ transaction: tx });
    const txid = submitResult.transactionId;
    console.log(`[Kasplex] Commit txid: ${txid}`);
    await rpc.disconnect();

    return { txid, script, commitAddress: commitAddress.toString() };
  } catch (error) {
    await rpc.disconnect().catch(() => {});
    throw error;
  }
}

/**
 * Build and broadcast a reveal transaction
 * Spends the commit output and includes the inscription data
 *
 * For P2SH, the signature script must be: <signature> <redeem_script>
 *
 * IMPORTANT: Kasplex protocol fee = commit_amount - reveal_output (BURNT)
 * For deploy: commit ~1003 KAS, reveal output ~3 KAS → burns 1000 KAS
 * For mint: commit ~2 KAS, reveal output ~1 KAS → burns 1 KAS
 *
 * APPROACH: Fetch the real commit UTXO from the blockchain, use createTransactions
 * with it, then use the proper P2SH signing flow:
 * 1. pendingTx.sign([privateKey], false) - standard signing, leaves P2SH inputs unsigned
 * 2. pendingTx.createInputSignature() - creates signature for P2SH input
 * 3. script.encodePayToScriptHashSignatureScript() - encodes sig with redeem script
 * 4. pendingTx.fillInput() - fills the P2SH signature script
 * 5. pendingTx.submit() - broadcasts the transaction
 */
async function buildAndBroadcastReveal(
  commitTxid: string,
  commitAddress: string,
  script: any,
  privateKey: any,
  publicKey: any,
  destinationAddress: string,
  revealOutputSompi: bigint  // The OUTPUT amount for reveal (NOT input - this burns the difference!)
): Promise<string> {
  const config = getConfig();
  const networkIdStr = config.network === 'mainnet' ? 'mainnet' : 'testnet-10';

  if (revealOutputSompi < MIN_OUTPUT_SOMPI) {
    throw new Error(`Reveal output would be dust: ${revealOutputSompi} sompi`);
  }

  console.log(`[Kasplex] Building reveal tx: output=${revealOutputSompi} sompi (${Number(revealOutputSompi) / 1e8} KAS)`);

  // Fetch the commit UTXO via RPC with retry
  // Query by commitAddress (P2SH) to filter implicitly by script
  const networkId = new kaspaWasm.NetworkId(networkIdStr);
  const resolver = new kaspaWasm.Resolver();
  const rpc = new kaspaWasm.RpcClient({ resolver, networkId });
  await rpc.connect();

  let commitUtxo: any = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const rpcResult = await rpc.getUtxosByAddresses([commitAddress]);
      const utxos = rpcResult.entries || [];

      // Query by commitAddress = filtered by P2SH script
      // Match only by txid since all UTXOs are already on the correct address
      commitUtxo = utxos.find((u: any) =>
        u.outpoint.transactionId === commitTxid
      );

      if (commitUtxo) break;
    } catch (err) {
      console.warn(`[Kasplex] RPC error on attempt ${attempt + 1}:`, err);
    }

    console.log(`[Kasplex] Waiting for commit UTXO... attempt ${attempt + 1}/10`);
    await new Promise(r => setTimeout(r, 1000));
  }

  if (!commitUtxo) {
    await rpc.disconnect();
    throw new Error(`Commit UTXO ${commitTxid} not visible after 10 retries`);
  }

  console.log(`[Kasplex] Found commit UTXO: ${commitTxid}:${commitUtxo.outpoint.index}`);

  // Create the P2SH UTXO entry for createTransactions
  // RPC format: amount, blockDaaScore, scriptPublicKey.script at top level
  const p2shEntry = {
    address: commitAddress,
    outpoint: {
      transactionId: commitUtxo.outpoint.transactionId,
      index: commitUtxo.outpoint.index
    },
    amount: BigInt(commitUtxo.amount),
    scriptPublicKey: {
      script: commitUtxo.scriptPublicKey.script,
      version: 0
    },
    blockDaaScore: BigInt(commitUtxo.blockDaaScore),
    isCoinbase: false
  };

  // Build reveal transaction using createTransactions
  // The key insight: to burn 1000 KAS, we need output << input, with no change
  // We set priorityFee to consume almost all excess, leaving no room for change
  const inputAmount = BigInt(commitUtxo.amount);
  const burntFee = inputAmount - revealOutputSompi;

  // Set priorityFee high enough to consume excess minus a buffer for tx mass fee
  // This prevents createTransactions from having "leftover" to create change
  // Buffer of 100000 sompi (~0.001 KAS) should cover the tx mass fee
  const txMassFeeBuffer = 100000n;
  const adjustedPriorityFee = burntFee - txMassFeeBuffer;

  console.log(`[Kasplex] Input: ${inputAmount} sompi, Output: ${revealOutputSompi} sompi`);
  console.log(`[Kasplex] Priority fee: ${adjustedPriorityFee} sompi, Buffer: ${txMassFeeBuffer} sompi`);

  // Use createTransactions with high priorityFee to consume excess
  const result = await kaspaWasm.createTransactions({
    entries: [p2shEntry],
    outputs: [{
      address: destinationAddress,
      amount: revealOutputSompi
    }],
    priorityFee: adjustedPriorityFee,
    changeAddress: destinationAddress, // Required, but change should be negligible/dust
    networkId: networkIdStr
  });

  if (!result.transactions || result.transactions.length === 0) {
    throw new Error('createTransactions did not produce a reveal transaction');
  }

  const revealPending = result.transactions[0];
  const revealTx = revealPending.transaction;
  console.log(`[Kasplex] Reveal TX created: ${revealTx.id}`);

  // Verify the transaction has only 1 output (no change)
  const serializedCheck = revealTx.serializeToObject();
  console.log(`[Kasplex] Reveal TX has ${serializedCheck.outputs.length} output(s)`);
  if (serializedCheck.outputs.length > 1) {
    console.warn(`[Kasplex] WARNING: Extra outputs detected! Fee burning may fail.`);
    for (const out of serializedCheck.outputs) {
      console.warn(`  - ${out.value} sompi`);
    }
  }

  // Step 1: Standard signing (leaves P2SH inputs unsigned)
  revealPending.sign([privateKey], false);
  console.log(`[Kasplex] Standard signing done`);

  // Step 2: Find the P2SH input (the one with empty signatureScript)
  const serialized = revealTx.serializeToObject();
  let p2shInputIndex = -1;
  for (let i = 0; i < serialized.inputs.length; i++) {
    if (!serialized.inputs[i].signatureScript || serialized.inputs[i].signatureScript === '') {
      p2shInputIndex = i;
      break;
    }
  }

  if (p2shInputIndex === -1) {
    throw new Error('No P2SH input found - all inputs appear to be signed');
  }

  console.log(`[Kasplex] P2SH input index: ${p2shInputIndex}`);

  // Step 3: Create signature for the P2SH input
  const signature = revealPending.createInputSignature(p2shInputIndex, privateKey, kaspaWasm.SighashType.All);
  console.log(`[Kasplex] P2SH signature created`);

  // Step 4: Encode the signature with the redeem script
  const p2shSigScript = script.encodePayToScriptHashSignatureScript(signature);
  console.log(`[Kasplex] P2SH sig script encoded: ${p2shSigScript.slice(0, 60)}...`);

  // Step 5: Fill the input with the P2SH signature script
  revealPending.fillInput(p2shInputIndex, p2shSigScript);
  console.log(`[Kasplex] Input filled`);

  // Step 6: Submit via RPC
  console.log(`[Kasplex] Broadcasting reveal tx via RPC...`);

  try {
    const txid = await revealPending.submit(rpc);
    console.log(`[Kasplex] Reveal txid: ${txid}`);
    await rpc.disconnect();
    return txid;
  } catch (error) {
    await rpc.disconnect().catch(() => {});
    throw error;
  }
}

/**
 * Get the required commit and reveal amounts for an operation
 * Kasplex protocol fee = commit_amount - reveal_amount (burnt)
 */
function getAmountsForOperation(operation: string): { commit: bigint; reveal: bigint } {
  switch (operation) {
    case 'deploy':
      return { commit: DEPLOY_COMMIT_SOMPI, reveal: DEPLOY_REVEAL_SOMPI };
    case 'mint':
      return { commit: MINT_COMMIT_SOMPI, reveal: MINT_REVEAL_SOMPI };
    case 'transfer':
      return { commit: TRANSFER_COMMIT_SOMPI, reveal: TRANSFER_REVEAL_SOMPI };
    default:
      return { commit: MINT_COMMIT_SOMPI, reveal: MINT_REVEAL_SOMPI };
  }
}

/**
 * Execute a full commit-reveal inscription (internal implementation)
 */
async function executeInscriptionInternal(
  inscription: any,
  operation: string
): Promise<InscriptionResult> {
  const { privateKey, publicKey, address } = getWalletKeys();

  // Get the commit and reveal amounts for this operation
  // Kasplex protocol fee = commit - reveal (burnt)
  const { commit: commitAmount, reveal: revealAmount } = getAmountsForOperation(operation);
  const burntFee = commitAmount - revealAmount;

  console.log(`[Kasplex] Executing ${operation} inscription...`);
  console.log(`[Kasplex] Platform address: ${address}`);
  console.log(`[Kasplex] Commit amount: ${Number(commitAmount) / 1e8} KAS`);
  console.log(`[Kasplex] Reveal output: ${Number(revealAmount) / 1e8} KAS`);
  console.log(`[Kasplex] Protocol fee (burnt): ${Number(burntFee) / 1e8} KAS`);

  // Step 1: Build and broadcast commit transaction
  const { txid: commitTxid, script, commitAddress } = await buildAndBroadcastCommit(
    inscription,
    publicKey,
    privateKey,
    address,
    commitAmount  // Send the COMMIT amount to P2SH
  );

  // Step 2: Wait for commit confirmation
  console.log(`[Kasplex] Waiting for commit confirmation...`);
  const commitConfirmed = await waitForConfirmation(commitTxid, 30, 1000);
  if (!commitConfirmed) {
    return {
      success: false,
      commitTxid,
      error: 'Commit transaction not confirmed'
    };
  }

  // Step 3: Build and broadcast reveal transaction
  // Send revealed tokens back to platform address
  // Output is REVEAL amount (much smaller than commit - burns the difference!)
  const revealTxid = await buildAndBroadcastReveal(
    commitTxid,
    commitAddress,
    script,
    privateKey,
    publicKey,
    address,
    revealAmount  // Output the REVEAL amount (burns commit - reveal as protocol fee)
  );

  // Step 4: Wait for reveal confirmation
  console.log(`[Kasplex] Waiting for reveal confirmation...`);
  const revealConfirmed = await waitForConfirmation(revealTxid, 30, 1000);
  if (!revealConfirmed) {
    return {
      success: false,
      commitTxid,
      revealTxid,
      error: 'Reveal transaction not confirmed'
    };
  }

  return {
    success: true,
    commitTxid,
    revealTxid
  };
}

/**
 * Execute a full commit-reveal inscription with global lock
 * Prevents concurrent operations that could cause UTXO conflicts
 */
async function executeInscription(
  inscription: any,
  operation: string
): Promise<InscriptionResult> {
  return withInscriptionLock(() => executeInscriptionInternal(inscription, operation));
}

/**
 * Deploy a new KRC-20 token
 *
 * COST: ~1000 KAS (Kasplex protocol requirement)
 *
 * @param ticker - Token ticker (e.g., "YBTCA")
 * @param maxSupply - Maximum token supply
 * @param mintLimit - Max tokens per mint operation
 * @param decimals - Token decimals (default 8)
 */
export async function deployToken(
  ticker: string,
  maxSupply: number,
  mintLimit: number,
  decimals: number = 8
): Promise<InscriptionResult> {
  // Check if dependencies are available
  if (!await initDependencies()) {
    return {
      success: false,
      error: 'KasplexBuilder or Kaspa WASM not installed. Run: npm install KaffinPX/KasplexBuilder && npm run setup:kaspa'
    };
  }

  try {
    // Create deploy inscription
    const deployData: DeployData = {
      p: 'krc-20',
      op: 'deploy',
      tick: ticker,
      max: maxSupply.toString(),
      lim: mintLimit.toString(),
      dec: decimals.toString()
    };

    const inscription = new Inscription('deploy', {
      tick: deployData.tick,
      max: deployData.max,
      lim: deployData.lim,
      dec: deployData.dec
    });

    console.log(`[Kasplex] Deploying token ${ticker}...`);
    console.log(`[Kasplex] Deploy data:`, deployData);

    return await executeInscription(inscription, 'deploy');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Kasplex] Deploy failed:`, error);
    return {
      success: false,
      error: `Deploy failed: ${message}`
    };
  }
}

/**
 * Mint tokens to a recipient
 *
 * COST: ~1 KAS
 *
 * @param ticker - Token ticker
 * @param recipient - Recipient address (tokens go to platform, then transferred)
 */
export async function mintToken(
  ticker: string,
  recipient: string
): Promise<InscriptionResult> {
  // Check if dependencies are available
  if (!await initDependencies()) {
    return {
      success: false,
      error: 'KasplexBuilder or Kaspa WASM not installed'
    };
  }

  try {
    // Create mint inscription
    const mintData: MintData = {
      p: 'krc-20',
      op: 'mint',
      tick: ticker
    };

    const inscription = new Inscription('mint', {
      tick: mintData.tick
    });

    console.log(`[Kasplex] Minting ${ticker} for ${recipient}...`);

    return await executeInscription(inscription, 'mint');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Kasplex] Mint failed:`, error);
    return {
      success: false,
      error: `Mint failed: ${message}`
    };
  }
}

/**
 * Transfer tokens to a recipient
 *
 * COST: ~0.3 KAS
 *
 * @param ticker - Token ticker
 * @param to - Recipient address
 * @param amount - Amount to transfer
 */
export async function transferToken(
  ticker: string,
  to: string,
  amount: number
): Promise<InscriptionResult> {
  // Check if dependencies are available
  if (!await initDependencies()) {
    return {
      success: false,
      error: 'KasplexBuilder or Kaspa WASM not installed'
    };
  }

  try {
    // Convert amount to base units (integer) - KRC-20 uses 8 decimals
    // 19.33 tokens = 1933000000 base units
    const DECIMALS = 8;
    const baseUnits = Math.floor(amount * Math.pow(10, DECIMALS));

    // Create transfer inscription
    const transferData: TransferData = {
      p: 'krc-20',
      op: 'transfer',
      tick: ticker,
      amt: baseUnits.toString(),
      to
    };

    const inscription = new Inscription('transfer', {
      tick: transferData.tick,
      amt: transferData.amt,
      to: transferData.to
    });

    console.log(`[Kasplex] Transferring ${amount} ${ticker} (${baseUnits} base units) to ${to}...`);

    return await executeInscription(inscription, 'transfer');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Kasplex] Transfer failed:`, error);
    return {
      success: false,
      error: `Transfer failed: ${message}`
    };
  }
}

/**
 * Check if real KRC-20 operations are available
 */
export async function isAvailable(): Promise<boolean> {
  return await initDependencies();
}

/**
 * Get fee estimate for an operation
 */
export function getFeeEstimate(operation: 'deploy' | 'mint' | 'transfer'): number {
  switch (operation) {
    case 'deploy':
      return DEPLOY_FEE_KAS;
    case 'mint':
      return MINT_FEE_KAS;
    case 'transfer':
      return TRANSFER_FEE_KAS;
  }
}

/**
 * Get platform wallet balance (in KAS)
 */
export async function getPlatformBalance(): Promise<number> {
  if (!await initDependencies()) {
    return 0;
  }

  try {
    const address = getPlatformAddress();
    const utxos = await getUtxos(address);
    const total = utxos.reduce((sum, u) => sum + u.amount, 0n);
    return Number(total) / Number(SOMPI_PER_KAS);
  } catch (error) {
    console.error('[Kasplex] Failed to get platform balance:', error);
    return 0;
  }
}
