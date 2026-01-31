'use client';

import { formatPrice, formatTimeAgo } from '@/lib/utils';

interface OracleBannerProps {
  price: number;
  syncedAt: number | null;
}

export function OracleBanner({ price, syncedAt }: OracleBannerProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 rounded-lg border border-warning/20">
        <div className="w-2 h-2 bg-warning rounded-full animate-pulse" />
        <span className="text-warning font-medium">BTC</span>
        <span className="text-foreground font-bold">{formatPrice(price)}</span>
      </div>
      {syncedAt && (
        <span className="text-muted-foreground text-xs">
          Updated {formatTimeAgo(syncedAt)}
        </span>
      )}
    </div>
  );
}
