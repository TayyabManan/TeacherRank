import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { queryKeys } from './queryKeys';
import { fetchTeacher, TEACHER_STALE_TIME } from './useTeachers';
import type { TeacherWithStats } from '../types';

/**
 * The client's sort vocabulary — single source for the listing UI, this hook,
 * and (mirrored, see validation.ts) the zod schema. 'rating_asc' was retired
 * 2026-08: the RPC orders ascending on COALESCE(avg_rating, 0), so it led
 * with the entire unrated wall, and no ascending sort can mean "rising stars".
 * The RPC still accepts it; do not re-add it here without a real definition.
 */
export const TEACHER_SORTS = ['rating_desc', 'name_az', 'institute_az'] as const;
export type TeacherSort = (typeof TEACHER_SORTS)[number];

interface UseTeachersOptions {
  search?: string;
  institute?: string;
  department?: string;
  city?: string;
  sortBy?: TeacherSort;
  page?: number;
  pageSize?: number;
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
  pageSize = 12
}: UseTeachersOptions = {}) {
  const queryKey = ['teachers', { search, institute, department, city, sortBy, page, pageSize }];

  // No client-side fallback on RPC failure: the old full-table fallback
  // amplified load exactly when the DB was struggling. Errors surface as an
  // error card with a retry (TeacherListing / InstitutePage).
  const fetchTeachers = async (): Promise<TeachersResponse> => {
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

    if (teachersError) throw teachersError;

    const { data: countData, error: countError } = await supabase
      .rpc('get_teachers_count', {
        search_query: search || null,
        institute_filter: institute === 'all' ? null : institute,
        department_filter: department === 'all' ? null : department,
        city_filter: city === 'all' ? null : city
      });

    if (countError) throw countError;

    const total = countData || 0;

    return {
      data: (teachers || []) as TeacherWithStats[],
      total,
      totalPages: Math.ceil(total / pageSize),
      currentPage: page
    };
  };

  return useQuery({
    queryKey,
    queryFn: fetchTeachers,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

// Hook for prefetching teacher details
export function usePrefetchTeacher() {
  const queryClient = useQueryClient();

  return (teacherId: string) => {
    // Must use the same fetcher AND the same staleTime as useTeacher — this
    // writes the key that useTeacher reads. It used to have its own queryFn
    // returning the raw row (no avg_rating -> average_rating mapping) and a
    // longer 5-min staleTime, so hovering a card poisoned the profile's rating
    // for five minutes.
    queryClient.prefetchQuery({
      queryKey: queryKeys.teacher(teacherId),
      queryFn: () => fetchTeacher(teacherId),
      staleTime: TEACHER_STALE_TIME,
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
    staleTime: 30 * 60 * 1000, // facet lists change rarely
    gcTime: 60 * 60 * 1000,
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
    // The listing's department dropdown only renders once an institute is
    // chosen, so skip the column scan while the filter sits on 'all'.
    // Callers with no institute argument (form datalists) stay enabled.
    enabled: institute !== 'all',
    staleTime: 30 * 60 * 1000, // facet lists change rarely
    gcTime: 60 * 60 * 1000,
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
    // Same gating as useDepartments: no scan while the listing filter is 'all';
    // no-argument callers (form datalists) stay enabled.
    enabled: institute !== 'all',
    staleTime: 30 * 60 * 1000, // facet lists change rarely
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export interface InstituteFacets {
  departments: string[];
  cities: string[];
  totalTeachers: number;
  totalRatings: number;
  /** Review-weighted mean (each review counts equally), 0 when unrated. */
  avgRating: number;
  /** Teachers with at least one review */
  ratedTeachersCount: number;
  /** Teachers rated 4.5+ */
  topRatedCount: number;
}

// One narrow query per institute page: filter dropdown options + the stats
// header, derived client-side from four small columns (replaces the old
// pageSize-1000 full-row second fetch).
export function useInstituteFacets(institute: string) {
  return useQuery<InstituteFacets>({
    queryKey: ['institute-facets', institute],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('department, city, avg_rating, ratings_count')
        .eq('institute', institute);

      if (error) throw error;

      const rows = data || [];
      const departments = Array.from(
        new Set(rows.map(r => r.department).filter(Boolean))
      ).sort() as string[];
      const cities = Array.from(
        new Set(rows.map(r => r.city).filter(Boolean))
      ).sort() as string[];

      const totalRatings = rows.reduce((sum, r) => sum + (r.ratings_count || 0), 0);
      const rated = rows.filter(r => r.avg_rating != null && (r.ratings_count || 0) > 0);
      const ratingWeight = rated.reduce((sum, r) => sum + (r.ratings_count || 0), 0);
      const avgRating = ratingWeight > 0
        ? rated.reduce((sum, r) => sum + Number(r.avg_rating) * (r.ratings_count || 0), 0) / ratingWeight
        : 0;
      const topRatedCount = rows.filter(r => Number(r.avg_rating) >= 4.5).length;

      return {
        departments,
        cities,
        totalTeachers: rows.length,
        totalRatings,
        avgRating,
        ratedTeachersCount: rated.length,
        topRatedCount,
      };
    },
    enabled: !!institute,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
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
    staleTime: 30 * 60 * 1000, // facet lists change rarely
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}