import { useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Optimized search hook with debouncing and URL sync
 * Reduces unnecessary API calls and re-renders
 */
export function useOptimizedSearch(debounceMs = 300) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [localSearch, setLocalSearch] = useState(searchParams.get('q') || '');
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  const updateSearch = useCallback((value: string) => {
    // Update local state immediately for UI responsiveness
    setLocalSearch(value);

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce URL update and API call
    debounceTimerRef.current = setTimeout(() => {
      setSearchParams(prev => {
        if (value) {
          prev.set('q', value);
        } else {
          prev.delete('q');
        }
        // Reset to page 1 on new search
        prev.delete('page');
        return prev;
      });
    }, debounceMs);
  }, [setSearchParams, debounceMs]);

  const clearSearch = useCallback(() => {
    setLocalSearch('');
    setSearchParams(prev => {
      prev.delete('q');
      return prev;
    });
  }, [setSearchParams]);

  return {
    search: searchParams.get('q') || '',
    localSearch,
    updateSearch,
    clearSearch
  };
}