'use client';

import { useEvents, useEvent } from '@/lib/hooks/useMarkets';
import { OracleBanner } from '@/components/OracleBanner';
import { EventHeader } from '@/components/EventHeader';
import { MarketsTable } from '@/components/MarketsTable';
import { Card, CardContent } from '@/components/ui/Card';

function LoadingState() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 bg-muted rounded w-1/3" />
      <div className="h-6 bg-muted rounded w-1/2" />
      <div className="h-64 bg-muted rounded" />
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <div className="text-destructive mb-2">Error loading data</div>
        <div className="text-muted-foreground text-sm">{message}</div>
        <div className="mt-4 text-sm text-muted-foreground">
          Make sure the PM API is running on port 3001
        </div>
      </CardContent>
    </Card>
  );
}

export default function PmPage() {
  const { data: eventsData, error: eventsError, isLoading: eventsLoading } = useEvents();

  // Get the first event to display (there's usually just one)
  const eventId = eventsData?.events?.[0]?.id;
  const { data: eventData, error: eventError, isLoading: eventLoading, refresh } = useEvent(
    eventId || '',
    3000
  );

  const isLoading = eventsLoading || (eventId && eventLoading);
  const error = eventsError || eventError;

  if (isLoading && !eventsData) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  if (!eventsData?.events?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="text-muted-foreground mb-2">No events found</div>
          <div className="text-sm text-muted-foreground">
            Run <code className="bg-muted px-1 rounded">npm run pm:seed</code> to create test markets
          </div>
        </CardContent>
      </Card>
    );
  }

  const event = eventData?.event || eventsData.events[0];
  const markets = eventData?.markets || [];
  const oraclePrice = eventData?.oracle_price || eventsData.oracle_price;
  const oracleSyncedAt = eventData?.oracle_synced_at || eventsData.oracle_synced_at;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <OracleBanner price={oraclePrice} syncedAt={oracleSyncedAt} />
      </div>

      <Card>
        <div className="px-6 py-4 border-b border-border">
          <EventHeader event={event} />
        </div>
        <MarketsTable markets={markets} onTradeComplete={refresh} />
      </Card>
    </div>
  );
}
