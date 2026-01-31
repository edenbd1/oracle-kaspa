'use client';

import { MarketRow } from './MarketRow';
import type { Market } from '@/lib/types';

interface MarketsTableProps {
  markets: Market[];
  onTradeComplete?: () => void;
}

export function MarketsTable({ markets, onTradeComplete }: MarketsTableProps) {
  // Sort by threshold price descending
  const sortedMarkets = [...markets].sort((a, b) => b.threshold_price - a.threshold_price);

  if (markets.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No markets available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border text-left text-sm text-muted-foreground">
            <th className="px-4 py-3 font-medium">Market</th>
            <th className="px-4 py-3 font-medium">Probability</th>
            <th className="px-4 py-3 font-medium">Trend</th>
            <th className="px-4 py-3 font-medium text-right">Volume</th>
            <th className="px-4 py-3 font-medium">Trade</th>
          </tr>
        </thead>
        <tbody>
          {sortedMarkets.map((market) => (
            <MarketRow
              key={market.id}
              market={market}
              onTradeComplete={onTradeComplete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
