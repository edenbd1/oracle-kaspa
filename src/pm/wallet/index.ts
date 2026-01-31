/**
 * Wallet Abstraction for Kaspa
 *
 * Provides a unified interface for wallet connections.
 * Supports: stub (demo), manual address entry.
 * Future: WalletConnect, browser extension wallets.
 */

export type WalletType = 'stub' | 'manual';

export interface WalletState {
  connected: boolean;
  type: WalletType | null;
  address: string | null;
  displayName: string | null;
}

export interface WalletAdapter {
  type: WalletType;
  connect(): Promise<string>;
  disconnect(): Promise<void>;
  getAddress(): string | null;
  signMessage?(message: string): Promise<string>;
}

/**
 * Stub wallet for demo/testing.
 * Generates a fake address.
 */
export class StubWallet implements WalletAdapter {
  type: WalletType = 'stub';
  private address: string | null = null;

  async connect(): Promise<string> {
    // Generate a demo address
    const random = Math.random().toString(36).slice(2, 10);
    this.address = `kaspatest:qz${random}demo${random}`;
    return this.address;
  }

  async disconnect(): Promise<void> {
    this.address = null;
  }

  getAddress(): string | null {
    return this.address;
  }
}

/**
 * Manual wallet entry.
 * User provides their own address.
 */
export class ManualWallet implements WalletAdapter {
  type: WalletType = 'manual';
  private address: string | null = null;

  constructor(private inputAddress?: string) {}

  async connect(): Promise<string> {
    if (!this.inputAddress) {
      throw new Error('No address provided');
    }
    if (!this.inputAddress.startsWith('kaspa')) {
      throw new Error('Invalid Kaspa address format');
    }
    this.address = this.inputAddress;
    return this.address;
  }

  async disconnect(): Promise<void> {
    this.address = null;
  }

  getAddress(): string | null {
    return this.address;
  }

  setAddress(address: string): void {
    this.inputAddress = address;
  }
}

/**
 * Wallet Manager - handles wallet state for the frontend.
 */
class WalletManager {
  private adapter: WalletAdapter | null = null;
  private state: WalletState = {
    connected: false,
    type: null,
    address: null,
    displayName: null
  };
  private listeners: Array<(state: WalletState) => void> = [];

  getState(): WalletState {
    return { ...this.state };
  }

  subscribe(listener: (state: WalletState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.getState());
    }
  }

  async connect(type: WalletType, options?: { address?: string }): Promise<string> {
    if (this.adapter) {
      await this.disconnect();
    }

    switch (type) {
      case 'stub':
        this.adapter = new StubWallet();
        break;
      case 'manual':
        this.adapter = new ManualWallet(options?.address);
        break;
      default:
        throw new Error(`Unknown wallet type: ${type}`);
    }

    const address = await this.adapter.connect();

    this.state = {
      connected: true,
      type,
      address,
      displayName: formatAddress(address)
    };

    this.notify();
    return address;
  }

  async disconnect(): Promise<void> {
    if (this.adapter) {
      await this.adapter.disconnect();
      this.adapter = null;
    }

    this.state = {
      connected: false,
      type: null,
      address: null,
      displayName: null
    };

    this.notify();
  }
}

/**
 * Format address for display (truncate middle).
 */
export function formatAddress(address: string): string {
  if (address.length <= 20) return address;
  const prefix = address.slice(0, 12);
  const suffix = address.slice(-6);
  return `${prefix}...${suffix}`;
}

/**
 * Validate Kaspa address format.
 */
export function isValidKaspaAddress(address: string): boolean {
  // Basic validation - starts with kaspa: or kaspatest:
  return /^kaspa(test)?:[a-z0-9]{60,}$/i.test(address);
}

// Global wallet manager instance
export const walletManager = new WalletManager();
