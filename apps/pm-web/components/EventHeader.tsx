'use client';

import { useEffect, useState } from 'react';
import { formatCountdown } from '@/lib/utils';
import type { Event } from '@/lib/types';

interface EventHeaderProps {
  event: Event;
}

export function EventHeader({ event }: EventHeaderProps) {
  const [timeRemaining, setTimeRemaining] = useState(event.time_remaining_ms || 0);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, event.deadline - Date.now());
      setTimeRemaining(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [event.deadline]);

  const isExpired = timeRemaining <= 0;

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold text-foreground">{event.title}</h1>
      {event.description && (
        <p className="text-muted-foreground">{event.description}</p>
      )}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {isExpired ? (
            <span className="text-destructive font-medium">Deadline passed</span>
          ) : (
            <span className="text-foreground">
              <span className="text-muted-foreground">Deadline: </span>
              <span className="font-medium">{formatCountdown(timeRemaining)} remaining</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
