'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/hooks/useWallet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { PositionCard } from '@/components/PositionCard';
import { WalletModal } from '@/components/WalletModal';
import { formatKas, truncateAddress } from '@/lib/utils';

export default function WalletPage() {
  const { address, balance, positions, isConnected, walletType, refreshWallet, deposit } = useWallet();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositError, setDepositError] = useState('');

  const isNonCustodial = walletType === 'kastle' || walletType === 'kasware';
  const isDemo = walletType === 'demo';

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setDepositError('Enter a valid amount');
      return;
    }
    setIsDepositing(true);
    setDepositError('');
    try {
      await deposit(amount);
      setDepositAmount('');
    } catch (err) {
      setDepositError(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setIsDepositing(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-slide-in">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
          </svg>
        </div>
        <p className="text-foreground font-semibold text-lg mb-1">Connect your wallet</p>
        <p className="text-sm text-muted-foreground mb-6">View your positions and balance</p>
        <Button onClick={() => setShowConnectModal(true)}>
          Connect Wallet
        </Button>
        <WalletModal isOpen={showConnectModal} onClose={() => setShowConnectModal(false)} />
      </div>
    );
  }

  const openPositions = positions.filter((p) => p.market_status === 'OPEN');
  const resolvedPositions = positions.filter((p) => p.market_status === 'RESOLVED');

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-slide-in">
      {/* Account summary card */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-lg font-semibold">Portfolio</h1>
              {isNonCustodial && <Badge variant="success">Non-Custodial</Badge>}
              {isDemo && <Badge variant="warning">Demo</Badge>}
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              {truncateAddress(address || '', 12)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              {isNonCustodial ? 'On-Chain' : 'Platform'} Balance
            </div>
            <div className="text-3xl font-bold text-gradient tracking-tight">
              {balance === -1 ? '...' : formatKas(balance, 'compact')}
            </div>
          </div>
        </div>

        {isDemo && (
          <div className="pt-5 border-t border-border">
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Amount to deposit"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                suffix="KAS"
                error={depositError}
              />
              <Button onClick={handleDeposit} isLoading={isDepositing} disabled={!depositAmount}>
                Deposit
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Open positions */}
      <div>
        <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Open Positions ({openPositions.length})
        </h2>
        {openPositions.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <p className="text-sm text-muted-foreground mb-1">No open positions</p>
            <p className="text-xs text-muted-foreground/60">Go to Markets to start trading</p>
          </div>
        ) : (
          <div className="space-y-2">
            {openPositions.map((position) => (
              <PositionCard key={position.market_id} position={position} onAction={refreshWallet} />
            ))}
          </div>
        )}
      </div>

      {/* Resolved */}
      {resolvedPositions.length > 0 && (
        <div>
          <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Resolved ({resolvedPositions.length})
          </h2>
          <div className="space-y-2">
            {resolvedPositions.map((position) => (
              <PositionCard key={position.market_id} position={position} onAction={refreshWallet} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
