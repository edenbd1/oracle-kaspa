'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchQuote } from '../api';
import type { Quote, TradeSide, TradeAction } from '../types';

interface UseQuoteParams {
  marketId: string;
  side: TradeSide;
  action: TradeAction;
  amount: number;
  enabled?: boolean;
}

export function useQuote({ marketId, side, action, amount, enabled = true }: UseQuoteParams) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || amount <= 0) {
      setQuote(null);
      return;
    }

    setIsLoading(true);
    try {
      const result = await fetchQuote(marketId, side, action, amount);
      setQuote(result.quote);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch quote'));
      setQuote(null);
    } finally {
      setIsLoading(false);
    }
  }, [marketId, side, action, amount, enabled]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!enabled || amount <= 0) {
      setQuote(null);
      setIsLoading(false);
      return;
    }

    debounceRef.current = setTimeout(refresh, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [refresh, enabled, amount]);

  return { quote, error, isLoading, refresh };
}
