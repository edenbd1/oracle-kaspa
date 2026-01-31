'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from './ui/Card';
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
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <Link
              href={`/pm/market/${position.market_id}`}
              className="font-medium text-foreground hover:text-primary transition-colors"
            >
              {position.market_label || position.market_id}
            </Link>

            <div className="mt-2 space-y-1">
              {hasYesShares && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-success font-medium">
                    {position.yes_shares.toFixed(2)} YES
                  </span>
                  {position.yes_token_ticker && (
                    <span className="text-muted-foreground text-xs">
                      ({position.yes_token_ticker})
                    </span>
                  )}
                  {!isResolved && position.current_price_yes !== undefined && (
                    <span className="text-muted-foreground">
                      @ {formatProbability(position.current_price_yes)}
                    </span>
                  )}
                  {isYesWinner && <Badge variant="success">WINNER</Badge>}
                </div>
              )}

              {hasNoShares && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-destructive font-medium">
                    {position.no_shares.toFixed(2)} NO
                  </span>
                  {position.no_token_ticker && (
                    <span className="text-muted-foreground text-xs">
                      ({position.no_token_ticker})
                    </span>
                  )}
                  {!isResolved && position.current_price_no !== undefined && (
                    <span className="text-muted-foreground">
                      @ {formatProbability(position.current_price_no)}
                    </span>
                  )}
                  {isNoWinner && <Badge variant="success">WINNER</Badge>}
                </div>
              )}
            </div>

            <div className="mt-2 text-sm text-muted-foreground">
              {isResolved ? (
                <span>
                  {isYesWinner && `Payout: ${formatKas(position.yes_shares)}`}
                  {isNoWinner && `Payout: ${formatKas(position.no_shares)}`}
                  {!isYesWinner && !isNoWinner && 'Position expired worthless'}
                </span>
              ) : (
                <span>Current value: {formatKas(currentValue)}</span>
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
          <div className="mt-3 text-sm text-destructive bg-destructive/10 rounded px-2 py-1">
            {redeemError}
          </div>
        )}
        {redeemSuccess && (
          <div className="mt-3 text-sm text-success bg-success/10 rounded px-2 py-1">
            {redeemSuccess}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
