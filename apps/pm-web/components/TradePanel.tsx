'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardHeader, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';
import { useWallet } from '@/lib/hooks/useWallet';
import { useQuote } from '@/lib/hooks/useQuote';
import { executeTrade } from '@/lib/api';
import { sendKaspa, PLATFORM_ADDRESS } from '@/lib/wallet-providers';
import { formatKas, formatCents, formatProbability, classNames } from '@/lib/utils';
import type { Market, TradeSide, TradeAction } from '@/lib/types';

// Transaction state machine
type TxState = 'idle' | 'signing' | 'tx_pending' | 'tx_confirmed' | 'error';

// Slippage options as fractions (0.01 = 1%)
const SLIPPAGE_OPTIONS = [0.005, 0.01, 0.03, 0.05, 0.10]; // 0.5%, 1%, 3%, 5%, 10%

interface TradePanelProps {
  market: Market;
  onTradeComplete?: () => void;
}

export function TradePanel({ market, onTradeComplete }: TradePanelProps) {
  const { address, isConnected, balance, walletType, refreshWallet } = useWallet();
  const [side, setSide] = useState<TradeSide>('YES');
  const [action, setAction] = useState<TradeAction>('BUY');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txState, setTxState] = useState<TxState>('idle');
  const [pendingTxId, setPendingTxId] = useState<string | null>(null);
  const [maxSlippage, setMaxSlippage] = useState(0.05); // 5% default
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [warning, setWarning] = useState('');
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Check if transaction is confirmed via Kaspa API
  const checkTxConfirmed = async (txid: string): Promise<boolean> => {
    try {
      // Use testnet or mainnet API based on address prefix
      const isTestnet = address?.startsWith('kaspatest:');
      const apiBase = isTestnet
        ? 'https://api-tn10.kaspa.org'
        : 'https://api.kaspa.org';

      const response = await fetch(`${apiBase}/transactions/${txid}`);
      if (!response.ok) return false;

      const data = await response.json();
      // Transaction is confirmed if it has a block_time
      return !!data.block_time;
    } catch {
      return false;
    }
  };

  // Start polling for transaction confirmation
  const startTxPolling = (txid: string) => {
    setPendingTxId(txid);
    setTxState('tx_pending');

    // Clear any existing timers
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(async () => {
      const confirmed = await checkTxConfirmed(txid);
      if (confirmed) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setTxState('tx_confirmed');
        // Refresh wallet balance immediately
        refreshWallet();
        // Auto-reset to idle after 2s
        setTimeout(() => {
          setTxState('idle');
          setPendingTxId(null);
        }, 2000);
      }
    }, 2000);

    // Timeout after 30s
    timeoutRef.current = setTimeout(() => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setTxState('idle');
      setPendingTxId(null);
      setWarning('Transaction may still be processing. Check your wallet.');
    }, 30000);
  };

  const numAmount = parseFloat(amount) || 0;
  const { quote, isLoading: quoteLoading } = useQuote({
    marketId: market.id,
    side,
    action,
    amount: numAmount,
    enabled: isConnected && numAmount > 0,
  });

  const isNonCustodial = walletType === 'kastle' || walletType === 'kasware';
  const isDemo = walletType === 'demo';

  const handleSubmit = async () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet first');
      return;
    }

    if (numAmount <= 0) {
      setError('Please enter an amount');
      return;
    }

    // Block if tx is pending
    if (txState !== 'idle') {
      setError('Please wait for the current transaction to complete');
      return;
    }

    // For demo mode, check platform balance
    if (isDemo && action === 'BUY' && numAmount > balance) {
      setError('Insufficient balance');
      return;
    }

    // For non-custodial, check platform address is configured
    if (isNonCustodial && action === 'BUY' && !PLATFORM_ADDRESS) {
      setError('Platform address not configured. Set NEXT_PUBLIC_PLATFORM_ADDRESS in .env.local');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccess('');
    setWarning('');

    try {
      let txid: string | undefined;

      console.log('[TradePanel] Starting trade:', { isNonCustodial, action, walletType, numAmount });

      // Non-custodial: Send KAS via wallet for BUY orders
      if (isNonCustodial && action === 'BUY' && walletType) {
        setTxState('signing');

        // Create payload with trade info
        const payload = JSON.stringify({
          market: market.id,
          side,
          action: 'BUY',
        });

        console.log('[TradePanel] Sending KAS via wallet...');
        // Send KAS to platform address
        txid = await sendKaspa(walletType, PLATFORM_ADDRESS, numAmount, payload);
        console.log('[TradePanel] Transaction sent, txid:', txid);

        // Start polling for confirmation
        startTxPolling(txid);
      }

      console.log('[TradePanel] Calling executeTrade with txid:', txid);
      // Execute trade on backend
      const result = await executeTrade({
        marketId: market.id,
        address,
        side,
        action,
        ...(action === 'BUY' ? { kasAmount: numAmount } : { sharesAmount: numAmount }),
        txid, // Include txid for non-custodial verification
        maxSlippage, // Pass slippage tolerance
      });

      if (result.ok) {
        const shares = result.sharesFilled?.toFixed(2) || '?';
        const kas = (result.kasSpent || result.kasReceived || 0).toFixed(2);

        if (txid) {
          setSuccess(
            `${action === 'BUY' ? 'Bought' : 'Sold'} ${shares} ${side} shares for ${kas} KAS\nTx: ${txid}`
          );
        } else {
          setSuccess(
            action === 'BUY'
              ? `Bought ${shares} ${side} shares for ${kas} KAS`
              : `Sold ${shares} ${side} shares for ${kas} KAS`
          );
        }
        setAmount('');
        await refreshWallet();
        onTradeComplete?.();
      } else {
        setError(result.error || 'Trade failed');
        // Reset tx state on error (if not polling)
        if (!isNonCustodial || action !== 'BUY') {
          setTxState('idle');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trade failed');
      setTxState('error');
      // Auto-reset to idle after 3s on error
      setTimeout(() => setTxState('idle'), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isResolved = market.status === 'RESOLVED';

  // Check if slippage exceeds tolerance (quote.priceImpact is already a percentage like 5.0 for 5%)
  const slippageExceeded = quote && (quote.priceImpact / 100) > maxSlippage;

  // Can trade only when idle and not submitting
  const canTrade = txState === 'idle' && !isSubmitting && !slippageExceeded && numAmount > 0;

  const getButtonText = () => {
    if (!isConnected) return 'Connect Wallet';
    if (txState === 'signing') return 'Sign in Wallet...';
    if (txState === 'tx_pending') return 'Confirming...';
    if (txState === 'tx_confirmed') return '✓ Confirmed';
    if (txState === 'error') return 'Retry';
    if (slippageExceeded) return 'Slippage Too High';
    if (isNonCustodial && action === 'BUY') {
      return `${action} ${side} (Sign Tx)`;
    }
    return `${action} ${side}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Trade</h3>
          {isNonCustodial && (
            <Badge variant="success">Non-Custodial</Badge>
          )}
          {isDemo && (
            <Badge variant="warning">Demo Mode</Badge>
          )}
        </div>
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

            {/* Balance info */}
            {isConnected && action === 'BUY' && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {isDemo ? 'Platform Balance:' : 'Your Wallet Balance:'}
                </span>
                {isDemo ? (
                  <button
                    onClick={() => setAmount(balance.toFixed(2))}
                    className="text-primary hover:underline"
                  >
                    {formatKas(balance)}
                  </button>
                ) : balance === -1 ? (
                  <span className="text-muted-foreground">Check wallet</span>
                ) : (
                  <span className="font-medium">{formatKas(balance)}</span>
                )}
              </div>
            )}

            {/* Slippage selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Max slippage:</span>
              <div className="flex gap-1">
                {SLIPPAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setMaxSlippage(opt)}
                    className={classNames(
                      'px-2 py-1 text-xs rounded transition-colors',
                      maxSlippage === opt
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {(opt * 100).toFixed(1)}%
                  </button>
                ))}
              </div>
            </div>

            {/* Non-custodial info */}
            {isNonCustodial && action === 'BUY' && numAmount > 0 && (
              <div className="bg-primary/10 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 text-primary font-medium mb-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Non-Custodial Trade
                </div>
                <p className="text-muted-foreground">
                  Your wallet will prompt you to sign a transaction sending {numAmount} KAS to the platform.
                </p>
              </div>
            )}

            {/* SELL not supported for non-custodial yet */}
            {isNonCustodial && action === 'SELL' && (
              <div className="bg-warning/10 rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 text-warning font-medium mb-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Selling Coming Soon
                </div>
                <p className="text-muted-foreground">
                  Non-custodial selling requires server-side signing. Use demo mode to test sells.
                </p>
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
                  <span className="text-muted-foreground">Price after trade:</span>
                  <span className="font-medium">
                    {formatProbability(side === 'YES' ? quote.priceAfter : 1 - quote.priceAfter)} YES
                  </span>
                </div>
              </div>
            )}

            {quoteLoading && numAmount > 0 && (
              <div className="text-center text-sm text-muted-foreground">
                Loading quote...
              </div>
            )}

            {/* Slippage warning */}
            {slippageExceeded && quote && (
              <div className="bg-warning/10 border border-warning rounded-lg p-3 text-sm">
                <div className="flex items-center gap-2 text-warning font-medium mb-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  High Price Impact
                </div>
                <p className="text-muted-foreground">
                  Impact: {quote.priceImpact.toFixed(2)}% exceeds your {(maxSlippage * 100).toFixed(1)}% tolerance.
                  Increase your max slippage or reduce trade size.
                </p>
              </div>
            )}

            {/* Pending transaction badge */}
            {txState === 'tx_pending' && pendingTxId && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
                <span className="animate-pulse">⏳</span>
                <span>Transaction pending</span>
                <code className="text-[10px] font-mono">{pendingTxId.slice(0, 8)}...</code>
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {warning && (
              <div className="text-sm text-warning bg-warning/10 rounded-lg px-3 py-2">
                {warning}
              </div>
            )}

            {success && (
              <div className="text-sm text-success bg-success/10 rounded-lg px-3 py-2 whitespace-pre-line">
                {success}
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              variant={slippageExceeded ? 'warning' : side === 'YES' ? 'success' : 'danger'}
              onClick={handleSubmit}
              isLoading={isSubmitting || txState === 'signing' || txState === 'tx_pending'}
              disabled={
                !isConnected ||
                !canTrade ||
                (isNonCustodial && action === 'SELL')
              }
            >
              {getButtonText()}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
