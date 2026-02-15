'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { WalletModal } from './WalletModal';
import { useWallet } from '@/lib/hooks/useWallet';
import { useQuote } from '@/lib/hooks/useQuote';
import { executeTrade } from '@/lib/api';
import { sendKaspa, PLATFORM_ADDRESS } from '@/lib/wallet-providers';
import { formatKas, formatCents, formatProbability, classNames } from '@/lib/utils';
import type { Market, TradeSide, TradeAction } from '@/lib/types';

type TxState = 'idle' | 'signing' | 'processing' | 'confirmed' | 'error';

const QUICK_AMOUNTS = [5, 10, 25, 50];

interface TradePanelProps {
  market: Market;
  onTradeComplete?: () => void;
}

function TxLink({ txid, label }: { txid: string; label: string }) {
  // Extract txid from JSON object if needed
  let cleanTxid = txid;
  if (txid.startsWith('{')) {
    try {
      const parsed = JSON.parse(txid);
      cleanTxid = parsed.id || txid;
    } catch {
      // Not JSON
    }
  }
  const explorerUrl = `https://tn10.kaspa.stream/transactions/${cleanTxid}`;
  return (
    <a
      href={explorerUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline font-mono text-[10px]"
    >
      {label}: {cleanTxid.slice(0, 16)}...
    </a>
  );
}

export function TradePanel({ market, onTradeComplete }: TradePanelProps) {
  const { address, isConnected, balance, walletType, refreshWallet } = useWallet();
  const [side, setSide] = useState<TradeSide>('YES');
  const [action, setAction] = useState<TradeAction>('BUY');
  const [amount, setAmount] = useState('');
  const [txState, setTxState] = useState<TxState>('idle');
  const [paymentTxId, setPaymentTxId] = useState<string | null>(null);
  const [showPaymentLink, setShowPaymentLink] = useState(false);
  const [tokenTxId, setTokenTxId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  const numAmount = parseFloat(amount) || 0;
  const { quote, isLoading: quoteLoading } = useQuote({
    marketId: market.id,
    side,
    action,
    amount: numAmount,
    enabled: numAmount > 0,
  });

  const isNonCustodial = walletType === 'kastle' || walletType === 'kasware';
  const isDemo = walletType === 'demo';

  const callTradeApi = async (txid?: string, attempt = 1): Promise<boolean> => {
    try {
      const result = await executeTrade({
        marketId: market.id,
        address: address!,
        side,
        action,
        ...(action === 'BUY' ? { kasAmount: numAmount } : { sharesAmount: numAmount }),
        txid,
      });

      if (result.ok) {
        // Trade confirmed!
        setTxState('confirmed');
        const shares = result.sharesFilled?.toFixed(2) || '?';
        const kas = (result.kasSpent || result.kasReceived || 0).toFixed(2);
        setSuccessMsg(`${action === 'BUY' ? 'Bought' : 'Sold'} ${shares} ${side} for ${kas} KAS`);
        if (result.tokenMinted?.txid) {
          setTokenTxId(result.tokenMinted.txid);
        }
        setAmount('');
        await refreshWallet();
        onTradeComplete?.();
        // Reset after showing confirmation
        setTimeout(() => {
          setTxState('idle');
          setPaymentTxId(null);
          setShowPaymentLink(false);
          setTokenTxId(null);
          setSuccessMsg('');
        }, 5000);
        return true;
      } else {
        // API returned an error but not a crash
        setError(result.error || 'Trade failed');
        setTxState('error');
        setTimeout(() => setTxState('idle'), 3000);
        return false;
      }
    } catch (err) {
      // API crashed (500) — retry if we have a payment TX (KAS already sent)
      if (txid && attempt < 5) {
        // Retry after delay — the API might need time to process
        return new Promise((resolve) => {
          retryTimeoutRef.current = setTimeout(async () => {
            const ok = await callTradeApi(txid, attempt + 1);
            resolve(ok);
          }, attempt * 2000);
        });
      }
      // No txid or max retries — show error
      setError(err instanceof Error ? err.message : 'Trade failed');
      setTxState('error');
      setTimeout(() => setTxState('idle'), 3000);
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!isConnected || !address) { setError('Connect your wallet first'); return; }
    if (numAmount <= 0) { setError('Enter an amount'); return; }
    if (txState !== 'idle') return;
    if (isDemo && action === 'BUY' && numAmount > balance) { setError('Insufficient balance'); return; }
    if (isNonCustodial && action === 'BUY' && !PLATFORM_ADDRESS) { setError('Platform address not configured'); return; }

    setError('');
    setSuccessMsg('');
    setPaymentTxId(null);
    setShowPaymentLink(false);
    setTokenTxId(null);

    try {
      let txid: string | undefined;

      if (isNonCustodial && action === 'BUY' && walletType) {
        setTxState('signing');
        const payload = JSON.stringify({ market: market.id, side, action: 'BUY' });
        txid = await sendKaspa(walletType, PLATFORM_ADDRESS, numAmount, payload);
        setPaymentTxId(txid);
        // Delay showing the link so the explorer has time to index the tx
        setTimeout(() => setShowPaymentLink(true), 3000);
        setTxState('processing');
      } else {
        setTxState('processing');
      }

      await callTradeApi(txid);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Trade failed';
      if (msg.toLowerCase().includes('rejected')) {
        // User rejected in wallet — just go back to idle quietly
        setError('Transaction rejected');
        setTxState('idle');
        setTimeout(() => setError(''), 2000);
      } else {
        setError(msg);
        setTxState('error');
        setTimeout(() => setTxState('idle'), 3000);
      }
    }
  };

  const isResolved = market.status === 'RESOLVED';
  const canTrade = txState === 'idle' && numAmount > 0;
  const isWorking = txState === 'signing' || txState === 'processing';

  const getButtonText = () => {
    if (!isConnected) return 'Connect Wallet';
    if (txState === 'signing') return 'Sign in Wallet...';
    if (txState === 'processing') return 'Processing...';
    if (txState === 'confirmed') return 'Confirmed!';
    if (txState === 'error') return 'Retry';
    return `${action} ${side}`;
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Side toggle - full width tabs */}
      <div className="grid grid-cols-2">
        <button
          onClick={() => setSide('YES')}
          className={classNames(
            'py-4 text-sm font-semibold transition-all border-b-2',
            side === 'YES'
              ? 'text-yes border-yes bg-yes/5'
              : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/30'
          )}
        >
          YES {Math.round((market.price_yes ?? 0.5) * 100)}\u00a2
        </button>
        <button
          onClick={() => setSide('NO')}
          className={classNames(
            'py-4 text-sm font-semibold transition-all border-b-2',
            side === 'NO'
              ? 'text-no border-no bg-no/5'
              : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/30'
          )}
        >
          NO {Math.round((market.price_no ?? 0.5) * 100)}\u00a2
        </button>
      </div>

      <div className="p-5 space-y-4">
        {isResolved ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Market resolved. Trading closed.
          </div>
        ) : (
          <>
            {/* Buy/Sell toggle */}
            <div className="flex bg-muted/50 rounded-lg p-0.5">
              <button
                onClick={() => setAction('BUY')}
                className={classNames(
                  'flex-1 py-2 text-sm font-medium rounded-md transition-all',
                  action === 'BUY'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Buy
              </button>
              <button
                onClick={() => setAction('SELL')}
                className={classNames(
                  'flex-1 py-2 text-sm font-medium rounded-md transition-all',
                  action === 'SELL'
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Sell
              </button>
            </div>

            {/* Amount */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {action === 'BUY' ? 'Amount' : 'Shares'}
                </label>
                {isConnected && action === 'BUY' && (
                  <button
                    onClick={() => balance > 0 && setAmount(balance.toFixed(2))}
                    className="text-xs text-primary hover:underline"
                  >
                    {balance === -1 ? '' : `Balance: ${formatKas(balance, 'compact')}`}
                  </button>
                )}
              </div>
              <Input
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                suffix={action === 'BUY' ? 'KAS' : 'shares'}
              />
              {/* Quick amount buttons */}
              {action === 'BUY' && (
                <div className="flex gap-1.5 mt-2">
                  {QUICK_AMOUNTS.map((qa) => (
                    <button
                      key={qa}
                      onClick={() => setAmount(String(qa))}
                      className={classNames(
                        'flex-1 py-1.5 text-xs font-medium rounded-md transition-colors',
                        amount === String(qa)
                          ? 'bg-primary/15 text-primary border border-primary/30'
                          : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      {qa}
                    </button>
                  ))}
                </div>
              )}

              {/* To win */}
              {action === 'BUY' && quote && numAmount > 0 && txState === 'idle' && (
                <div className="mt-3 flex items-center justify-between px-4 py-3 rounded-xl bg-yes/5 border border-yes/15">
                  <span className="text-sm text-muted-foreground">To win</span>
                  <span className={classNames('text-lg font-bold', side === 'YES' ? 'text-yes' : 'text-no')}>
                    {formatKas(quote.shares, 'compact')}
                  </span>
                </div>
              )}
            </div>

            {/* Non-custodial sell warning */}
            {isNonCustodial && action === 'SELL' && (
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-xs text-warning">
                Non-custodial selling coming soon. Use demo mode to test.
              </div>
            )}

            {/* Quote preview */}
            {quote && txState === 'idle' && (
              <div className="rounded-xl border border-border divide-y divide-border text-sm overflow-hidden">
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">You {action === 'BUY' ? 'get' : 'sell'}</span>
                  <span className="font-semibold">{quote.shares.toFixed(2)} {side}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Avg price</span>
                  <span className="font-medium font-mono">{formatCents(quote.avgPrice)}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Fee</span>
                  <span className="font-mono">{formatKas(quote.fee, 'compact')}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Impact</span>
                  <span className={classNames('font-mono', quote.priceImpact > 5 ? 'text-warning font-semibold' : '')}>
                    {quote.priceImpact.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between px-4 py-2.5 bg-muted/20">
                  <span className="text-muted-foreground">After</span>
                  <span className="font-semibold">
                    {formatProbability(side === 'YES' ? quote.priceAfter : 1 - quote.priceAfter)} YES
                  </span>
                </div>
              </div>
            )}

            {quoteLoading && numAmount > 0 && txState === 'idle' && (
              <div className="text-center text-xs text-muted-foreground py-2">
                Fetching quote...
              </div>
            )}

            {/* Processing state */}
            {txState === 'processing' && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium text-foreground">Processing trade...</span>
                </div>
                {paymentTxId && showPaymentLink && (
                  <div className="pl-6">
                    <TxLink txid={paymentTxId} label="Payment TX" />
                  </div>
                )}
              </div>
            )}

            {/* Signing state */}
            {txState === 'signing' && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium text-foreground">Approve in your wallet...</span>
                </div>
              </div>
            )}

            {/* Confirmed state */}
            {txState === 'confirmed' && (
              <div className="bg-yes/5 border border-yes/20 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-yes" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-yes">{successMsg}</span>
                </div>
                {paymentTxId && showPaymentLink && (
                  <div className="pl-6">
                    <TxLink txid={paymentTxId} label="Payment TX" />
                  </div>
                )}
                {tokenTxId && (
                  <div className="pl-6">
                    <TxLink txid={tokenTxId} label="Token TX" />
                  </div>
                )}
              </div>
            )}

            {/* Error (only for real errors, not in-flight) */}
            {error && txState !== 'processing' && txState !== 'signing' && (
              <div className="text-xs text-no bg-no/10 rounded-lg px-3 py-2.5">
                {error}
              </div>
            )}

            {/* Submit */}
            {!isConnected ? (
              <Button
                className="w-full"
                size="lg"
                variant={side === 'YES' ? 'success' : 'danger'}
                onClick={() => setShowWalletModal(true)}
              >
                Connect Wallet
              </Button>
            ) : (
              <Button
                className={classNames(
                  'w-full',
                  canTrade && side === 'YES' && 'glow-yes',
                  canTrade && side === 'NO' && 'glow-no'
                )}
                size="lg"
                variant={side === 'YES' ? 'success' : 'danger'}
                onClick={handleSubmit}
                isLoading={isWorking}
                disabled={!canTrade || (isNonCustodial && action === 'SELL')}
              >
                {getButtonText()}
              </Button>
            )}

            {/* Wallet badge */}
            {isConnected && (
              <div className="text-center">
                <span className="text-[10px] text-muted-foreground">
                  {isNonCustodial ? 'Non-custodial' : 'Demo mode'}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <WalletModal isOpen={showWalletModal} onClose={() => setShowWalletModal(false)} />
    </div>
  );
}
