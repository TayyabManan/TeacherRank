import { useQuery } from '@tanstack/react-query';
import { useUser } from './useAuth';
import { isAdmin } from '../lib/auth';

/**
 * Shared, cached admin check (D6). One React Query entry replaces the four
 * independent async isAdmin() calls that each raced on mount — deduped
 * request, no nav pop-in, no refocus refetch.
 */
export function useIsAdmin() {
  const { data: user } = useUser();
  return useQuery({
    queryKey: ['is-admin', user?.id],
    queryFn: isAdmin,
    enabled: !!user,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
