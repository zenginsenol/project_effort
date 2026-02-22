'use client';

import { useEffect, useState } from 'react';

import { trpc } from '@/lib/trpc';

import type { EntityType, SearchInput, SearchOutput } from '@/types/search';

interface UseSearchOptions {
  debounceMs?: number;
  enabled?: boolean;
}

interface UseSearchResult {
  data: SearchOutput | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  recentSearches: Array<{ query: string; timestamp: string }>;
  isLoadingRecent: boolean;
}

/**
 * Custom hook for searching across projects, tasks, cost analyses, and sessions
 * with debouncing and tRPC integration.
 *
 * @param input - Search input parameters (query, filters, etc.)
 * @param options - Hook options (debounce delay, enabled flag)
 * @returns Search results, loading states, and recent searches
 */
export function useSearch(
  input: SearchInput,
  options: UseSearchOptions = {}
): UseSearchResult {
  const { debounceMs = 300, enabled = true } = options;
  const [debouncedQuery, setDebouncedQuery] = useState<string>(input.query);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(input.query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [input.query, debounceMs]);

  // Only execute search if query is at least 1 character and enabled
  const shouldSearch = enabled && debouncedQuery.length > 0;

  // Execute search query
  const searchQuery = trpc.search.query.useQuery(
    {
      query: debouncedQuery,
      entityTypes: input.entityTypes,
      projectId: input.projectId,
      status: input.status,
      dateRange: input.dateRange,
    },
    {
      enabled: shouldSearch,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  // Fetch recent searches
  const recentSearchesQuery = trpc.search.getRecent.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  return {
    data: searchQuery.data ?? null,
    isLoading: searchQuery.isLoading && shouldSearch,
    isError: searchQuery.isError,
    error: searchQuery.error ?? null,
    recentSearches: recentSearchesQuery.data?.searches ?? [],
    isLoadingRecent: recentSearchesQuery.isLoading,
  };
}
