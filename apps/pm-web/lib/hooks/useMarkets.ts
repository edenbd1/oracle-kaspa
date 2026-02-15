'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchEvents, fetchEvent, fetchMarket } from '../api';
import type { EventsResponse, EventDetailResponse, MarketDetailResponse } from '../types';

const MAX_RETRIES = 4;
const RETRY_DELAYS = [1000, 2000, 3000, 5000]; // backoff delays

async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  retries: number = MAX_RETRIES
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt] || 3000));
    }
  }
  throw new Error('Unreachable');
}

export function useEvents(pollInterval: number = 3000) {
  const [data, setData] = useState<EventsResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const failCountRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const result = data
        ? await fetchEvents() // already have data, single attempt is fine
        : await fetchWithRetry(fetchEvents); // first load, retry aggressively
      setData(result);
      setError(null);
      failCountRef.current = 0;
    } catch (err) {
      failCountRef.current++;
      // Only show error if we have no data AND multiple consecutive failures
      if (!data && failCountRef.current >= 2) {
        setError(err instanceof Error ? err : new Error('Failed to fetch events'));
      }
      // If we have stale data, silently keep it
    } finally {
      setIsLoading(false);
    }
  }, [data]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, pollInterval);
    return () => clearInterval(interval);
  }, [refresh, pollInterval]);

  return { data, error, isLoading, refresh };
}

export function useEvent(eventId: string, pollInterval: number = 3000) {
  const [data, setData] = useState<EventDetailResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const failCountRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!eventId) return;
    try {
      const result = data
        ? await fetchEvent(eventId)
        : await fetchWithRetry(() => fetchEvent(eventId));
      setData(result);
      setError(null);
      failCountRef.current = 0;
    } catch (err) {
      failCountRef.current++;
      if (!data && failCountRef.current >= 2) {
        setError(err instanceof Error ? err : new Error('Failed to fetch event'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [eventId, data]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, pollInterval);
    return () => clearInterval(interval);
  }, [refresh, pollInterval]);

  return { data, error, isLoading, refresh };
}

export function useMarket(marketId: string, pollInterval: number = 2000) {
  const [data, setData] = useState<MarketDetailResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const failCountRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!marketId) return;
    try {
      const result = data
        ? await fetchMarket(marketId)
        : await fetchWithRetry(() => fetchMarket(marketId));
      setData(result);
      setError(null);
      failCountRef.current = 0;
    } catch (err) {
      failCountRef.current++;
      if (!data && failCountRef.current >= 2) {
        setError(err instanceof Error ? err : new Error('Failed to fetch market'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [marketId, data]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, pollInterval);
    return () => clearInterval(interval);
  }, [refresh, pollInterval]);

  return { data, error, isLoading, refresh };
}
