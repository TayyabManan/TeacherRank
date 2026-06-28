import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { sanitizeSearchInput } from '../lib/validation';
import type { TeacherWithStats, TeacherAggregate } from '../types';

interface UseTeachersOptions {
  search?: string;
  institute?: string;
  department?: string;
  city?: string;
  sortBy?: 'rating_desc' | 'rating_asc' | 'institute_az' | 'name_az';
  page?: number;
  pageSize?: number;
  prefetchNext?: boolean;
}

interface TeachersResponse {
  data: TeacherWithStats[];
  total: number;
  totalPages: number;
  currentPage: number;
}

export function useTeachersOptimized({
  search = '',
  institute = 'all',
  department = 'all',
  city = 'all',
  sortBy = 'rating_desc',
  page = 1,
  pageSize = 12,
  prefetchNext = true
}: UseTeachersOptions = {}) {
  const queryClient = useQueryClient();

  const queryKey = ['teachers', { search, institute, department, city, sortBy, page, pageSize }];

  const fetchTeachers = async (): Promise<TeachersResponse> => {
    try {
      // Try to use the optimized database function first
      const { data: teachers, error: teachersError } = await supabase
        .rpc('get_teachers_with_stats', {
          search_query: search || null,
          institute_filter: institute === 'all' ? null : institute,
          department_filter: department === 'all' ? null : department,
          city_filter: city === 'all' ? null : city,
          sort_by: sortBy,
          page_num: page,
          page_size: pageSize
        });

      if (teachersError) {
        console.warn('RPC function failed, falling back to regular query:', teachersError);
        throw teachersError;
      }

      // Get total count for pagination
      const { data: countData, error: countError } = await supabase
        .rpc('get_teachers_count', {
          search_query: search || null,
          institute_filter: institute === 'all' ? null : institute,
          department_filter: department === 'all' ? null : department,
          city_filter: city === 'all' ? null : city
        });

      if (countError) {
        console.warn('Count RPC failed:', countError);
        throw countError;
      }

      const total = countData || 0;
      const totalPages = Math.ceil(total / pageSize);

      return {
        data: teachers || [],
        total,
        totalPages,
        currentPage: page
      };
    } catch (rpcError) {
      // Fallback to regular query if RPC fails
      console.log('Falling back to regular teachers query');
      
      let query = supabase
        .from('teachers')
        .select('*', { count: 'exact' });

      // Apply filters
      if (search.trim()) {
        const sanitizedSearch = sanitizeSearchInput(search);
        if (sanitizedSearch) {
          query = query.or(`name.ilike.%${sanitizedSearch}%,institute.ilike.%${sanitizedSearch}%,bio.ilike.%${sanitizedSearch}%,department.ilike.%${sanitizedSearch}%`);
        }
      }

      if (institute !== 'all') {
        query = query.eq('institute', institute);
      }

      if (department !== 'all') {
        query = query.eq('department', department);
      }

      if (city !== 'all') {
        query = query.eq('city', city);
      }

      // Get all filtered teachers for client-side sorting
      const { data: teachers, error, count } = await query;

      if (error) throw error;

      // Get aggregates for the teachers
      const teacherIds = teachers?.map(t => t.id) || [];
      let teachersWithStats: TeacherWithStats[] = [];
      
      if (teacherIds.length > 0) {
        const { data: aggregates } = await supabase
          .from('teacher_aggregates')
          .select('*')
          .in('teacher_id', teacherIds);
        
        // Merge teachers with stats
        teachersWithStats = (teachers || []).map(teacher => {
          const aggregate = aggregates?.find(a => a.teacher_id === teacher.id);
          return {
            ...teacher,
            average_rating: aggregate ? Number(aggregate.avg_rating) : null,
            ratings_count: aggregate ? Number(aggregate.ratings_count) : 0,
          };
        });
      } else {
        teachersWithStats = (teachers || []).map(teacher => ({
          ...teacher,
          average_rating: null,
          ratings_count: 0,
        }));
      }

      // Apply client-side sorting
      let sorted = [...teachersWithStats];
      switch (sortBy) {
        case 'rating_desc':
          sorted.sort((a, b) => {
            const ratingDiff = (b.average_rating ?? 0) - (a.average_rating ?? 0);
            return ratingDiff !== 0 ? ratingDiff : (b.ratings_count ?? 0) - (a.ratings_count ?? 0);
          });
          break;
        case 'rating_asc':
          sorted.sort((a, b) => {
            const ratingDiff = (a.average_rating ?? 0) - (b.average_rating ?? 0);
            return ratingDiff !== 0 ? ratingDiff : (a.ratings_count ?? 0) - (b.ratings_count ?? 0);
          });
          break;
        case 'institute_az':
          sorted.sort((a, b) => (a.institute ?? '').localeCompare(b.institute ?? ''));
          break;
        case 'name_az':
          sorted.sort((a, b) => a.name.localeCompare(b.name));
          break;
      }

      // Apply pagination
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedData = sorted.slice(startIndex, endIndex);

      const total = count || 0;
      const totalPages = Math.ceil(total / pageSize);

      return {
        data: paginatedData,
        total,
        totalPages,
        currentPage: page
      };
    }
  };

  // Prefetch next page for smoother pagination
  const prefetchNextPage = () => {
    if (prefetchNext && page < 10) { // Limit prefetching to first 10 pages
      const nextPage = page + 1;
      queryClient.prefetchQuery({
        // Key + filters must match the main query exactly, or the prefetch is
        // never read (key mismatch) and would serve filter-wrong rows if it were.
        queryKey: ['teachers', { search, institute, department, city, sortBy, page: nextPage, pageSize }],
        queryFn: async () => {
          const { data, error } = await supabase
            .rpc('get_teachers_with_stats', {
              search_query: search || null,
              institute_filter: institute === 'all' ? null : institute,
              department_filter: department === 'all' ? null : department,
              city_filter: city === 'all' ? null : city,
              sort_by: sortBy,
              page_num: nextPage,
              page_size: pageSize
            });

          if (error) throw error;

          const { data: countData } = await supabase
            .rpc('get_teachers_count', {
              search_query: search || null,
              institute_filter: institute === 'all' ? null : institute,
              department_filter: department === 'all' ? null : department,
              city_filter: city === 'all' ? null : city
            });
          
          const total = countData || 0;
          const totalPages = Math.ceil(total / pageSize);
          
          return {
            data: data || [],
            total,
            totalPages,
            currentPage: nextPage
          };
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
      });
    }
  };

  const result = useQuery({
    queryKey,
    queryFn: fetchTeachers,
    staleTime: 60 * 1000, // 60 seconds - balance freshness vs redundant refetches on focus
    gcTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: 'always', // Always check for updates
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Prefetch next page when data is loaded
  if (result.isSuccess && prefetchNext) {
    prefetchNextPage();
  }

  return result;
}

// Hook for prefetching teacher details
export function usePrefetchTeacher() {
  const queryClient = useQueryClient();

  return (teacherId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['teacher', teacherId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('teachers')
          .select('*')
          .eq('id', teacherId)
          .single();

        if (error) throw error;
        return data;
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };
}

// Hook for getting all unique institutes
export function useInstitutes() {
  return useQuery({
    queryKey: ['institutes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('institute')
        .not('institute', 'is', null)
        .order('institute');

      if (error) throw error;

      // Get unique institutes
      const uniqueInstitutes = Array.from(
        new Set(data?.map(t => t.institute).filter(Boolean))
      ).sort();

      return uniqueInstitutes;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });
}

// Hook for getting all unique departments (optionally filtered by institute)
export function useDepartments(institute?: string) {
  return useQuery({
    queryKey: ['departments', institute],
    queryFn: async () => {
      let query = supabase
        .from('teachers')
        .select('department')  // Now lowercase
        .not('department', 'is', null);

      // If an institute is selected, filter departments by that institute
      if (institute && institute !== 'all') {
        query = query.eq('institute', institute);
      }

      const { data, error } = await query.order('department');

      if (error) throw error;

      // Get unique departments
      const uniqueDepartments = Array.from(
        new Set(data?.map(t => t.department).filter(Boolean))
      ).sort();

      return uniqueDepartments;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });
}

// Hook for getting all unique cities (optionally filtered by institute)
export function useCities(institute?: string) {
  return useQuery({
    queryKey: ['cities', institute],
    queryFn: async () => {
      let query = supabase
        .from('teachers')
        .select('city')
        .not('city', 'is', null);

      // If an institute is selected, filter cities by that institute
      if (institute && institute !== 'all') {
        query = query.eq('institute', institute);
      }

      const { data, error } = await query.order('city');

      if (error) throw error;

      // Get unique cities
      const uniqueCities = Array.from(
        new Set(data?.map(t => t.city).filter(Boolean))
      ).sort();

      return uniqueCities;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });
}

// Hook for getting all unique designations (datalist suggestions on teacher forms)
export function useDesignations() {
  return useQuery({
    queryKey: ['designations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('designation')
        .not('designation', 'is', null)
        .order('designation');

      if (error) throw error;

      const uniqueDesignations = Array.from(
        new Set(data?.map(t => t.designation).filter(Boolean))
      ).sort();

      return uniqueDesignations;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });
}