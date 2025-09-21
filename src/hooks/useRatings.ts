import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { withRateLimit, RATE_LIMITS } from '../lib/rateLimit';
import type { Rating, RatingWithRelations } from '../types';

export function useRatings(teacherId?: string, studentId?: string) {
  return useQuery({
    queryKey: ['ratings', { teacherId, studentId }],
    queryFn: async () => {
      let query = supabase
        .from('ratings')
        .select(`
          *,
          teacher:teachers (
            id,
            name,
            institute
          )
        `);

      if (teacherId) {
        query = query.eq('teacher_id', teacherId);
      }

      if (studentId) {
        query = query.eq('student_id', studentId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching ratings:', error);
        throw error;
      }

      // Fetch student profiles separately to avoid join issues
      const ratingsWithProfiles = await Promise.all(
        (data || []).map(async (rating) => {
          let student = null;
          if (rating.student_id) {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('id, display_name, email')
                .eq('id', rating.student_id)
                .single();
              
              student = profile;
            } catch (profileError) {
              console.warn('Could not fetch student profile for rating:', rating.id);
              // Set a placeholder for unknown students
              student = {
                id: rating.student_id,
                display_name: 'Anonymous Student',
                email: null
              };
            }
          }

          return {
            ...rating,
            student
          };
        })
      );

      return ratingsWithProfiles as RatingWithRelations[];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    enabled: !!(teacherId || studentId),
  });
}

interface CreateRatingData {
  teacher_id: string;
  student_id: string | null;  // Allow null for anonymous reviews
  score: number;
  comment: string;
}

export function useCreateRating() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withRateLimit(
      async (data: CreateRatingData) => {
        // For anonymous reviews, use insert
        if (!data.student_id) {
          const { data: rating, error } = await supabase
            .from('ratings')
            .insert({
              teacher_id: data.teacher_id,
              student_id: null,
              score: data.score,
              comment: data.comment,
            })
            .select()
            .single();

          if (error) throw error;
          return rating;
        }
        
        // For logged-in users, first check if they have an existing review
        const { data: existingRating } = await supabase
          .from('ratings')
          .select('id')
          .eq('teacher_id', data.teacher_id)
          .eq('student_id', data.student_id)
          .single();

        if (existingRating) {
          // Update existing review
          const { data: rating, error } = await supabase
            .from('ratings')
            .update({
              score: data.score,
              comment: data.comment,
              updated_at: new Date().toISOString(),
            })
            .eq('teacher_id', data.teacher_id)
            .eq('student_id', data.student_id)
            .select()
            .single();

          if (error) throw error;
          return rating;
        } else {
          // Create new review
          const { data: rating, error } = await supabase
            .from('ratings')
            .insert({
              teacher_id: data.teacher_id,
              student_id: data.student_id,
              score: data.score,
              comment: data.comment,
            })
            .select()
            .single();

          if (error) throw error;
          return rating;
        }
      },
      'createRating',
      (data) => data.student_id || 'anonymous' // Rate limit per user or anonymous
    ),
    onSuccess: (_, variables) => {
      // Invalidate all related queries to ensure UI updates immediately
      queryClient.invalidateQueries({ queryKey: ['ratings'] });
      queryClient.invalidateQueries({ queryKey: ['teacher', variables.teacher_id] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['user-rating'] });
      queryClient.invalidateQueries({ queryKey: ['teacher_aggregates'] });
      
      // Force immediate refetch for the specific teacher to update ratings
      queryClient.refetchQueries({ queryKey: ['teacher', variables.teacher_id] });
      queryClient.refetchQueries({ queryKey: ['ratings', { teacherId: variables.teacher_id }] });
    },
  });
}

export function useUpdateRating() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withRateLimit(
      async ({ id, ...data }: Partial<Rating> & { id: string }) => {
        const { data: rating, error } = await supabase
          .from('ratings')
          .update(data)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return rating;
      },
      'updateRating'
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratings'] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] }); // Update stats
    },
  });
}

export function useDeleteRating() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: withRateLimit(
      async (id: string) => {
        const { error } = await supabase
          .from('ratings')
          .delete()
          .eq('id', id);

        if (error) throw error;
      },
      'deleteRating'
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratings'] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['platform-stats'] }); // Update stats
    },
  });
}

export function useUserRating(teacherId: string, studentId?: string) {
  return useQuery({
    queryKey: ['user-rating', teacherId, studentId],
    queryFn: async () => {
      if (!studentId) return null;

      const { data, error } = await supabase
        .from('ratings')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('student_id', studentId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      return data as Rating | null;
    },
    enabled: !!teacherId && !!studentId,
    staleTime: 1000 * 60, // 1 minute
  });
}