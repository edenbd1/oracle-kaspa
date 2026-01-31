'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/hooks/useWallet';
import { Button } from './ui/Button';
import { WalletModal } from './WalletModal';
import { formatKas, truncateAddress } from '@/lib/utils';

const WALLET_ICONS: Record<string, string> = {
  kastle: '🏰',
  kasware: '💎',
  demo: '🎮',
};

export function WalletButton() {
  const { address, balance, isConnected, isConnecting, walletType, disconnect } = useWallet();
  const [showModal, setShowModal] = useState(false);

  if (isConnected && address) {
    const icon = walletType ? WALLET_ICONS[walletType] || '' : '';

    return (
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-sm font-medium text-foreground flex items-center gap-1 justify-end">
            {icon && <span>{icon}</span>}
            {formatKas(balance)}
          </div>
          <div className="text-xs text-muted-foreground">{truncateAddress(address)}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={disconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button onClick={() => setShowModal(true)} isLoading={isConnecting}>
        Connect Wallet
      </Button>
      <WalletModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
