import { readFileSync } from 'fs';
import { Config } from './types.js';

export function loadConfig(): Config {
  const configPath = new URL('../config/default.json', import.meta.url);
  const configData = readFileSync(configPath, 'utf-8');
  const config = JSON.parse(configData) as Config;

  // Override with environment variables if present
  if (process.env.KASPA_RPC_URL) {
    config.rpcUrl = process.env.KASPA_RPC_URL;
  }

  return config;
}
