'use client';

import Link from 'next/link';
import { Sparkline } from './Sparkline';
import { Badge } from './ui/Badge';
import { formatPrice, formatKas } from '@/lib/utils';
import type { Market } from '@/lib/types';

interface MarketCardProps {
  market: Market;
}

export function MarketCard({ market }: MarketCardProps) {
  const priceYes = market.price_yes ?? 0.5;
  const priceNo = market.price_no ?? 0.5;
  const yesPercent = Math.round(priceYes * 100);
  const noPercent = Math.round(priceNo * 100);

  const isResolved = market.status === 'RESOLVED';
  const direction = market.direction === '>=' ? '\u2265' : '\u2264';

  return (
    <Link href={`/pm/market/${market.id}`} className="block group">
      <div className="bg-card border border-border rounded-xl overflow-hidden card-interactive">
        {/* Header with gradient */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="font-semibold text-foreground text-base leading-tight mb-1">
                BTC {direction} {formatPrice(market.threshold_price)}
              </h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>Vol {formatKas(market.volume, 'compact')}</span>
                <span>{market.trades_count} trades</span>
              </div>
            </div>
            <div className="flex-shrink-0 ml-3">
              {isResolved ? (
                <Badge variant={market.resolved_outcome === 'YES' ? 'success' : 'danger'}>
                  {market.resolved_outcome}
                </Badge>
              ) : (
                <Sparkline data={market.price_history || []} width={64} height={28} />
              )}
            </div>
          </div>

          {/* Big probability */}
          <div className="flex items-end justify-between mb-4">
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                YES
              </div>
              <div className="text-4xl font-bold text-yes tracking-tight leading-none">
                {yesPercent}<span className="text-lg text-yes/60">%</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                NO
              </div>
              <div className="text-2xl font-bold text-no/80 tracking-tight leading-none">
                {noPercent}<span className="text-sm text-no/40">%</span>
              </div>
            </div>
          </div>

          {/* Probability bar */}
          <div className="h-1.5 rounded-full overflow-hidden flex">
            <div
              className="h-full rounded-l-full bg-yes transition-all duration-500 ease-out"
              style={{ width: `${Math.max(yesPercent, 3)}%` }}
            />
            <div
              className="h-full rounded-r-full bg-no transition-all duration-500 ease-out"
              style={{ width: `${Math.max(noPercent, 3)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
