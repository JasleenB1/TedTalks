/**
 * Custom React Hook for API calls with loading and error states
 * Similar to Spring Boot's exception handling and response patterns
 */

import { useState, useEffect, useRef } from 'react';
import type { ApiResponse } from '../types';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useApi<T>(
  apiCall: () => Promise<ApiResponse<T>>,
  dependencies: unknown[] = [],
  refreshIntervalMs?: number
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const fetchData = async (background = false) => {
    const shouldShowLoading = !background || !hasLoadedRef.current;

    if (shouldShowLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await apiCall();
      if (response.success && response.data) {
        setData(response.data);
        hasLoadedRef.current = true;
      } else {
        setError(response.error || 'An error occurred');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (shouldShowLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData(false);

    if (!refreshIntervalMs) {
      return;
    }

    const intervalId = window.setInterval(() => {
      fetchData(true);
    }, refreshIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshIntervalMs, ...dependencies]);

  return { data, loading, error, refetch: fetchData };
}

