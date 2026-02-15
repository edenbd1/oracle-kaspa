'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useWallet } from '@/lib/hooks/useWallet';
import { redeemTokens } from '@/lib/api';
import { formatKas, formatProbability } from '@/lib/utils';
import type { Position } from '@/lib/types';

interface PositionCardProps {
  position: Position;
  onAction?: () => void;
}

export function PositionCard({ position, onAction }: PositionCardProps) {
  const { address, refreshWallet } = useWallet();
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState('');

  const isResolved = position.market_status === 'RESOLVED';
  const hasYesShares = position.yes_shares > 0;
  const hasNoShares = position.no_shares > 0;

  const isYesWinner = isResolved && position.market_resolved_outcome === 'YES';
  const isNoWinner = isResolved && position.market_resolved_outcome === 'NO';

  const canRedeemYes = isYesWinner && hasYesShares;
  const canRedeemNo = isNoWinner && hasNoShares;

  const currentValue =
    (position.yes_shares * (position.current_price_yes ?? 0)) +
    (position.no_shares * (position.current_price_no ?? 0));

  const handleRedeem = async (ticker: string, amount: number) => {
    if (!address) return;

    setIsRedeeming(true);
    setRedeemError('');
    setRedeemSuccess('');

    try {
      const result = await redeemTokens(address, ticker, amount);
      if (result.ok) {
        setRedeemSuccess(`Redeemed ${result.amount_redeemed?.toFixed(2)} tokens for ${result.kas_received?.toFixed(2)} KAS`);
        await refreshWallet();
        onAction?.();
      } else {
        setRedeemError(result.error || 'Redemption failed');
      }
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : 'Redemption failed');
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <Link
              href={`/pm/market/${position.market_id}`}
              className="font-semibold text-foreground hover:text-primary transition-colors"
            >
              {position.market_label || position.market_id}
            </Link>

            <div className="mt-2.5 space-y-1.5">
              {hasYesShares && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-yes">
                    {position.yes_shares.toFixed(2)} YES
                  </span>
                  {position.yes_token_ticker && (
                    <span className="text-muted-foreground text-xs font-mono">
                      ({position.yes_token_ticker})
                    </span>
                  )}
                  {!isResolved && position.current_price_yes !== undefined && (
                    <span className="text-muted-foreground font-mono text-xs">
                      @ {formatProbability(position.current_price_yes)}
                    </span>
                  )}
                  {isYesWinner && <Badge variant="success">Winner</Badge>}
                </div>
              )}

              {hasNoShares && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-no">
                    {position.no_shares.toFixed(2)} NO
                  </span>
                  {position.no_token_ticker && (
                    <span className="text-muted-foreground text-xs font-mono">
                      ({position.no_token_ticker})
                    </span>
                  )}
                  {!isResolved && position.current_price_no !== undefined && (
                    <span className="text-muted-foreground font-mono text-xs">
                      @ {formatProbability(position.current_price_no)}
                    </span>
                  )}
                  {isNoWinner && <Badge variant="success">Winner</Badge>}
                </div>
              )}
            </div>

            <div className="mt-2.5 text-sm text-muted-foreground">
              {isResolved ? (
                <span>
                  {isYesWinner && `Payout: ${formatKas(position.yes_shares)}`}
                  {isNoWinner && `Payout: ${formatKas(position.no_shares)}`}
                  {!isYesWinner && !isNoWinner && 'Position expired worthless'}
                </span>
              ) : (
                <span>Current value: <span className="font-semibold text-foreground">{formatKas(currentValue)}</span></span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {isResolved ? (
              <>
                {canRedeemYes && position.yes_token_ticker && (
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => handleRedeem(position.yes_token_ticker!, position.yes_shares)}
                    isLoading={isRedeeming}
                  >
                    Redeem YES
                  </Button>
                )}
                {canRedeemNo && position.no_token_ticker && (
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => handleRedeem(position.no_token_ticker!, position.no_shares)}
                    isLoading={isRedeeming}
                  >
                    Redeem NO
                  </Button>
                )}
                {!canRedeemYes && !canRedeemNo && (
                  <Badge variant="muted">Closed</Badge>
                )}
              </>
            ) : (
              <Badge variant="default">Open</Badge>
            )}
          </div>
        </div>

        {redeemError && (
          <div className="mt-3 text-sm text-no bg-no/10 rounded-lg px-3 py-2">
            {redeemError}
          </div>
        )}
        {redeemSuccess && (
          <div className="mt-3 text-sm text-yes bg-yes/10 rounded-lg px-3 py-2">
            {redeemSuccess}
          </div>
        )}
      </div>
    </div>
  );
}
