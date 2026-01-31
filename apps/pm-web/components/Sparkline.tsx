'use client';

import type { PricePoint } from '@/lib/types';

interface SparklineProps {
  data: PricePoint[];
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({ data, width = 80, height = 30, className }: SparklineProps) {
  if (!data || data.length < 2) {
    return (
      <div
        className={className}
        style={{ width, height }}
      >
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
          <line
            x1="0"
            y1={height / 2}
            x2={width}
            y2={height / 2}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            className="text-muted"
          />
        </svg>
      </div>
    );
  }

  const prices = data.map((d) => d.price_yes);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 0.01;

  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = prices.map((price, index) => {
    const x = padding + (index / (prices.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((price - minPrice) / range) * chartHeight;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  // Determine trend color
  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const isUp = lastPrice >= firstPrice;
  const strokeColor = isUp ? 'var(--success)' : 'var(--destructive)';

  return (
    <div className={className} style={{ width, height }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
