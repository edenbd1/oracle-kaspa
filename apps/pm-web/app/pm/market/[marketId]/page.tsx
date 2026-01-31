'use client';

import Link from 'next/link';
import { useMarket } from '@/lib/hooks/useMarkets';
import { ProbabilityChart } from '@/components/ProbabilityChart';
import { TradePanel } from '@/components/TradePanel';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatPrice, formatKas, formatProbability, formatTimeAgo } from '@/lib/utils';
import type { Trade } from '@/lib/types';

function LoadingState() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-1/4" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-64 bg-muted rounded" />
        <div className="h-96 bg-muted rounded" />
      </div>
    </div>
  );
}

function RecentTradesTable({ trades }: { trades: Trade[] }) {
  if (!trades.length) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No trades yet
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="pb-2 font-medium">Type</th>
            <th className="pb-2 font-medium">Shares</th>
            <th className="pb-2 font-medium">Price</th>
            <th className="pb-2 font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id} className="border-b border-border/50">
              <td className="py-2">
                <span
                  className={
                    trade.side.includes('YES')
                      ? 'text-success'
                      : 'text-destructive'
                  }
                >
                  {trade.side.replace('_', ' ')}
                </span>
              </td>
              <td className="py-2">{trade.amount_tokens.toFixed(2)}</td>
              <td className="py-2">{formatProbability(trade.price)}</td>
              <td className="py-2 text-muted-foreground">
                {formatTimeAgo(trade.created_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MarketPage({
  params,
}: {
  params: { marketId: string };
}) {
  const { marketId } = params;
  const { data, error, isLoading, refresh } = useMarket(marketId);

  if (isLoading && !data) {
    return <LoadingState />;
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="text-destructive mb-2">Error loading market</div>
          <div className="text-muted-foreground text-sm">
            {error?.message || 'Market not found'}
          </div>
          <Link
            href="/pm"
            className="inline-block mt-4 text-primary hover:underline"
          >
            Back to markets
          </Link>
        </CardContent>
      </Card>
    );
  }

  const { market, event, price_history, recent_trades } = data;
  const direction = market.direction === '>=' ? '≥' : '≤';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/pm"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">
            BTC {direction} {formatPrice(market.threshold_price)}
          </h1>
          {event && (
            <p className="text-sm text-muted-foreground">{event.title}</p>
          )}
        </div>
        <Badge
          variant={market.status === 'RESOLVED' ? 'success' : 'default'}
        >
          {market.status}
        </Badge>
        {market.status === 'RESOLVED' && market.resolved_outcome && (
          <Badge
            variant={market.resolved_outcome === 'YES' ? 'success' : 'danger'}
          >
            {market.resolved_outcome}
          </Badge>
        )}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Chart and info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Probability chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Probability</h2>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-success" />
                    <span>YES {formatProbability(market.price_yes ?? 0.5)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-destructive" />
                    <span>NO {formatProbability(market.price_no ?? 0.5)}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ProbabilityChart data={price_history} height={250} />
            </CardContent>
          </Card>

          {/* Token info */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Token Info</h2>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">YES Token</div>
                  <div className="font-mono text-success">
                    {market.yes_token_ticker || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">NO Token</div>
                  <div className="font-mono text-destructive">
                    {market.no_token_ticker || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">YES Supply</div>
                  <div>{market.q_yes.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">NO Supply</div>
                  <div>{market.q_no.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Volume</div>
                  <div>{formatKas(market.volume)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Total Trades</div>
                  <div>{market.trades_count}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Fee</div>
                  <div>{(market.fee_bps / 100).toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">Liquidity (b)</div>
                  <div>{market.liquidity_b}</div>
                </div>
              </div>

              {market.status === 'RESOLVED' && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-muted-foreground mb-1">Resolved Price</div>
                  <div className="font-medium">
                    {market.resolved_price
                      ? formatPrice(market.resolved_price)
                      : 'N/A'}
                  </div>
                  {market.resolved_txid && (
                    <div className="mt-2">
                      <div className="text-muted-foreground mb-1">Resolution TXID</div>
                      <div className="font-mono text-xs break-all">
                        {market.resolved_txid}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent trades */}
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Recent Trades</h2>
            </CardHeader>
            <CardContent>
              <RecentTradesTable trades={recent_trades} />
            </CardContent>
          </Card>
        </div>

        {/* Right column - Trade panel */}
        <div>
          <div className="sticky top-24">
            <TradePanel market={market} onTradeComplete={refresh} />
          </div>
        </div>
      </div>
    </div>
  );
}
