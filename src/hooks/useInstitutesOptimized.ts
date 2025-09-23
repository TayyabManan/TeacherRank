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
      try {
        logger.info('Starting optimized institutes query');

        // Step 1: Get all teachers with their institutes
        const { data: teachers, error: teachersError } = await supabase
          .from('teachers')
          .select('id, institute')
          .not('institute', 'is', null);

        if (teachersError) {
          logger.error('Error fetching teachers', teachersError);
          throw teachersError;
        }

        if (!teachers || teachers.length === 0) {
          logger.info('No teachers found');
          return [];
        }

        // Group teachers by institute
        const instituteGroups = new Map<string, string[]>();
        teachers.forEach(teacher => {
          if (teacher.institute) {
            if (!instituteGroups.has(teacher.institute)) {
              instituteGroups.set(teacher.institute, []);
            }
            instituteGroups.get(teacher.institute)!.push(teacher.id);
          }
        });

        logger.info('Grouped teachers by institute', { institutes: instituteGroups.size });

        // Step 2: Get all teacher aggregates (if available)
        const allTeacherIds = teachers.map(t => t.id);
        const aggregatesMap = new Map();

        try {
          const { data: aggregates, error: aggError } = await supabase
            .from('teacher_aggregates')
            .select('teacher_id, avg_rating, ratings_count')
            .in('teacher_id', allTeacherIds);

          if (aggError) {
            logger.warn('Error fetching aggregates, continuing without stats', aggError);
            // Continue without aggregates - we'll just show basic info
          } else if (aggregates) {
            aggregates.forEach(agg => {
              if (agg.teacher_id) {
                aggregatesMap.set(agg.teacher_id, {
                  avg_rating: Number(agg.avg_rating) || 0,
                  ratings_count: Number(agg.ratings_count) || 0
                });
              }
            });
            logger.info('Loaded teacher aggregates', { count: aggregates.length });
          }
        } catch (aggError) {
          logger.warn('Failed to load aggregates, using basic data only', aggError as Error);
          // Continue without aggregates
        }

        // Step 3: Calculate institute statistics
        const institutes: OptimizedInstitute[] = Array.from(instituteGroups.entries()).map(([instituteName, teacherIds]) => {
          let totalRatings = 0;
          let avgRating = 0;
          let topRatedCount = 0;

          // Calculate stats if we have aggregates
          if (aggregatesMap.size > 0) {
            const instituteAggregates = teacherIds
              .map(id => aggregatesMap.get(id))
              .filter(Boolean);

            if (instituteAggregates.length > 0) {
              totalRatings = instituteAggregates.reduce((sum, agg) => sum + agg.ratings_count, 0);

              const ratingsWithAvg = instituteAggregates.filter(agg => agg.avg_rating > 0);
              if (ratingsWithAvg.length > 0) {
                avgRating = ratingsWithAvg.reduce((sum, agg) => sum + agg.avg_rating, 0) / ratingsWithAvg.length;
              }

              topRatedCount = instituteAggregates.filter(agg => agg.avg_rating >= 4.5).length;
            }
          }

          return {
            name: instituteName,
            total_teachers: teacherIds.length,
            total_ratings: totalRatings,
            avg_rating: avgRating,
            top_rated_count: topRatedCount,
          };
        });

        // Sort by total teachers (descending)
        const sorted = institutes.sort((a, b) => b.total_teachers - a.total_teachers);

        logger.info('Optimized institutes query completed', { count: sorted.length });
        return sorted;

      } catch (error) {
        logger.error('Error in useInstitutesOptimized', error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 5000),
  });
}