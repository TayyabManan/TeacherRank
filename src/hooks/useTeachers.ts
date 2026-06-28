import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { sanitizeSearchInput } from '../lib/validation';
import { isAdmin } from '../lib/auth';
import { checkServerRateLimit } from '../lib/serverRateLimit';
import type { Teacher, TeacherWithStats, TeacherAggregate } from '../types';

interface UseTeachersOptions {
  search?: string;
  institute?: string;
  department?: string;
  city?: string;
  sortBy?: 'rating_desc' | 'rating_asc' | 'institute_az' | 'name_az';
  page?: number;
  pageSize?: number;
}

export function useTeachers(options: UseTeachersOptions = {}) {
  const { search = '', institute = 'all', department, city, sortBy = 'rating_desc', page = 1, pageSize = 12 } = options;

  return useQuery({
    queryKey: ['teachers', { search, institute, department, city, sortBy, page, pageSize }],
    queryFn: async () => {
      try {
      // Build the base query with pagination
      let query = supabase
        .from('teachers')
        .select('*', { count: 'exact' });

      // Apply server-side search filter
      if (search.trim()) {
        const sanitizedSearch = sanitizeSearchInput(search);
        if (sanitizedSearch) {
          // Use Supabase's ilike for case-insensitive search
          // We'll search across multiple fields using OR conditions
          query = query.or(`name.ilike.%${sanitizedSearch}%,institute.ilike.%${sanitizedSearch}%,bio.ilike.%${sanitizedSearch}%,designation.ilike.%${sanitizedSearch}%,city.ilike.%${sanitizedSearch}%`);
        }
      }

      // Apply institute filter
      if (institute !== 'all') {
        query = query.eq('institute', institute);
      }

      // Apply department filter
      if (department) {
        query = query.eq('department', department);
      }

      // Apply city filter
      if (city) {
        query = query.eq('city', city);
      }

      // Alphabetical sorts don't need the aggregates to order, so paginate them
      // server-side (a bare select returns at most the row cap, so without this
      // any page past ~1000 rows would render empty while totalPages claims more).
      // Rating sorts order by a column in teacher_aggregates, so those are still
      // sorted + sliced client-side below.
      const isRatingSort = sortBy === 'rating_desc' || sortBy === 'rating_asc';
      const startIndex = (page - 1) * pageSize;
      if (!isRatingSort) {
        const sortColumn = sortBy === 'institute_az' ? 'institute' : 'name';
        query = query.order(sortColumn, { ascending: true }).range(startIndex, startIndex + pageSize - 1);
      }

      // Fetch the filtered teachers with the exact total count.
      const { data: teachers, error: teacherError, count } = await query;

      if (teacherError) {
        console.error('Error fetching teachers:', teacherError);
        throw teacherError;
      }

      // Get aggregates for all filtered teachers
      const teacherIds = teachers?.map(t => t.id) || [];
      
      let aggregatesData: TeacherAggregate[] = [];
      if (teacherIds.length > 0) {
        const { data: aggregates, error: aggError } = await supabase
          .from('teacher_aggregates')
          .select('*')
          .in('teacher_id', teacherIds);
        
        if (!aggError && aggregates) {
          aggregatesData = aggregates;
        }
      }

      // Merge teachers with their aggregates
      const teachersWithStats: TeacherWithStats[] = (teachers || []).map(teacher => {
        const aggregate = aggregatesData.find((a: TeacherAggregate) => a.teacher_id === teacher.id);
        return {
          ...teacher,
          average_rating: aggregate ? Number(aggregate.avg_rating) : null,
          ratings_count: aggregate ? Number(aggregate.ratings_count) : 0,
        };
      });

      // Rating sorts: order by the aggregate rating and slice client-side (the
      // server can't ORDER BY a column that lives in teacher_aggregates). NOTE:
      // this relies on all matching rows being fetched; an institute with more
      // than the row cap (~1000 teachers) would need a server-side RPC.
      // Alphabetical sorts are already the correct page (ordered + ranged above).
      let pageData = teachersWithStats;
      if (isRatingSort) {
        const sorted = [...teachersWithStats].sort((a, b) => {
          const diff = sortBy === 'rating_desc'
            ? (b.average_rating ?? 0) - (a.average_rating ?? 0)
            : (a.average_rating ?? 0) - (b.average_rating ?? 0);
          if (diff !== 0) return diff;
          return sortBy === 'rating_desc'
            ? (b.ratings_count ?? 0) - (a.ratings_count ?? 0)
            : (a.ratings_count ?? 0) - (b.ratings_count ?? 0);
        });
        pageData = sorted.slice(startIndex, startIndex + pageSize);
      }

      return {
        data: pageData,
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
      } catch (error) {
        console.error('Error in useTeachers:', error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Optimized version with server-side sorting for non-rating based sorts
export function useTeachersOptimized(options: UseTeachersOptions = {}) {
  const { search = '', institute = 'all', department, city, sortBy = 'rating_desc', page = 1, pageSize = 12 } = options;

  return useQuery({
    queryKey: ['teachers-optimized', { search, institute, department, city, sortBy, page, pageSize }],
    queryFn: async () => {
      // For non-rating sorts, we can do everything server-side
      const needsClientSorting = sortBy === 'rating_desc' || sortBy === 'rating_asc';
      
      // Build the base query
      let query = supabase
        .from('teachers')
        .select('*', { count: 'exact' });

      // Apply search filter
      if (search.trim()) {
        const sanitizedSearch = sanitizeSearchInput(search);
        if (sanitizedSearch) {
          query = query.or(`name.ilike.%${sanitizedSearch}%,institute.ilike.%${sanitizedSearch}%,bio.ilike.%${sanitizedSearch}%,designation.ilike.%${sanitizedSearch}%,city.ilike.%${sanitizedSearch}%`);
        }
      }

      // Apply institute filter
      if (institute !== 'all') {
        query = query.eq('institute', institute);
      }

      // Apply department filter
      if (department) {
        query = query.eq('department', department);
      }

      // Apply city filter
      if (city) {
        query = query.eq('city', city);
      }

      // Apply server-side sorting for non-rating sorts
      if (!needsClientSorting) {
        switch (sortBy) {
          case 'institute_az':
            query = query.order('institute', { ascending: true, nullsFirst: false });
            break;
          case 'name_az':
            query = query.order('name', { ascending: true });
            break;
        }
        
        // Apply server-side pagination for non-rating sorts
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
      }

      const { data: teachers, error, count } = await query;

      if (error) throw error;

      // For rating-based sorting, we need to get aggregates and sort client-side
      if (needsClientSorting) {
        const teacherIds = teachers?.map(t => t.id) || [];
        
        let aggregatesData: TeacherAggregate[] = [];
        if (teacherIds.length > 0) {
          const { data: aggregates } = await supabase
            .from('teacher_aggregates')
            .select('*')
            .in('teacher_id', teacherIds);
          
          if (aggregates) {
            aggregatesData = aggregates;
          }
        }

        // Merge and sort
        const teachersWithStats: TeacherWithStats[] = (teachers || []).map(teacher => {
          const aggregate = aggregatesData.find((a: TeacherAggregate) => a.teacher_id === teacher.id);
          return {
            ...teacher,
            average_rating: aggregate ? Number(aggregate.avg_rating) : null,
            ratings_count: aggregate ? Number(aggregate.ratings_count) : 0,
          };
        });

        // Sort by rating
        teachersWithStats.sort((a, b) => {
          if (sortBy === 'rating_desc') {
            const ratingDiff = (b.average_rating ?? 0) - (a.average_rating ?? 0);
            return ratingDiff !== 0 ? ratingDiff : (b.ratings_count ?? 0) - (a.ratings_count ?? 0);
          } else {
            const ratingDiff = (a.average_rating ?? 0) - (b.average_rating ?? 0);
            return ratingDiff !== 0 ? ratingDiff : (a.ratings_count ?? 0) - (b.ratings_count ?? 0);
          }
        });

        // Apply client-side pagination
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedData = teachersWithStats.slice(startIndex, endIndex);

        return {
          data: paginatedData,
          total: count || 0,
          page,
          pageSize,
          totalPages: Math.ceil((count || 0) / pageSize),
        };
      }

      // For non-rating sorts, merge with aggregates without sorting
      const teacherIds = teachers?.map(t => t.id) || [];
      let aggregatesData: TeacherAggregate[] = [];
      
      if (teacherIds.length > 0) {
        const { data: aggregates } = await supabase
          .from('teacher_aggregates')
          .select('*')
          .in('teacher_id', teacherIds);
        
        if (aggregates) {
          aggregatesData = aggregates;
        }
      }

      const teachersWithStats: TeacherWithStats[] = (teachers || []).map(teacher => {
        const aggregate = aggregatesData.find((a: TeacherAggregate) => a.teacher_id === teacher.id);
        return {
          ...teacher,
          average_rating: aggregate ? Number(aggregate.avg_rating) : null,
          ratings_count: aggregate ? Number(aggregate.ratings_count) : 0,
        };
      });

      return {
        data: teachersWithStats,
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize),
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

export function useTeacher(id: string) {
  return useQuery({
    queryKey: ['teacher', id],
    queryFn: async () => {
      // Fetch teacher data
      const { data: teacher, error: teacherError } = await supabase
        .from('teachers')
        .select('*')
        .eq('id', id)
        .single();

      if (teacherError) throw teacherError;

      // Try to fetch aggregated stats from the view
      let avgRating = null;
      let ratingsCount = 0;
      
      try {
        const { data: aggregate, error: aggError } = await supabase
          .from('teacher_aggregates')
          .select('*')
          .eq('teacher_id', id)
          .single();

        if (!aggError && aggregate) {
          avgRating = Number(aggregate.avg_rating);
          ratingsCount = Number(aggregate.ratings_count);
        } else {
          console.warn('teacher_aggregates view not available, falling back to direct calculation');
          // Fallback: Calculate stats directly from ratings table
          const { data: ratings, error: ratingsError } = await supabase
            .from('ratings')
            .select('score')
            .eq('teacher_id', id);

          if (!ratingsError && ratings && ratings.length > 0) {
            avgRating = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
            ratingsCount = ratings.length;
          }
        }
      } catch (error) {
        console.warn('Error fetching teacher stats:', error);
        // Fallback: Try to get ratings directly
        try {
          const { data: ratings } = await supabase
            .from('ratings')
            .select('score')
            .eq('teacher_id', id);

          if (ratings && ratings.length > 0) {
            avgRating = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
            ratingsCount = ratings.length;
          }
        } catch (fallbackError) {
          console.warn('Fallback ratings query also failed:', fallbackError);
        }
      }

      // Return teacher with fresh aggregate data
      return {
        ...teacher,
        average_rating: avgRating,
        ratings_count: ratingsCount,
      } as TeacherWithStats;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: !!id,
  });
}

export function useCreateTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Teacher, 'id' | 'created_at'>) => {
      // SECURITY FIX: Verify admin access before creating teachers
      const userIsAdmin = await isAdmin();

      if (!userIsAdmin) {
        throw new Error('Unauthorized: Only administrators can create teachers');
      }

      await checkServerRateLimit('createTeacher');

      // RLS policies will also enforce this, but we check client-side for better UX
      const { data: teacher, error } = await supabase
        .from('teachers')
        .insert(data)
        .select()
        .single();

      if (error) {
        if (error.message?.includes('permission denied') || error.message?.includes('policy')) {
          throw new Error('Unauthorized: Admin access required to create teachers');
        }
        throw error;
      }
      return teacher;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-optimized'] });
    },
  });
}

export function useUpdateTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Teacher> & { id: string }) => {
      // SECURITY FIX: Verify admin access before updating teachers
      const userIsAdmin = await isAdmin();

      if (!userIsAdmin) {
        throw new Error('Unauthorized: Only administrators can update teachers');
      }

      await checkServerRateLimit('updateTeacher');

      // RLS policies will also enforce this, but we check client-side for better UX
      const { data: teacher, error } = await supabase
        .from('teachers')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.message?.includes('permission denied') || error.message?.includes('policy')) {
          throw new Error('Unauthorized: Admin access required to update teachers');
        }
        throw error;
      }
      return teacher;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teacher', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-optimized'] });
    },
  });
}

export function useDeleteTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // SECURITY FIX: Verify admin access before deleting teachers
      const userIsAdmin = await isAdmin();

      if (!userIsAdmin) {
        throw new Error('Unauthorized: Only administrators can delete teachers');
      }

      // RLS policies will also enforce this, but we check client-side for better UX
      const { error, data } = await supabase
        .from('teachers')
        .delete()
        .eq('id', id)
        .select();

      if (error) {
        console.error('Delete teacher error:', error);
        // Check for specific error types
        if (error.code === '42501' || error.message?.includes('permission denied') || error.message?.includes('policy')) {
          throw new Error('Unauthorized: Admin access required to delete teachers');
        } else if (error.code === '23503') {
          throw new Error('Cannot delete teacher due to existing related data. Please try again or contact support.');
        }
        throw new Error(error.message || 'Failed to delete teacher');
      }

      // Check if any rows were actually deleted
      if (!data || data.length === 0) {
        throw new Error('Teacher not found or already deleted');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['teachers-optimized'] });
    },
  });
}