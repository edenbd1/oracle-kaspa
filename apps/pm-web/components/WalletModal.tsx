'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '@/lib/hooks/useWallet';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardHeader, CardContent } from './ui/Card';
import type { WalletType } from '@/lib/wallet-providers';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WALLET_INFO: Record<string, { name: string; icon: string; installUrl: string }> = {
  kastle: {
    name: 'Kastle',
    icon: '🏰',
    installUrl: 'https://chromewebstore.google.com/detail/kastle/oambclflhjfppdmkghokjmpppmaebego',
  },
  kasware: {
    name: 'KasWare',
    icon: '💎',
    installUrl: 'https://chromewebstore.google.com/detail/kasware-wallet/hklhheigdmpoolooomdihmhlpjjdbklf',
  },
};

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { connect, isConnecting, detectedWallets, refreshDetectedWallets } = useWallet();
  const [customAddress, setCustomAddress] = useState('');
  const [error, setError] = useState('');
  const [connectingType, setConnectingType] = useState<WalletType | null>(null);

  // Refresh detected wallets when modal opens
  useEffect(() => {
    if (isOpen) {
      refreshDetectedWallets();
    }
  }, [isOpen, refreshDetectedWallets]);

  if (!isOpen) return null;

  const handleConnect = async (type: WalletType, address?: string) => {
    try {
      setError('');
      setConnectingType(type);
      await connect(type, address);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setConnectingType(null);
    }
  };

  const handleCustomConnect = () => {
    if (!customAddress.trim()) {
      setError('Please enter an address');
      return;
    }
    handleConnect('demo', customAddress.trim());
  };

  const handleInstallWallet = (type: string) => {
    const info = WALLET_INFO[type];
    if (info) {
      window.open(info.installUrl, '_blank');
    }
  };

  const hasDetectedWallets = detectedWallets.length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 z-[100]" onClick={onClose} />
      <Card className="relative z-[101] w-full max-w-md my-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Connect Wallet</h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Detected Wallets */}
          {hasDetectedWallets && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-2">Detected Wallets</p>
              {detectedWallets.map((wallet) => (
                <Button
                  key={wallet.type}
                  variant="secondary"
                  className="w-full justify-start gap-3"
                  onClick={() => handleConnect(wallet.type)}
                  isLoading={connectingType === wallet.type}
                  disabled={isConnecting}
                >
                  <span className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center text-lg">
                    {wallet.icon}
                  </span>
                  <span className="flex-1 text-left">{wallet.name}</span>
                  <span className="text-xs text-success">Detected</span>
                </Button>
              ))}
            </div>
          )}

          {/* Not Detected Wallets */}
          {!hasDetectedWallets && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-2">Install a Kaspa Wallet</p>
              {Object.entries(WALLET_INFO).map(([type, info]) => (
                <Button
                  key={type}
                  variant="secondary"
                  className="w-full justify-start gap-3"
                  onClick={() => handleInstallWallet(type)}
                >
                  <span className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center text-lg">
                    {info.icon}
                  </span>
                  <span className="flex-1 text-left">{info.name}</span>
                  <span className="text-xs text-muted-foreground">Install →</span>
                </Button>
              ))}
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or use demo</span>
            </div>
          </div>

          {/* Demo Wallet */}
          <div className="space-y-2">
            <Button
              variant="secondary"
              className="w-full justify-start gap-3"
              onClick={() => handleConnect('demo')}
              isLoading={connectingType === 'demo'}
              disabled={isConnecting}
            >
              <span className="w-8 h-8 bg-warning/20 rounded-lg flex items-center justify-center">
                <span className="text-warning font-bold">D</span>
              </span>
              <span className="flex-1 text-left">Demo Wallet</span>
              <span className="text-xs text-warning">1000 KAS</span>
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or enter address</span>
            </div>
          </div>

          {/* Custom Address */}
          <div className="space-y-3">
            <Input
              label="Custom Address"
              placeholder="kaspa:qz... or kaspatest:qz..."
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value)}
            />
            <Button
              variant="primary"
              className="w-full"
              onClick={handleCustomConnect}
              isLoading={connectingType === 'demo' && customAddress.trim() !== ''}
              disabled={!customAddress.trim() || isConnecting}
            >
              Connect with Address
            </Button>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            New addresses receive 1000 KAS for demo trading.
            {!hasDetectedWallets && (
              <> Install <a href="https://chromewebstore.google.com/detail/kastle/oambclflhjfppdmkghokjmpppmaebego" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Kastle</a> for real wallet connection.</>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
