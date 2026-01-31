'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Sparkline } from './Sparkline';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { useWallet } from '@/lib/hooks/useWallet';
import { executeTrade } from '@/lib/api';
import { formatPrice, formatProbability, formatKas } from '@/lib/utils';
import type { Market } from '@/lib/types';

interface MarketRowProps {
  market: Market;
  onTradeComplete?: () => void;
}

export function MarketRow({ market, onTradeComplete }: MarketRowProps) {
  const { address, isConnected, balance, refreshWallet } = useWallet();
  const [isTrading, setIsTrading] = useState<'YES' | 'NO' | null>(null);

  const priceYes = market.price_yes ?? 0.5;
  const priceNo = market.price_no ?? 0.5;

  const handleQuickBuy = async (side: 'YES' | 'NO') => {
    if (!isConnected || !address) {
      alert('Please connect your wallet first');
      return;
    }

    const amount = 10; // Quick buy amount
    if (balance < amount) {
      alert('Insufficient balance');
      return;
    }

    setIsTrading(side);
    try {
      const result = await executeTrade({
        marketId: market.id,
        address,
        side,
        action: 'BUY',
        kasAmount: amount,
      });

      if (result.ok) {
        await refreshWallet();
        onTradeComplete?.();
      } else {
        alert(result.error || 'Trade failed');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Trade failed');
    } finally {
      setIsTrading(null);
    }
  };

  const isResolved = market.status === 'RESOLVED';
  const direction = market.direction === '>=' ? '≥' : '≤';

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="px-4 py-4">
        <Link href={`/pm/market/${market.id}`} className="block">
          <div className="font-medium text-foreground hover:text-primary transition-colors">
            BTC {direction} {formatPrice(market.threshold_price)}
          </div>
          {market.yes_token_ticker && (
            <div className="text-xs text-muted-foreground mt-0.5">
              {market.yes_token_ticker}
            </div>
          )}
        </Link>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="min-w-[70px]">
            <div className="flex items-center gap-1">
              <span className="text-success font-medium">{formatProbability(priceYes)}</span>
              <span className="text-muted-foreground text-xs">YES</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-destructive font-medium">{formatProbability(priceNo)}</span>
              <span className="text-muted-foreground text-xs">NO</span>
            </div>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all"
              style={{ width: `${priceYes * 100}%` }}
            />
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <Sparkline data={market.price_history || []} />
      </td>
      <td className="px-4 py-4 text-right">
        <div className="text-sm text-muted-foreground">
          {formatKas(market.volume)}
        </div>
        <div className="text-xs text-muted-foreground">
          {market.trades_count} trades
        </div>
      </td>
      <td className="px-4 py-4">
        {isResolved ? (
          <Badge variant={market.resolved_outcome === 'YES' ? 'success' : 'danger'}>
            {market.resolved_outcome}
          </Badge>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="success"
              onClick={() => handleQuickBuy('YES')}
              isLoading={isTrading === 'YES'}
              disabled={isTrading !== null}
            >
              Yes
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleQuickBuy('NO')}
              isLoading={isTrading === 'NO'}
              disabled={isTrading !== null}
            >
              No
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
