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
  sendKaspa(toAddress: string, sompi: number, options?: { priorityFee?: number }): Promise<string>;
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

export function detectWallets(): DetectedWallet[] {
  const wallets: DetectedWallet[] = [];

  // Check for Kastle
  if (typeof window !== 'undefined' && window.kastle) {
    wallets.push({
      type: 'kastle',
      name: 'Kastle',
      icon: '🏰',
      provider: window.kastle,
    });
  }

  // Check for KasWare
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

      // Kastle uses connect() then getAccount()
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

      // KasWare uses requestAccounts()
      const accounts = await provider.requestAccounts();
      if (accounts && accounts.length > 0) {
        return accounts[0];
      }
      throw new Error('No accounts returned from KasWare');
    }

    throw new Error(`Unknown wallet type: ${type}`);
  } catch (error) {
    if (error instanceof Error) {
      // User rejected or other error
      if (error.message.includes('rejected') || error.message.includes('denied') || error.message.includes('cancel')) {
        throw new Error('Connection rejected by user');
      }
      throw error;
    }
    throw new Error('Failed to connect wallet');
  }
}

export async function getWalletBalance(type: WalletType): Promise<number> {
  if (typeof window === 'undefined') return 0;

  try {
    if (type === 'kasware') {
      const provider = window.kasware;
      if (!provider) return 0;

      const balance = await provider.getBalance();
      // Balance is returned in sompi (1 KAS = 100,000,000 sompi)
      return balance.total / 100_000_000;
    }

    // Kastle doesn't have a getBalance method in the basic API
    // Balance would need to be fetched from the platform
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

    // Kastle network can be checked via request method if needed
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
        // Kastle returns { address, publicKey }
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

  // Return cleanup function
  return () => {
    if (provider?.removeListener) {
      for (const [event, handler] of handlers) {
        provider.removeListener(event, handler);
      }
    }
  };
}
