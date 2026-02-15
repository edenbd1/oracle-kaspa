'use client';

import { useEvents } from '@/lib/hooks/useMarkets';
import { formatPrice } from '@/lib/utils';

export function PriceTicker() {
  const { data } = useEvents(15000);
  const prices = data?.oracle_prices || {};

  const assets = [
    { symbol: 'BTC', name: 'Bitcoin' },
    { symbol: 'ETH', name: 'Ethereum' },
    { symbol: 'KAS', name: 'Kaspa' },
  ];

  const items = assets
    .filter((a) => prices[a.symbol] != null)
    .map((a) => ({ ...a, price: prices[a.symbol] }));

  if (items.length === 0) return null;

  // Repeat enough times to always fill the viewport during scroll
  const repeated = Array(10).fill(items).flat();

  return (
    <div className="w-full bg-[#06070a] border-b border-border overflow-hidden">
      <div className="ticker-track flex items-center h-8 whitespace-nowrap">
        {repeated.map((item, i) => (
          <span key={`${item.symbol}-${i}`} className="inline-flex items-center gap-2 px-6 text-xs">
            <span className="font-semibold text-muted-foreground">{item.symbol}</span>
            <span className="font-bold text-foreground">{formatPrice(item.price)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
