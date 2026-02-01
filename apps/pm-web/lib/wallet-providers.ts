/**
 * Kaspa Wallet Provider Integrations
 * Supports: Kastle, KasWare
 */

export type WalletType = 'kastle' | 'kasware' | 'demo';

// Kastle API (from https://github.com/forbole/kastle)
export interface KastleProvider {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  getAccount(): Promise<{ address: string; publicKey: string }>;
  signMessage(message: string): Promise<string>;
  sendKaspa(toAddress: string, sompi: number, options?: { priorityFee?: number; payload?: string }): Promise<string>;
  signAndBroadcastTx(networkId: 'mainnet' | 'testnet-10', txJson: string, scripts?: unknown): Promise<string>;
  signTx(networkId: 'mainnet' | 'testnet-10', txJson: string, scripts?: unknown): Promise<string>;
  switchNetwork(networkId: 'mainnet' | 'testnet-10'): Promise<string>;
  request(method: string, args?: unknown): Promise<unknown>;
  on?(event: string, callback: (...args: unknown[]) => void): void;
  removeListener?(event: string, callback: (...args: unknown[]) => void): void;
}

// KasWare API (from https://docs.kasware.xyz)
export interface KasWareProvider {
  requestAccounts(): Promise<string[]>;
  getAccounts(): Promise<string[]>;
  getBalance(): Promise<{ confirmed: number; unconfirmed: number; total: number }>;
  getNetwork(): Promise<string>;
  sendKaspa(toAddress: string, sompi: number, options?: { priorityFee?: number }): Promise<string>;
  disconnect?(origin: string): Promise<void>;
  on?(event: string, callback: (...args: unknown[]) => void): void;
  removeListener?(event: string, callback: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    kastle?: KastleProvider;
    kasware?: KasWareProvider;
  }
}

export interface DetectedWallet {
  type: WalletType;
  name: string;
  icon: string;
  provider: KastleProvider | KasWareProvider | null;
}

// Platform address to receive trades (testnet)
// TODO: Replace with actual platform wallet address
export const PLATFORM_ADDRESS = process.env.NEXT_PUBLIC_PLATFORM_ADDRESS || '';

// Sompi conversion (1 KAS = 100,000,000 sompi)
export const SOMPI_PER_KAS = 100_000_000;

export function kasToSompi(kas: number): number {
  return Math.floor(kas * SOMPI_PER_KAS);
}

export function sompiToKas(sompi: number): number {
  return sompi / SOMPI_PER_KAS;
}

export function detectWallets(): DetectedWallet[] {
  const wallets: DetectedWallet[] = [];

  if (typeof window !== 'undefined' && window.kastle) {
    wallets.push({
      type: 'kastle',
      name: 'Kastle',
      icon: '🏰',
      provider: window.kastle,
    });
  }

  if (typeof window !== 'undefined' && window.kasware) {
    wallets.push({
      type: 'kasware',
      name: 'KasWare',
      icon: '💎',
      provider: window.kasware,
    });
  }

  return wallets;
}

export async function connectWallet(type: WalletType): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    if (type === 'kastle') {
      const provider = window.kastle;
      if (!provider) {
        throw new Error('Kastle wallet not found. Please install the extension.');
      }

      const connected = await provider.connect();
      if (!connected) {
        throw new Error('Connection rejected by user');
      }

      const account = await provider.getAccount();
      if (account && account.address) {
        return account.address;
      }
      throw new Error('No account returned from Kastle');
    }

    if (type === 'kasware') {
      const provider = window.kasware;
      if (!provider) {
        throw new Error('KasWare wallet not found. Please install the extension.');
      }

      const accounts = await provider.requestAccounts();
      if (accounts && accounts.length > 0) {
        return accounts[0];
      }
      throw new Error('No accounts returned from KasWare');
    }

    throw new Error(`Unknown wallet type: ${type}`);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('rejected') || error.message.includes('denied') || error.message.includes('cancel')) {
        throw new Error('Connection rejected by user');
      }
      throw error;
    }
    throw new Error('Failed to connect wallet');
  }
}

/**
 * Send KAS using Kastle wallet
 * Returns transaction ID if successful
 */
