'use client';

import { useEvents } from '@/lib/hooks/useMarkets';
import { formatPrice } from '@/lib/utils';

const ASSET_CONFIG = {
  BTC: { color: '#f7931a', bg: 'rgba(247,147,26,0.08)', glyph: '₿' },
  ETH: { color: '#627eea', bg: 'rgba(98,126,234,0.08)',  glyph: 'Ξ' },
  KAS: { color: '#49deb1', bg: 'rgba(73,222,177,0.08)',  glyph: '◆' },
} as const;

export function PriceTicker() {
  const { data } = useEvents(15000);
  const prices = data?.oracle_prices || {};

  const items = (Object.keys(ASSET_CONFIG) as Array<keyof typeof ASSET_CONFIG>)
    .filter((s) => prices[s] != null)
    .map((s) => ({ symbol: s, price: prices[s], ...ASSET_CONFIG[s] }));

  if (items.length === 0) return null;

  const repeated = Array(12).fill(items).flat();

  return (
    <div className="relative w-full overflow-hidden border-b border-border"
         style={{ background: '#06070a', height: '36px' }}>

      {/* Fade left */}
      <div className="absolute inset-y-0 left-0 w-20 z-10 pointer-events-none"
           style={{ background: 'linear-gradient(to right, #06070a 40%, transparent)' }} />

      {/* Fade right */}
      <div className="absolute inset-y-0 right-0 w-20 z-10 pointer-events-none"
           style={{ background: 'linear-gradient(to left, #06070a 40%, transparent)' }} />

      {/* Scrolling track */}
      <div className="ticker-track flex items-center h-full whitespace-nowrap">
        {repeated.map((item, i) => (
          <span key={`${item.symbol}-${i}`} className="inline-flex items-center">

            {/* Separator */}
            <span className="mx-4 text-[10px]" style={{ color: '#2a2d38' }}>✦</span>

            {/* Pill */}
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5"
                  style={{ background: item.bg }}>

              {/* Glyph */}
              <span className="text-[10px] font-bold leading-none"
                    style={{ color: item.color }}>
                {item.glyph}
              </span>

              {/* Symbol */}
              <span className="text-[10px] font-semibold tracking-widest uppercase"
                    style={{ color: item.color, opacity: 0.85 }}>
                {item.symbol}
              </span>

              {/* Price */}
              <span className="text-[11px] font-mono font-bold tabular-nums"
                    style={{ color: '#e8eaed' }}>
                {formatPrice(item.price)}
              </span>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
