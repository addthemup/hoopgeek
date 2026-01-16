import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { useRef, useEffect } from 'react';

/**
 * Custom hook that wraps useQuery to keep previous data visible while loading new data.
 * This prevents the loading state from showing when switching tabs/views.
 * 
 * When the query key changes, it will show the previous data from the old key
 * until the new data is loaded, then animate the transition.
 */
export function useQueryWithPreviousData<TData = unknown, TError = unknown>(
  options: UseQueryOptions<TData, TError>
): UseQueryResult<TData, TError> {
  // Store previous data per query key
  const dataCacheRef = useRef<Map<string, TData>>(new Map());
  const currentQueryKey = JSON.stringify(options.queryKey);
  
  // Get previous data for this query key pattern (e.g., same base key but different params)
  const getPreviousData = (): TData | undefined => {
    // Try to find data from a similar query key (same base, different params)
    // For now, just use the last known data
    const cache = dataCacheRef.current;
    if (cache.size > 0) {
      // Return the most recent data from cache
      return Array.from(cache.values())[cache.size - 1];
    }
    return undefined;
  };

  const queryResult = useQuery<TData, TError>({
    ...options,
    // Use placeholderData to keep previous data while loading
    placeholderData: (previousData) => {
      // If React Query has previous data, use it
      if (previousData !== undefined) {
        return previousData;
      }
      // Otherwise, try to get from our cache
      return getPreviousData();
    },
  });
  
  // Update cache when we have new data
  useEffect(() => {
    if (!queryResult.isLoading && queryResult.data !== undefined) {
      // Store data in cache with current query key
      dataCacheRef.current.set(currentQueryKey, queryResult.data);
      // Keep only last 5 entries to prevent memory leaks
      if (dataCacheRef.current.size > 5) {
        const firstKey = dataCacheRef.current.keys().next().value;
        dataCacheRef.current.delete(firstKey);
      }
    }
  }, [queryResult.isLoading, queryResult.data, currentQueryKey]);

  return queryResult;
}

