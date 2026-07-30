import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { isAdmin } from '../lib/auth';
import { logger } from '../lib/logger';
import { queryKeys, invalidateTeacherData } from './queryKeys';
import type { Teacher, TeacherWithStats } from '../types';

// Listing queries live in useTeachersOptimized (server-side RPC). This file
// keeps the single-teacher read + the admin mutations.

/** How long a single teacher row stays fresh. Shared with usePrefetchTeacher. */
export const TEACHER_STALE_TIME = 1000 * 60 * 2; // 2 minutes

/**
 * Fetch one teacher, mapped to the app-level shape.
 *
 * Exported because usePrefetchTeacher (useTeachersOptimized) writes the *same*
 * cache key. It previously had its own queryFn returning the raw row, so a card
 * hover seeded ['teacher', id] with an unmapped row — `average_rating` was
 * undefined and the profile rendered "N/A" in its meta description, OG tag and
 * Twitter card until the entry went stale. One key, one fetcher.
 */
export async function fetchTeacher(id: string): Promise<TeacherWithStats> {
  // The teachers row carries its own denormalized stats since migration
  // 012 (avg_rating / ratings_count), so one fetch covers everything.
  const { data: teacher, error: teacherError } = await supabase
    .from('teachers')
    .select('*')
    .eq('id', id)
    .single();

  if (teacherError) throw teacherError;

  return {
    ...teacher,
    average_rating: teacher.avg_rating === null ? null : Number(teacher.avg_rating),
    ratings_count: teacher.ratings_count ?? 0,
  } as TeacherWithStats;
}

export function useTeacher(id: string) {
  return useQuery({
    queryKey: queryKeys.teacher(id),
    queryFn: () => fetchTeacher(id),
    staleTime: TEACHER_STALE_TIME,
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
      // Not just ['teachers'] — a new teacher can introduce a new institute,
      // city, department or designation, and those facet caches hold for 30 min.
      invalidateTeacherData(queryClient);
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
      // An edit can move a teacher to a different institute/city/department,
      // which changes the facet sets just as much as a create does.
      invalidateTeacherData(queryClient, variables.id);
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
        logger.error('Delete teacher failed', error);
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
    onSuccess: (_, id) => {
      // Deleting the last teacher at an institute must drop that institute from
      // the facet lists, or it lingers as a phantom filter option for 30 min.
      invalidateTeacherData(queryClient, id);
    },
  });
}