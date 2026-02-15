'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useWallet } from '@/lib/hooks/useWallet';
import type { WalletType } from '@/lib/wallet-providers';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const KASWARE_INSTALL_URL = 'https://chromewebstore.google.com/detail/kasware-wallet/hklhheigdmpoolooomdihmhlpjjdbklf';

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { connect, isConnecting, detectedWallets, refreshDetectedWallets } = useWallet();
  const [error, setError] = useState('');
  const [connectingType, setConnectingType] = useState<WalletType | null>(null);

  useEffect(() => {
    if (isOpen) {
      refreshDetectedWallets();
    }
  }, [isOpen, refreshDetectedWallets]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!isOpen || !mounted) return null;

  const handleConnect = async (type: WalletType) => {
    try {
      setError('');
      setConnectingType(type);
      await connect(type);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setConnectingType(null);
    }
  };

  const kaswareDetected = detectedWallets.some(w => w.type === 'kasware');

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[201] w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden my-auto animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="text-lg font-semibold">Connect Wallet</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* KasWare Wallet */}
          {kaswareDetected ? (
            <button
              onClick={() => handleConnect('kasware')}
              disabled={isConnecting}
              className="w-full flex items-center gap-4 p-4 bg-secondary rounded-xl border border-border hover:border-primary/40 hover:bg-card-hover transition-all disabled:opacity-50"
            >
              <span className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                💎
              </span>
              <div className="flex-1 text-left">
                <div className="font-medium text-foreground">KasWare Wallet</div>
                <div className="text-xs text-muted-foreground">Non-custodial browser wallet</div>
              </div>
              {connectingType === 'kasware' ? (
                <svg className="animate-spin h-5 w-5 text-primary" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <span className="text-[11px] font-semibold text-yes uppercase tracking-wider">Detected</span>
              )}
            </button>
          ) : (
            <button
              onClick={() => window.open(KASWARE_INSTALL_URL, '_blank')}
              className="w-full flex items-center gap-4 p-4 bg-secondary rounded-xl border border-border hover:border-border-light hover:bg-card-hover transition-all"
            >
              <span className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                💎
              </span>
              <div className="flex-1 text-left">
                <div className="font-medium text-foreground">KasWare Wallet</div>
                <div className="text-xs text-muted-foreground">Install the browser extension</div>
              </div>
              <span className="text-xs text-muted-foreground">Install →</span>
            </button>
          )}

          {/* More wallets coming soon */}
          <div className="flex items-center gap-4 p-4 rounded-xl border border-dashed border-border/60">
            <span className="w-12 h-12 bg-muted/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </span>
            <div className="flex-1 text-left">
              <div className="font-medium text-muted-foreground/70">More wallets</div>
              <div className="text-xs text-muted-foreground/50">Coming soon</div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-no bg-no/10 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
