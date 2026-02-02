import 'dotenv/config';

async function main() {
  // Check the API submission format by trying different formats
  const apiBase = 'https://api-tn10.kaspa.org';
  
  // Dummy transaction to see what format the API expects
  const testFormats = [
    // Format 1: camelCase with nested previousOutpoint
    {
      inputs: [{
        previousOutpoint: { transactionId: 'abc', index: 0 },
        signatureScript: '',
        sequence: 0,
        sigOpCount: 1
      }],
      outputs: [{
        amount: 1000,
        scriptPublicKey: { scriptPublicKey: 'abc' }
      }],
      version: 0,
      lockTime: 0,
      subnetworkId: '0000000000000000000000000000000000000000',
      gas: 0,
      payload: ''
    },
    // Format 2: with value instead of amount
    {
      inputs: [{
        previousOutpoint: { transactionId: 'abc', index: 0 },
        signatureScript: '',
        sequence: 0,
        sigOpCount: 1
      }],
      outputs: [{
        value: 1000,
        scriptPublicKey: 'abc'
      }],
      version: 0,
      lockTime: 0,
      subnetworkId: '0000000000000000000000000000000000000000',
      gas: 0,
      payload: ''
    }
  ];
  
  for (let i = 0; i < testFormats.length; i++) {
    console.log(`\n=== Testing format ${i + 1} ===`);
    const res = await fetch(`${apiBase}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: testFormats[i] })
    });
    
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response:', text.slice(0, 300));
  }
}

main().catch(console.error);
