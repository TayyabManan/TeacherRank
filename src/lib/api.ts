/**
 * API wrapper with rate limiting and caching
 */

import { supabase } from './supabaseClient'
import { rateLimiter, RATE_LIMITS, withRateLimit } from './rateLimit'
import { cache, createCachedQuery } from './cache'
import { captureException } from './sentry'
import { measureApiCall } from './performance'

// Helper to get user ID for rate limiting
async function getUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser()
  return data?.user?.id || 'anonymous'
}

// Teacher operations with rate limiting
export const createTeacher = withRateLimit(
  async (teacherData: any) => {
    const perf = measureApiCall('createTeacher')
    try {
      const { data, error } = await supabase
        .from('teachers')
        .insert(teacherData)
        .select()
        .single()
      
      if (error) throw error
      
      // Invalidate cache
      cache.clearMemory()
      
      return data
    } catch (error) {
      captureException(error as Error, { operation: 'createTeacher' })
      throw error
    } finally {
      perf.end()
    }
  },
  'createTeacher',
  () => getUserId()
)

export const updateTeacher = withRateLimit(
  async (id: string, updates: any) => {
    const perf = measureApiCall('updateTeacher')
    try {
      const { data, error } = await supabase
        .from('teachers')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      
      // Invalidate related cache
      await cache.delete(`teacher-${id}`)
      cache.clearMemory()
      
      return data
    } catch (error) {
      captureException(error as Error, { operation: 'updateTeacher', teacherId: id })
      throw error
    } finally {
      perf.end()
    }
  },
  'updateTeacher',
  () => getUserId()
)

// Rating operations with rate limiting
export const createRating = withRateLimit(
  async (ratingData: any) => {
    const perf = measureApiCall('createRating')
    
    // Check server-side rate limit if edge function is deployed
    if (import.meta.env.VITE_USE_EDGE_RATE_LIMIT === 'true') {
      const response = await fetch('/api/rate-limit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-rating',
          identifier: getUserId()
        })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Rate limit exceeded')
      }
    }
    
    try {
      const { data, error } = await supabase
        .from('ratings')
        .insert(ratingData)
        .select()
        .single()
      
      if (error) throw error
      
      // Invalidate teacher cache to update ratings
      await cache.delete(`teacher-${ratingData.teacher_id}`)
      cache.clearMemory()
      
      return data
    } catch (error) {
      captureException(error as Error, { operation: 'createRating' })
      throw error
    } finally {
      perf.end()
    }
  },
  'createRating',
  () => getUserId()
)

export const updateRating = withRateLimit(
  async (id: string, updates: any) => {
    const perf = measureApiCall('updateRating')
    try {
      const { data, error } = await supabase
        .from('ratings')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      
      // Clear related caches
      cache.clearMemory()
      
      return data
    } catch (error) {
      captureException(error as Error, { operation: 'updateRating', ratingId: id })
      throw error
    } finally {
      perf.end()
    }
  },
  'updateRating',
  () => getUserId()
)

// Cached queries for read operations
export const getTeacherWithCache = async (id: string) => {
  const fetcher = createCachedQuery(
    `teacher-${id}`,
    async () => {
      const perf = measureApiCall('getTeacher')
      try {
        const { data, error } = await supabase
          .from('teachers')
          .select(`
            *,
            ratings (
              id,
              score,
              comment,
              created_at,
              is_anonymous,
              user_id
            )
          `)
          .eq('id', id)
          .single()
        
        if (error) throw error
        return data
      } finally {
        perf.end()
      }
    },
    300 // 5 minutes cache
  )
  
  return fetcher()
}

export const getTeachersWithCache = async (options: {
  search?: string
  institute?: string
  sortBy?: string
  page?: number
  pageSize?: number
}) => {
  const cacheKey = `teachers-${JSON.stringify(options)}`
  
  const fetcher = createCachedQuery(
    cacheKey,
    async () => {
      const perf = measureApiCall('getTeachers')
      try {
        const { data: teachers, error: teachersError } = await supabase
          .rpc('get_teachers_with_stats', {
            search_query: options.search || null,
            institute_filter: options.institute === 'all' ? null : options.institute,
            sort_by: options.sortBy || 'rating_desc',
            page_num: options.page || 1,
            page_size: options.pageSize || 12
          })
        
        if (teachersError) throw teachersError
        
        const { data: countData, error: countError } = await supabase
          .rpc('get_teachers_count', {
            search_query: options.search || null,
            institute_filter: options.institute === 'all' ? null : options.institute
          })
        
        if (countError) throw countError
        
        const total = countData || 0
        const totalPages = Math.ceil(total / (options.pageSize || 12))
        
        return {
          data: teachers || [],
          total,
          totalPages,
          currentPage: options.page || 1
        }
      } finally {
        perf.end()
      }
    },
    60 // 1 minute cache for list views
  )
  
  return fetcher()
}

// Authentication with rate limiting
export const signIn = withRateLimit(
  async (email: string, password: string) => {
    const perf = measureApiCall('signIn')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) throw error
      return data
    } catch (error) {
      captureException(error as Error, { operation: 'signIn' })
      throw error
    } finally {
      perf.end()
    }
  },
  'signIn',
  (email) => email // Use email as identifier for rate limiting
)

export const signUp = withRateLimit(
  async (email: string, password: string, metadata?: any) => {
    const perf = measureApiCall('signUp')
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata
        }
      })
      
      if (error) throw error
      return data
    } catch (error) {
      captureException(error as Error, { operation: 'signUp' })
      throw error
    } finally {
      perf.end()
    }
  },
  'signUp',
  (email) => email
)

// Search with rate limiting
export const searchTeachers = withRateLimit(
  async (query: string) => {
    return getTeachersWithCache({ search: query })
  },
  'search',
  () => getUserId()
)

// Prefetch helper for better UX
export const prefetchTeacher = async (id: string) => {
  const key = `teacher-${id}`
  const cached = await cache.get(key)
  
  if (!cached) {
    // Prefetch in background
    getTeacherWithCache(id).catch(console.error)
  }
}

// Batch prefetch for lists
export const prefetchTeachers = async (ids: string[]) => {
  ids.forEach(id => prefetchTeacher(id))
}