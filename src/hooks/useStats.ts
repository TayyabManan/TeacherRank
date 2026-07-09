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

export function usePlatformStats() {
  return useQuery<PlatformStats>({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      // One RPC (migration 014) replaces the old six-query fetch, two of which
      // transferred every ratings row to the browser.
      const { data, error } = await supabase.rpc('get_platform_stats').single()

      if (error) throw error

      const row = data as {
        total_teachers: number
        total_ratings: number
        average_rating: number
        total_students: number
        today_ratings: number
        week_ratings: number
        prev_week_ratings: number
      }

      const weekRatings = Number(row.week_ratings) || 0
      const prevWeekRatings = Number(row.prev_week_ratings) || 0
      const weeklyGrowth = prevWeekRatings > 0
        ? ((weekRatings - prevWeekRatings) / prevWeekRatings) * 100
        : (weekRatings > 0 ? 100 : 0)

      return {
        totalTeachers: Number(row.total_teachers) || 0,
        totalRatings: Number(row.total_ratings) || 0,
        totalStudents: Number(row.total_students) || 0,
        averageRating: Number(row.average_rating) || 0,
        todayRatings: Number(row.today_ratings) || 0,
        weeklyGrowth: Math.round(weeklyGrowth * 10) / 10,
      }
    },
    staleTime: 15 * 60 * 1000, // stats move slowly; no background polling
    gcTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

