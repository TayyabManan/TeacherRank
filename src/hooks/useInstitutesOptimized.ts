import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';

interface OptimizedInstitute {
  name: string;
  total_teachers: number;
  total_ratings: number;
  avg_rating: number;
  top_rated_count: number;
}

export function useInstitutesOptimized() {
  return useQuery({
    queryKey: ['institutes-optimized'],
    queryFn: async () => {
      // Teachers carry their own denormalized stats since migration 012, so
      // one narrow query covers the whole institutes directory (previously
      // two full-table transfers: teachers + teacher_aggregates).
      const { data: teachers, error } = await supabase
        .from('teachers')
        .select('institute, avg_rating, ratings_count')
        .not('institute', 'is', null);

      if (error) {
        logger.error('Error fetching institute stats', error);
        throw error;
      }

      const groups = new Map<string, { avg_rating: number | null; ratings_count: number }[]>();
      for (const t of teachers || []) {
        if (!t.institute) continue;
        if (!groups.has(t.institute)) groups.set(t.institute, []);
        groups.get(t.institute)!.push({
          avg_rating: t.avg_rating === null ? null : Number(t.avg_rating),
          ratings_count: t.ratings_count || 0,
        });
      }

      const institutes: OptimizedInstitute[] = Array.from(groups.entries()).map(([name, rows]) => {
        const totalRatings = rows.reduce((sum, r) => sum + r.ratings_count, 0);

        // Review-weighted mean (each review counts equally), not an average
        // of per-teacher averages — a 1-review teacher must not outweigh a 500.
        const rated = rows.filter(r => (r.avg_rating ?? 0) > 0 && r.ratings_count > 0);
        const ratingWeight = rated.reduce((sum, r) => sum + r.ratings_count, 0);
        const avgRating = ratingWeight > 0
          ? rated.reduce((sum, r) => sum + (r.avg_rating ?? 0) * r.ratings_count, 0) / ratingWeight
          : 0;

        return {
          name,
          total_teachers: rows.length,
          total_ratings: totalRatings,
          avg_rating: avgRating,
          top_rated_count: rows.filter(r => (r.avg_rating ?? 0) >= 4.5).length,
        };
      });

      return institutes.sort((a, b) => b.total_teachers - a.total_teachers);
    },
    staleTime: 1000 * 60 * 30, // directory data changes rarely
    gcTime: 1000 * 60 * 60,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 5000),
  });
}
