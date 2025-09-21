import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface PlatformStats {
  totalTeachers: number
  totalRatings: number
  totalStudents: number
  averageRating: number
  todayRatings: number
  weeklyGrowth: number
}

export function useStats() {
  return useQuery<PlatformStats>({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        weekAgo.setHours(0, 0, 0, 0)
        
        const withTimeout = async (promise: Promise<any>, timeoutMs: number = 10000) => {
          const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
          );
          return Promise.race([promise, timeout]);
        };
        
        const results = await Promise.allSettled([
          withTimeout(
            Promise.resolve(
              supabase
                .from('teachers')
                .select('*', { count: 'exact', head: true })
            )
          ),
          
          withTimeout(
            Promise.resolve(
              supabase
                .from('ratings')
                .select('score')
            )
          ),
          
          withTimeout(
            Promise.resolve(
              supabase
                .from('ratings')
                .select('student_id')
                .not('student_id', 'is', null)
            )
          ),
          
          withTimeout(
            Promise.resolve(
              supabase
                .from('ratings')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', today.toISOString())
            )
          ),
          
          withTimeout(
            Promise.resolve(
              supabase
                .from('ratings')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', weekAgo.toISOString())
            )
          )
        ]);
        
        const teachersResult = results[0].status === 'fulfilled' ? results[0].value : { count: 0 };
        const ratingsResult = results[1].status === 'fulfilled' ? results[1].value : { data: [] };
        const studentsResult = results[2].status === 'fulfilled' ? results[2].value : { data: [] };
        const todayRatingsResult = results[3].status === 'fulfilled' ? results[3].value : { count: 0 };
        const weekRatingsResult = results[4].status === 'fulfilled' ? results[4].value : { count: 0 };
        
        const totalTeachers = teachersResult.count || 0;
        const ratings = ratingsResult.data || [];
        const totalRatings = ratings.length;
        
        const averageRating = totalRatings > 0
          ? ratings.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / totalRatings
          : 0;
        
        const uniqueStudents = new Set(studentsResult.data?.map((r: any) => r.student_id).filter(Boolean) || []);
        const totalStudents = uniqueStudents.size;
        
        const todayRatings = todayRatingsResult.count || 0;
        const weekRatings = weekRatingsResult.count || 0;
        
        const previousWeekRatings = Math.max(0, totalRatings - weekRatings);
        const weeklyGrowth = previousWeekRatings > 0
          ? ((weekRatings - previousWeekRatings) / previousWeekRatings) * 100
          : 0;
        
        return {
          totalTeachers,
          totalRatings,
          totalStudents,
          averageRating: Math.round(averageRating * 10) / 10,
          todayRatings,
          weeklyGrowth: Math.round(weeklyGrowth * 10) / 10
        };
      } catch (error) {
        console.error('Failed to fetch platform stats:', error);
        return {
          totalTeachers: 0,
          totalRatings: 0,
          totalStudents: 0,
          averageRating: 0,
          todayRatings: 0,
          weeklyGrowth: 0
        };
      }
    },
    staleTime: 30000,
    refetchInterval: 60000,
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

export function usePlatformStats() {
  return useQuery<PlatformStats>({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      try {
        console.log('Fetching platform stats...');
        
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        weekAgo.setHours(0, 0, 0, 0)
        
        // Add timeout wrapper for all queries
        const withTimeout = async (promise: Promise<any>, timeoutMs: number = 10000) => {
          const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
          );
          return Promise.race([promise, timeout]);
        };
        
        // Fetch all stats in parallel with timeout
        const results = await Promise.allSettled([
          // Total teachers
          withTimeout(
            Promise.resolve(
              supabase
                .from('teachers')
                .select('*', { count: 'exact', head: true })
            )
          ),
          
          // Total ratings and average
          withTimeout(
            Promise.resolve(
              supabase
                .from('ratings')
                .select('score')
            )
          ),
          
          // Total unique students who have rated
          withTimeout(
            Promise.resolve(
              supabase
                .from('ratings')
                .select('student_id')
                .not('student_id', 'is', null)
            )
          ),
          
          // Today's ratings
          withTimeout(
            Promise.resolve(
              supabase
                .from('ratings')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', today.toISOString())
            )
          ),
          
          // This week's ratings for growth calculation
          withTimeout(
            Promise.resolve(
              supabase
                .from('ratings')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', weekAgo.toISOString())
            )
          )
        ]);
        
        // Extract results with fallbacks
        const teachersResult = results[0].status === 'fulfilled' ? results[0].value : { count: 0 };
        const ratingsResult = results[1].status === 'fulfilled' ? results[1].value : { data: [] };
        const studentsResult = results[2].status === 'fulfilled' ? results[2].value : { data: [] };
        const todayRatingsResult = results[3].status === 'fulfilled' ? results[3].value : { count: 0 };
        const weekRatingsResult = results[4].status === 'fulfilled' ? results[4].value : { count: 0 };
        
        // Log any failures
        results.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(`Stats query ${index} failed:`, result.reason);
          }
        });
        
        const totalTeachers = teachersResult.count || 0;
        const ratings = ratingsResult.data || [];
        const totalRatings = ratings.length;
        
        // Calculate average rating
        const averageRating = totalRatings > 0
          ? ratings.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / totalRatings
          : 0;
        
        // Get unique student count
        const uniqueStudents = new Set(studentsResult.data?.map((r: any) => r.student_id).filter(Boolean) || []);
        const totalStudents = uniqueStudents.size;
        
        const todayRatings = todayRatingsResult.count || 0;
        const weekRatings = weekRatingsResult.count || 0;
        
        // Calculate weekly growth percentage
        const previousWeekRatings = Math.max(0, totalRatings - weekRatings);
        const weeklyGrowth = previousWeekRatings > 0
          ? ((weekRatings - previousWeekRatings) / previousWeekRatings) * 100
          : 0;
        
        console.log('Platform stats fetched successfully:', {
          totalTeachers,
          totalRatings,
          totalStudents,
          averageRating: Math.round(averageRating * 10) / 10,
          todayRatings,
          weeklyGrowth: Math.round(weeklyGrowth * 10) / 10
        });
        
        return {
          totalTeachers,
          totalRatings,
          totalStudents,
          averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
          todayRatings,
          weeklyGrowth: Math.round(weeklyGrowth * 10) / 10
        };
      } catch (error) {
        console.error('Failed to fetch platform stats:', error);
        // Return default values on error
        return {
          totalTeachers: 0,
          totalRatings: 0,
          totalStudents: 0,
          averageRating: 0,
          todayRatings: 0,
          weeklyGrowth: 0
        };
      }
    },
    staleTime: 30000, // Consider data stale after 30 seconds
    refetchInterval: 60000, // Refetch every 1 minute
    retry: 2, // Retry twice on failure
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

