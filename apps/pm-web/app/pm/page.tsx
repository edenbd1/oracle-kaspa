'use client';

import { useEffect, useState } from 'react';
import { useEvents, useEvent } from '@/lib/hooks/useMarkets';
import { MarketCard } from '@/components/MarketCard';
import { ThresholdLogo } from '@/components/ThresholdLogo';
import { formatPrice, formatCountdown, formatKas } from '@/lib/utils';
import type { Market, Event } from '@/lib/types';

function LoadingSkeleton() {
  return (
    <div className="space-y-8 animate-slide-in">
      {/* Hero skeleton */}
      <div className="animate-pulse">
        <div className="h-6 bg-muted rounded-lg w-32 mb-3" />
        <div className="h-12 bg-muted rounded-lg w-56 mb-4" />
        <div className="flex gap-6">
          <div className="h-4 bg-muted rounded w-24" />
          <div className="h-4 bg-muted rounded w-24" />
          <div className="h-4 bg-muted rounded w-24" />
        </div>
      </div>
      {/* Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-52 bg-card border border-border rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-slide-in">
      <div className="w-14 h-14 rounded-2xl bg-no/10 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-no" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <p className="text-foreground font-semibold mb-1">Failed to load markets</p>
      <p className="text-muted-foreground text-sm text-center max-w-sm">{message}</p>
      <p className="text-muted-foreground text-xs mt-3">
        Make sure the PM API is running on port 3001
      </p>
    </div>
  );
}

function HeroSection({ syncedAt, totalMarkets }: {
  syncedAt: number | null;
  totalMarkets: number;
}) {
  const lagSeconds = syncedAt ? Math.floor((Date.now() - syncedAt) / 1000) : null;
  const isLive = lagSeconds !== null && lagSeconds < 120;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-2">
        <ThresholdLogo size={20} className="text-primary" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Binary Markets on Kaspa
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
        <span>{totalMarkets} markets</span>
        <span className="text-border-light">|</span>
        <span className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-yes animate-live-pulse' : 'bg-muted-foreground'}`} />
          {isLive ? 'Oracle Live' : 'Oracle Offline'}
        </span>
      </div>
    </div>
  );
}

function EventSection({ eventSummary, oraclePrices }: {
  eventSummary: Event;
  oraclePrices: Record<string, number>;
}) {
  const { data: eventData } = useEvent(eventSummary.id, 15000);

  const markets = eventData?.markets || [];
  const sortedMarkets = [...markets].sort((a, b) => b.threshold_price - a.threshold_price);
  const asset = eventSummary.asset;
  const assetPrice = oraclePrices[asset];

  const [timeRemaining, setTimeRemaining] = useState(
    Math.max(0, eventSummary.deadline - Date.now())
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(Math.max(0, eventSummary.deadline - Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [eventSummary.deadline]);

  const totalVolume = markets.reduce((sum: number, m: Market) => sum + (m.volume || 0), 0);

  return (
    <div className="mb-10">
      {/* Event header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-bold text-foreground">{eventSummary.title}</h2>
            {assetPrice != null && (
              <span className="text-lg font-semibold text-primary">{formatPrice(assetPrice)}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {timeRemaining > 0
                ? <>{formatCountdown(timeRemaining)} left</>
                : <span className="text-no">Deadline passed</span>
              }
            </span>
            <span>{markets.length} markets</span>
            <span>{formatKas(totalVolume, 'compact')} vol</span>
          </div>
        </div>
      </div>

      {/* Markets grid */}
      {sortedMarkets.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-52 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedMarkets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PmPage() {
  const { data: eventsData, error: eventsError, isLoading: eventsLoading } = useEvents(15000);

  const isLoading = eventsLoading && !eventsData;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (eventsError) {
    return <ErrorState message={eventsError.message} />;
  }

  if (!eventsData?.events?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-slide-in">
        <ThresholdLogo size={48} className="text-muted-foreground mb-4" />
        <p className="text-foreground font-semibold mb-2">No events yet</p>
        <p className="text-muted-foreground text-sm">
          Run <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">npm run pm:seed</code> to create markets
        </p>
      </div>
    );
  }

  const oraclePrices = eventsData.oracle_prices || {};
  const totalMarkets = eventsData.events.reduce((sum, e) => sum + (e.market_count || 0), 0);

  return (
    <div className="animate-slide-in">
      <HeroSection
        syncedAt={eventsData.oracle_synced_at}
        totalMarkets={totalMarkets}
      />
      {eventsData.events.map((event) => (
        <EventSection
          key={event.id}
          eventSummary={event}
          oraclePrices={oraclePrices}
        />
      ))}
    </div>
  );
}
