'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/hooks/useWallet';
import { WalletModal } from './WalletModal';
import { formatKas, truncateAddress } from '@/lib/utils';

export function WalletButton() {
  const { address, balance, isConnected, isConnecting, walletType, disconnect } = useWallet();
  const [showModal, setShowModal] = useState(false);

  const isNonCustodial = walletType === 'kastle' || walletType === 'kasware';

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2.5 px-3 py-1.5 bg-muted/50 rounded-lg border border-border">
          <div className={`w-2 h-2 rounded-full ${isNonCustodial ? 'bg-yes' : 'bg-warning'}`} />
          <div className="text-right">
            <div className="text-xs font-semibold text-foreground leading-none">
              {balance === -1 ? '...' : formatKas(balance, 'compact')}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground leading-tight mt-0.5">
              {truncateAddress(address, 6)}
            </div>
          </div>
        </div>
        <button
          onClick={disconnect}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          title="Disconnect"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={isConnecting}
        className="px-4 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {isConnecting ? 'Connecting...' : 'Connect'}
      </button>
      <WalletModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
