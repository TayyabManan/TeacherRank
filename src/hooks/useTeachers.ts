import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { isAdmin } from '../lib/auth';
import { logger } from '../lib/logger';
import type { Teacher, TeacherWithStats } from '../types';

// Listing queries live in useTeachersOptimized (server-side RPC). This file
// keeps the single-teacher read + the admin mutations.

export function useTeacher(id: string) {
  return useQuery({
    queryKey: ['teacher', id],
    queryFn: async () => {
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
      queryClient.invalidateQueries({ queryKey: ['teacher', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
  });
}