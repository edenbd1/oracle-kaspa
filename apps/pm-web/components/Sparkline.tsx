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

  // Fill area
  const firstX = padding;
  const lastX = padding + chartWidth;
  const areaD = `${pathD} L ${lastX},${height} L ${firstX},${height} Z`;

  const firstPrice = prices[0];
  const lastPrice = prices[prices.length - 1];
  const isUp = lastPrice >= firstPrice;
  const strokeColor = isUp ? 'var(--yes)' : 'var(--no)';
  const fillColor = isUp ? 'var(--yes)' : 'var(--no)';

  return (
    <div className={className} style={{ width, height }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        <defs>
          <linearGradient id={`sparkFill-${isUp ? 'up' : 'down'}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillColor} stopOpacity="0.15" />
            <stop offset="100%" stopColor={fillColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#sparkFill-${isUp ? 'up' : 'down'})`} />
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
