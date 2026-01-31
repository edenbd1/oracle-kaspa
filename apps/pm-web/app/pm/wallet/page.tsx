'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/hooks/useWallet';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PositionCard } from '@/components/PositionCard';
import { WalletModal } from '@/components/WalletModal';
import { formatKas, truncateAddress } from '@/lib/utils';

export default function WalletPage() {
  const { address, balance, positions, isConnected, refreshWallet, deposit } = useWallet();
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositError, setDepositError] = useState('');

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setDepositError('Please enter a valid amount');
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
      <div className="max-w-md mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-4">
              Connect your wallet to view your positions and balance
            </div>
            <Button onClick={() => setShowConnectModal(true)}>
              Connect Wallet
            </Button>
          </CardContent>
        </Card>
        <WalletModal
          isOpen={showConnectModal}
          onClose={() => setShowConnectModal(false)}
        />
      </div>
    );
  }

  const openPositions = positions.filter((p) => p.market_status === 'OPEN');
  const resolvedPositions = positions.filter((p) => p.market_status === 'RESOLVED');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Wallet info */}
      <Card>
        <CardHeader>
          <h1 className="text-xl font-bold">Wallet</h1>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="text-sm text-muted-foreground mb-1">Address</div>
              <div className="font-mono text-sm break-all">
                {address}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-1">Balance</div>
              <div className="text-2xl font-bold">{formatKas(balance)}</div>
            </div>
          </div>

          <hr className="border-border" />

          <div>
            <div className="text-sm text-muted-foreground mb-2">
              Deposit KAS (Demo)
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Amount"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                suffix="KAS"
                error={depositError}
              />
              <Button
                onClick={handleDeposit}
                isLoading={isDepositing}
                disabled={!depositAmount}
              >
                Deposit
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Open positions */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          Open Positions ({openPositions.length})
        </h2>
        {openPositions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No open positions. Start trading to build your portfolio.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {openPositions.map((position) => (
              <PositionCard
                key={position.market_id}
                position={position}
                onAction={refreshWallet}
              />
            ))}
          </div>
        )}
      </div>

      {/* Resolved positions */}
      {resolvedPositions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">
            Resolved Positions ({resolvedPositions.length})
          </h2>
          <div className="space-y-3">
            {resolvedPositions.map((position) => (
              <PositionCard
                key={position.market_id}
                position={position}
                onAction={refreshWallet}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
