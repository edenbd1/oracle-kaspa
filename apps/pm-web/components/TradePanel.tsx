'use client';

import { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardHeader, CardContent } from './ui/Card';
import { useWallet } from '@/lib/hooks/useWallet';
import { useQuote } from '@/lib/hooks/useQuote';
import { executeTrade } from '@/lib/api';
import { formatKas, formatCents, formatProbability, classNames } from '@/lib/utils';
import type { Market, TradeSide, TradeAction } from '@/lib/types';

interface TradePanelProps {
  market: Market;
  onTradeComplete?: () => void;
}

export function TradePanel({ market, onTradeComplete }: TradePanelProps) {
  const { address, isConnected, balance, refreshWallet } = useWallet();
  const [side, setSide] = useState<TradeSide>('YES');
  const [action, setAction] = useState<TradeAction>('BUY');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const numAmount = parseFloat(amount) || 0;
  const { quote, isLoading: quoteLoading } = useQuote({
    marketId: market.id,
    side,
    action,
    amount: numAmount,
    enabled: isConnected && numAmount > 0,
  });

  const handleSubmit = async () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    if (numAmount <= 0) {
      setError('Please enter an amount');
      return;
    }

    if (action === 'BUY' && numAmount > balance) {
      setError('Insufficient balance');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const result = await executeTrade({
        marketId: market.id,
        address,
        side,
        action,
        ...(action === 'BUY' ? { kasAmount: numAmount } : { sharesAmount: numAmount }),
      });

      if (result.ok) {
        const shares = result.sharesFilled?.toFixed(2) || '?';
        const kas = (result.kasSpent || result.kasReceived || 0).toFixed(2);
        setSuccess(
          action === 'BUY'
            ? `Bought ${shares} ${side} shares for ${kas} KAS`
            : `Sold ${shares} ${side} shares for ${kas} KAS`
        );
        setAmount('');
        await refreshWallet();
        onTradeComplete?.();
      } else {
        setError(result.error || 'Trade failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trade failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isResolved = market.status === 'RESOLVED';

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">Trade</h3>
      </CardHeader>
      <CardContent className="space-y-4">
        {isResolved ? (
          <div className="text-center py-4 text-muted-foreground">
            Market is resolved. Trading is closed.
          </div>
        ) : (
          <>
            {/* Side toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSide('YES')}
                className={classNames(
                  'py-2.5 px-4 rounded-lg font-medium transition-colors',
                  side === 'YES'
                    ? 'bg-success text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                YES
              </button>
              <button
                onClick={() => setSide('NO')}
                className={classNames(
                  'py-2.5 px-4 rounded-lg font-medium transition-colors',
                  side === 'NO'
                    ? 'bg-destructive text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                NO
              </button>
            </div>

            {/* Action toggle */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAction('BUY')}
                className={classNames(
                  'py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                  action === 'BUY'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                BUY
              </button>
              <button
                onClick={() => setAction('SELL')}
                className={classNames(
                  'py-2 px-4 rounded-lg text-sm font-medium transition-colors',
                  action === 'SELL'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                SELL
              </button>
            </div>

            {/* Amount input */}
            <Input
              label={action === 'BUY' ? 'Amount (KAS)' : 'Shares to sell'}
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              suffix={action === 'BUY' ? 'KAS' : 'shares'}
            />

            {isConnected && action === 'BUY' && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Balance:</span>
                <button
                  onClick={() => setAmount(balance.toFixed(2))}
                  className="text-primary hover:underline"
                >
                  {formatKas(balance)}
                </button>
              </div>
            )}

            {/* Quote preview */}
            {quote && (
              <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">You {action === 'BUY' ? 'receive' : 'sell'}:</span>
                  <span className="font-medium">{quote.shares.toFixed(2)} {side} shares</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg price:</span>
                  <span className="font-medium">{formatCents(quote.avgPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fee:</span>
                  <span>{formatKas(quote.fee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price impact:</span>
                  <span className={quote.priceImpact > 5 ? 'text-warning' : ''}>
                    {quote.priceImpact.toFixed(2)}%
                  </span>
                </div>
                <hr className="border-border" />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New probability:</span>
                  <span className="font-medium">{formatProbability(quote.newPriceYes)} YES</span>
                </div>
              </div>
            )}

            {quoteLoading && numAmount > 0 && (
              <div className="text-center text-sm text-muted-foreground">
                Loading quote...
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {success && (
              <div className="text-sm text-success bg-success/10 rounded-lg px-3 py-2">
                {success}
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              variant={side === 'YES' ? 'success' : 'danger'}
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={!isConnected || numAmount <= 0 || isSubmitting}
            >
              {!isConnected
                ? 'Connect Wallet'
                : `${action} ${side}`}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
