'use client';

import type { PricePoint } from '@/lib/types';
import { formatTimeAgo } from '@/lib/utils';

interface ProbabilityChartProps {
  data: PricePoint[];
  height?: number;
}

export function ProbabilityChart({ data, height = 200 }: ProbabilityChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-muted/30 rounded-lg text-muted-foreground"
        style={{ height }}
      >
        No price history available
      </div>
    );
  }

  const width = 600;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const prices = data.map((d) => d.price_yes);
  const minPrice = Math.max(0, Math.min(...prices) - 0.05);
  const maxPrice = Math.min(1, Math.max(...prices) + 0.05);
  const range = maxPrice - minPrice || 0.1;

  const points = data.map((point, index) => {
    const x = padding.left + (index / (data.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((point.price_yes - minPrice) / range) * chartHeight;
    return { x, y, point };
  });

  const pathD = `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`;

  // Create area path
  const areaD = `${pathD} L ${points[points.length - 1].x},${padding.top + chartHeight} L ${points[0].x},${padding.top + chartHeight} Z`;

  // Y-axis labels
  const yLabels = [0, 0.25, 0.5, 0.75, 1].filter(
    (v) => v >= minPrice && v <= maxPrice
  );

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {yLabels.map((value) => {
          const y = padding.top + chartHeight - ((value - minPrice) / range) * chartHeight;
          return (
            <g key={value}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--muted-foreground)"
                fontSize="12"
              >
                {Math.round(value * 100)}%
              </text>
            </g>
          );
        })}

        {/* 50% reference line */}
        {minPrice < 0.5 && maxPrice > 0.5 && (
          <line
            x1={padding.left}
            y1={padding.top + chartHeight - ((0.5 - minPrice) / range) * chartHeight}
            x2={width - padding.right}
            y2={padding.top + chartHeight - ((0.5 - minPrice) / range) * chartHeight}
            stroke="var(--muted)"
            strokeWidth="2"
          />
        )}

        {/* Area fill */}
        <path d={areaD} fill="var(--success)" opacity="0.1" />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke="var(--success)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Current price dot */}
        {points.length > 0 && (
          <circle
            cx={points[points.length - 1].x}
            cy={points[points.length - 1].y}
            r="4"
            fill="var(--success)"
          />
        )}

        {/* X-axis labels */}
        {data.length > 1 && (
          <>
            <text
              x={padding.left}
              y={height - 8}
              textAnchor="start"
              fill="var(--muted-foreground)"
              fontSize="11"
            >
              {formatTimeAgo(data[0].timestamp)}
            </text>
            <text
              x={width - padding.right}
              y={height - 8}
              textAnchor="end"
              fill="var(--muted-foreground)"
              fontSize="11"
            >
              Now
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
