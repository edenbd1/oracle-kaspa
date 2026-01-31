'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchEvents, fetchEvent, fetchMarket } from '../api';
import type { EventsResponse, EventDetailResponse, MarketDetailResponse } from '../types';

export function useEvents(pollInterval: number = 3000) {
  const [data, setData] = useState<EventsResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchEvents();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch events'));
    } finally {
      setIsLoading(false);
    }
  }, []);

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

  const refresh = useCallback(async () => {
    try {
      const result = await fetchEvent(eventId);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch event'));
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

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

  const refresh = useCallback(async () => {
    try {
      const result = await fetchMarket(marketId);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch market'));
    } finally {
      setIsLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, pollInterval);
    return () => clearInterval(interval);
  }, [refresh, pollInterval]);

  return { data, error, isLoading, refresh };
}