export async function sendKaspa(
  type: WalletType,
  toAddress: string,
  amountKas: number,
  payload?: string
): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Window not available');
  }

  const sompi = kasToSompi(amountKas);

  if (type === 'kastle') {
    const provider = window.kastle;
    if (!provider) {
      throw new Error('Kastle wallet not found');
    }

    try {
      console.log('[Trade] Sending tx via Kastle:', { toAddress, sompi, priorityFee: 0 });
      const txid = await provider.sendKaspa(toAddress, sompi, {
        priorityFee: 0,
        payload: payload,
      });
      console.log('[Trade] Tx sent via Kastle:', txid);
      return txid;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('rejected') || error.message.includes('cancel')) {
          throw new Error('Transaction rejected by user');
        }
        throw error;
      }
      throw new Error('Failed to send transaction');
    }
  }

  if (type === 'kasware') {
    const provider = window.kasware;
    if (!provider) {
      throw new Error('KasWare wallet not found');
    }

    try {
      console.log('[Trade] Sending tx via KasWare:', { toAddress, sompi, priorityFee: 0 });
      const txid = await provider.sendKaspa(toAddress, sompi, {
        priorityFee: 0,
      });
      console.log('[Trade] Tx sent via KasWare:', txid);
      return txid;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('rejected') || error.message.includes('cancel')) {
          throw new Error('Transaction rejected by user');
        }
        throw error;
      }
      throw new Error('Failed to send transaction');
    }
  }

  throw new Error(`Wallet type ${type} does not support sendKaspa`);
}

/**
 * Fetch balance from Kaspa API for an address
 */
export async function fetchAddressBalance(address: string): Promise<number> {
  try {
    // Determine API based on address prefix
    const isTestnet = address.startsWith('kaspatest:');
    const apiBase = isTestnet
      ? 'https://api-tn10.kaspa.org'
      : 'https://api.kaspa.org';

    const response = await fetch(`${apiBase}/addresses/${address}/balance`);
    if (!response.ok) {
      console.error('Failed to fetch balance:', response.status);
      return -1;
    }

    const data = await response.json();
    // API returns balance in sompi
    return sompiToKas(data.balance || 0);
  } catch (error) {
    console.error('Error fetching balance:', error);
    return -1;
  }
}

export async function getWalletBalance(type: WalletType, address?: string): Promise<number> {
  if (typeof window === 'undefined') return 0;

  try {
    if (type === 'kasware') {
      const provider = window.kasware;
      if (!provider) return 0;

      const balance = await provider.getBalance();
      return sompiToKas(balance.total);
    }

    if (type === 'kastle') {
      // Kastle doesn't expose a getBalance method directly
      // Fetch from Kaspa API if address is provided
      if (address) {
        return await fetchAddressBalance(address);
      }
      return -1;
    }

    return 0;
  } catch {
    return 0;
  }
}

export async function getWalletNetwork(type: WalletType): Promise<string> {
  if (typeof window === 'undefined') return 'unknown';

  try {
    if (type === 'kasware') {
      const provider = window.kasware;
      if (!provider) return 'unknown';
      return await provider.getNetwork();
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export function subscribeToWalletEvents(
  type: WalletType,
  callbacks: {
    onAccountsChanged?: (accounts: string[]) => void;
    onNetworkChanged?: (network: string) => void;
    onBalanceChanged?: (balance: { confirmed: number; total: number }) => void;
    onDisconnect?: () => void;
  }
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handlers: Array<[string, (...args: unknown[]) => void]> = [];
  let provider: KastleProvider | KasWareProvider | undefined;

  if (type === 'kastle') {
    provider = window.kastle;
  } else if (type === 'kasware') {
    provider = window.kasware;
  }

  if (!provider?.on) return () => {};

  if (callbacks.onAccountsChanged) {
    const handler = (accounts: unknown) => {
      if (Array.isArray(accounts)) {
        callbacks.onAccountsChanged!(accounts as string[]);
      } else if (accounts && typeof accounts === 'object' && 'address' in accounts) {
        callbacks.onAccountsChanged!([(accounts as { address: string }).address]);
      }
    };
    provider.on('accountsChanged', handler);
    handlers.push(['accountsChanged', handler]);
  }

  if (callbacks.onNetworkChanged) {
    const handler = (network: unknown) => {
      callbacks.onNetworkChanged!(network as string);
    };
    provider.on('networkChanged', handler);
    handlers.push(['networkChanged', handler]);
  }

  if (callbacks.onBalanceChanged && type === 'kasware') {
    const handler = (balance: unknown) => {
      callbacks.onBalanceChanged!(balance as { confirmed: number; total: number });
    };
    provider.on('balanceChanged', handler);
    handlers.push(['balanceChanged', handler]);
  }

  return () => {
    if (provider?.removeListener) {
      for (const [event, handler] of handlers) {
        provider.removeListener(event, handler);
      }
    }
  };
}
