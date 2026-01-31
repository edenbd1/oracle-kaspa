'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchWallet, deposit as apiDeposit } from '../api';
import {
  WalletType,
  detectWallets,
  connectWallet as connectWalletProvider,
  getWalletBalance,
  subscribeToWalletEvents,
  DetectedWallet,
} from '../wallet-providers';
import type { Position } from '../types';

interface WalletContextType {
  address: string | null;
  balance: number;
  positions: Position[];
  isConnecting: boolean;
  isConnected: boolean;
  walletType: WalletType | null;
  detectedWallets: DetectedWallet[];
  connect: (type: WalletType, customAddress?: string) => Promise<void>;
  disconnect: () => void;
  refreshWallet: () => Promise<void>;
  refreshDetectedWallets: () => void;
  deposit: (amount: number) => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

const STORAGE_KEY = 'pm_wallet_address';
const WALLET_TYPE_KEY = 'pm_wallet_type';
const DEFAULT_DEMO_ADDRESS = 'kaspatest:qz0123456789demo';

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [positions, setPositions] = useState<Position[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [detectedWallets, setDetectedWallets] = useState<DetectedWallet[]>([]);

  const refreshDetectedWallets = useCallback(() => {
    const wallets = detectWallets();
    setDetectedWallets(wallets);
  }, []);

  // Detect wallets on mount and when window loads
  useEffect(() => {
    refreshDetectedWallets();

    // Re-check after a delay (wallets may inject after initial load)
    const timeout = setTimeout(refreshDetectedWallets, 1000);
    return () => clearTimeout(timeout);
  }, [refreshDetectedWallets]);

  const refreshWallet = useCallback(async () => {
    if (!address) return;

    try {
      // Get PM platform balance and positions
      const data = await fetchWallet(address);
      setPositions(data.positions);

      // If using a real wallet, also check on-chain balance
      if (walletType && walletType !== 'demo') {
        const onChainBalance = await getWalletBalance(walletType);
        // Use platform balance for trading, but show on-chain balance info
        setBalance(data.balance_kas);
      } else {
        setBalance(data.balance_kas);
      }
    } catch (error) {
      console.error('Failed to refresh wallet:', error);
    }
  }, [address, walletType]);

  const connect = useCallback(async (type: WalletType, customAddress?: string) => {
    setIsConnecting(true);

    try {
      let addr: string;

      if (type === 'demo') {
        // Demo wallet
        addr = customAddress || DEFAULT_DEMO_ADDRESS;
      } else {
        // Real wallet connection
        const connectedAddress = await connectWalletProvider(type);
        if (!connectedAddress) {
          throw new Error('Failed to get address from wallet');
        }
        addr = connectedAddress;
      }

      // Fetch or create platform account
      const data = await fetchWallet(addr);

      if (data.balance_kas === 0 && data.deposited_kas === 0) {
        // New wallet on platform, give them starting balance for demo
        await apiDeposit(addr, 1000);
        const updated = await fetchWallet(addr);
        setBalance(updated.balance_kas);
        setPositions(updated.positions);
      } else {
        setBalance(data.balance_kas);
        setPositions(data.positions);
      }

      setAddress(addr);
      setWalletType(type);
      localStorage.setItem(STORAGE_KEY, addr);
      localStorage.setItem(WALLET_TYPE_KEY, type);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setBalance(0);
    setPositions([]);
    setWalletType(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(WALLET_TYPE_KEY);
  }, []);

  const deposit = useCallback(async (amount: number) => {
    if (!address) throw new Error('No wallet connected');

    const result = await apiDeposit(address, amount);
    setBalance(result.balance.balance_kas);
  }, [address]);

  // Auto-connect on mount if previously connected
  useEffect(() => {
    const savedAddress = localStorage.getItem(STORAGE_KEY);
    const savedType = localStorage.getItem(WALLET_TYPE_KEY) as WalletType | null;

    if (savedAddress && savedType) {
      // For demo wallets, just restore the session
      if (savedType === 'demo') {
        connect('demo', savedAddress);
      } else {
        // For real wallets, try to reconnect
        // This requires user to have the wallet unlocked
        connect(savedType).catch(() => {
          // If reconnection fails, clear saved state
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(WALLET_TYPE_KEY);
        });
      }
    }
  }, [connect]);

  // Subscribe to wallet events when connected
  useEffect(() => {
    if (!address || !walletType || walletType === 'demo') return;

    const unsubscribe = subscribeToWalletEvents(walletType, {
      onAccountsChanged: (accounts) => {
        if (accounts.length === 0) {
          disconnect();
        } else if (accounts[0] !== address) {
          // Account changed, reconnect
          connect(walletType);
        }
      },
      onBalanceChanged: () => {
        refreshWallet();
      },
    });

    return unsubscribe;
  }, [address, walletType, disconnect, connect, refreshWallet]);

  // Poll for updates when connected
  useEffect(() => {
    if (!address) return;

    const interval = setInterval(refreshWallet, 5000);
    return () => clearInterval(interval);
  }, [address, refreshWallet]);

  return (
    <WalletContext.Provider
      value={{
        address,
        balance,
        positions,
        isConnecting,
        isConnected: !!address,
        walletType,
        detectedWallets,
        connect,
        disconnect,
        refreshWallet,
        refreshDetectedWallets,
        deposit,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
