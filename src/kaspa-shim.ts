// WebSocket shim for Node.js - must be loaded before kaspa-wasm
import websocket from 'websocket';
// @ts-expect-error - setting global WebSocket
globalThis.WebSocket = websocket.w3cwebsocket;

// Re-export everything from kaspa-wasm
export * from 'kaspa-wasm';

// Also export as default for convenience
import * as kaspaWasm from 'kaspa-wasm';
export default kaspaWasm;
