'use client';

import Link from 'next/link';
import { useMarket } from '@/lib/hooks/useMarkets';
import { TradePanel } from '@/components/TradePanel';
import { Badge } from '@/components/ui/Badge';
import { formatPrice, formatKas, formatProbability, formatTimeAgo } from '@/lib/utils';
import type { Trade } from '@/lib/types';

function LoadingState() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-5 bg-muted rounded w-24" />
      <div className="h-10 bg-muted rounded w-72" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        <div className="h-80 bg-card border border-border rounded-xl" />
        <div className="h-96 bg-card border border-border rounded-xl" />
      </div>
    </div>
  );
}

function RecentTradesTable({ trades }: { trades: Trade[] }) {
  if (!trades.length) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No trades yet. Be the first!
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {trades.slice(0, 10).map((trade) => (
        <div key={trade.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3">
            <div className={`w-1.5 h-1.5 rounded-full ${trade.side.includes('YES') ? 'bg-yes' : 'bg-no'}`} />
            <span className={`text-sm font-semibold ${trade.side.includes('YES') ? 'text-yes' : 'text-no'}`}>
              {trade.side.replace('BUY_', '').replace('SELL_', '')}
            </span>
            <span className="text-sm text-muted-foreground">
              {trade.amount_tokens.toFixed(1)} shares
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium font-mono">{formatProbability(trade.price)}</span>
            <span className="text-xs text-muted-foreground">{formatTimeAgo(trade.created_at)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatItem({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-sm font-semibold ${valueClass || ''}`}>{value}</div>
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
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-foreground font-semibold mb-2">Market not found</p>
        <p className="text-muted-foreground text-sm mb-4">
          {error?.message || 'This market does not exist'}
        </p>
        <Link href="/pm" className="text-primary text-sm hover:underline">
          Back to markets
        </Link>
      </div>
    );
  }

  const { market, event, recent_trades } = data;
  const direction = market.direction === '>=' ? '\u2265' : '\u2264';
  const priceYes = market.price_yes ?? 0.5;
  const priceNo = market.price_no ?? 0.5;
  const yesPercent = Math.round(priceYes * 100);
  const noPercent = Math.round(priceNo * 100);

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Breadcrumb + header */}
      <div>
        <Link href="/pm" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Markets
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {market.label || `${market.asset || 'BTC'} ${direction} ${formatPrice(market.threshold_price)}`}
            </h1>
            {event && (
              <p className="text-sm text-muted-foreground mt-1">{event.title}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {market.status === 'RESOLVED' ? (
              <Badge variant={market.resolved_outcome === 'YES' ? 'success' : 'danger'}>
                Resolved: {market.resolved_outcome}
              </Badge>
            ) : (
              <Badge variant="default">Open</Badge>
            )}
          </div>
        </div>

        {/* Big probability display */}
        <div className="flex items-center gap-6 mt-5">
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">YES</div>
            <div className="text-lg font-bold text-yes">{yesPercent}%</div>
          </div>
          <div className="flex-1 h-3 rounded-full overflow-hidden flex">
            <div
              className="h-full bg-yes rounded-l-full transition-all duration-500"
              style={{ width: `${yesPercent}%` }}
            />
            <div
              className="h-full bg-no rounded-r-full transition-all duration-500"
              style={{ width: `${noPercent}%` }}
            />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground text-right uppercase tracking-wider">NO</div>
            <div className="text-lg font-bold text-no">{noPercent}%</div>
          </div>
        </div>
      </div>

      {/* Main grid: content left, trade panel right */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Left: chart + info + trades */}
        <div className="space-y-4">
          {/* Stats grid */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Market Info</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
              <StatItem label="Volume" value={formatKas(market.volume, 'compact')} />
              <StatItem label="Trades" value={String(market.trades_count)} />
              <StatItem label="Fee" value={`${(market.fee_bps / 100).toFixed(1)}%`} />
              <StatItem label="Liquidity" value={`b=${market.liquidity_b}`} />
              {market.yes_token_ticker && (
                <StatItem label="YES Token" value={market.yes_token_ticker} valueClass="text-yes font-mono text-xs" />
              )}
              {market.no_token_ticker && (
                <StatItem label="NO Token" value={market.no_token_ticker} valueClass="text-no font-mono text-xs" />
              )}
              <StatItem label="YES Supply" value={market.q_yes.toFixed(1)} />
              <StatItem label="NO Supply" value={market.q_no.toFixed(1)} />
            </div>

            {market.status === 'RESOLVED' && market.resolved_price && (
              <div className="mt-5 pt-5 border-t border-border grid grid-cols-2 gap-4">
                <StatItem label="Resolved at Price" value={formatPrice(market.resolved_price)} />
                {market.resolved_txid && (
                  <div>
                    <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Resolution TX</div>
                    <div className="text-xs font-mono text-primary truncate">
                      {market.resolved_txid}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent trades */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Trades</h2>
            <RecentTradesTable trades={recent_trades} />
          </div>
        </div>

        {/* Right: trade panel (sticky sidebar) */}
        <div className="lg:self-start">
          <div className="sticky top-20">
            <TradePanel market={market} onTradeComplete={refresh} />
          </div>
        </div>
      </div>
    </div>
  );
}
