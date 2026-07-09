import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { withRateLimit, RATE_LIMITS } from '../lib/rateLimit';
import { anonymousTracker } from '../lib/anonymousTracking';
import { toFriendlyError } from '../lib/dbErrors';
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

      // Fetch all student display names in one batched query (no email — public
      // info only). No FK exists from ratings.student_id to profiles, so a
      // PostgREST embed isn't possible; one in() query replaces the old
      // per-rating lookup.
      const studentIds = Array.from(
        new Set((data || []).map(r => r.student_id).filter(Boolean))
      ) as string[];

      const profilesById = new Map<string, { id: string; display_name: string | null }>();
      if (studentIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', studentIds);

        if (profilesError) {
          console.warn('Could not fetch student profiles for ratings:', profilesError);
        }
        for (const profile of profiles || []) {
          profilesById.set(profile.id, profile);
        }
      }

      const ratingsWithProfiles = (data || []).map(rating => ({
        ...rating,
        student: rating.student_id
          ? profilesById.get(rating.student_id) ?? {
              id: rating.student_id,
              display_name: 'Anonymous Student',
            }
          : null,
      }));

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
        // Real enforcement is the DB rate-limit trigger (migration 015); the
        // checks below are UX pre-checks only.

        // For anonymous reviews, check if they've already reviewed
        if (!data.student_id) {
          // Check if this device has already reviewed this teacher
          const canReview = anonymousTracker.canReviewTeacher(data.teacher_id);

          if (!canReview.allowed) {
            const hours = Math.floor((canReview.cooldownRemaining || 0) / (60 * 60 * 1000));
            throw new Error(
              `You have already reviewed this teacher. Anonymous users can only submit one review per teacher every 24 hours. Please try again in ${hours} hours.`
            );
          }

          const fingerprint = anonymousTracker.getFingerprint();

          // Reuse this device's prior anonymous row for the teacher instead of
          // always inserting — otherwise every cooldown expiry / localStorage
          // clear accumulates a duplicate row that skews the teacher's average.
          // Best-effort: still racy under true concurrency without a DB unique
          // index on (teacher_id, metadata->>fingerprint) where student_id is null.
          const { data: existingAnon } = await supabase
            .from('ratings')
            .select('id')
            .eq('teacher_id', data.teacher_id)
            .is('student_id', null)
            .eq('metadata->>fingerprint', fingerprint)
            .maybeSingle();

          let rating;
          if (existingAnon) {
            const { data: updated, error } = await supabase
              .from('ratings')
              .update({
                score: data.score,
                comment: data.comment,
                updated_at: new Date().toISOString(),
                metadata: { fingerprint, timestamp: Date.now() },
              })
              .eq('id', existingAnon.id)
              .select()
              .single();
            if (error) throw toFriendlyError(error);
            rating = updated;
          } else {
            const { data: inserted, error } = await supabase
              .from('ratings')
              .insert({
                teacher_id: data.teacher_id,
                student_id: null,
                score: data.score,
                comment: data.comment,
                metadata: { fingerprint, timestamp: Date.now() },
              })
              .select()
              .single();
            if (error) throw toFriendlyError(error);
            rating = inserted;
          }

          // Record the review locally
          anonymousTracker.recordReview(data.teacher_id);

          return rating;
        }
        
        // For logged-in users, first check if they have an existing review.
        // maybeSingle()+throw distinguishes "no row" from a real/transient error,
        // so a lookup failure doesn't silently fall through to a duplicate insert.
        const { data: existingRating, error: lookupError } = await supabase
          .from('ratings')
          .select('id')
          .eq('teacher_id', data.teacher_id)
          .eq('student_id', data.student_id)
          .maybeSingle();
        if (lookupError) throw lookupError;

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

          if (error) throw toFriendlyError(error);
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

          if (error) throw toFriendlyError(error);
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
        // SECURITY FIX: Verify ownership before updating
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          throw new Error('You must be logged in to update a rating');
        }

        // First, verify the rating belongs to the current user
        const { data: existingRating, error: fetchError } = await supabase
          .from('ratings')
          .select('student_id')
          .eq('id', id)
          .single();

        if (fetchError) {
          throw new Error('Rating not found');
        }

        if (existingRating.student_id !== user.id) {
          throw new Error('Unauthorized: You can only update your own ratings');
        }

        // Now update with double-check via RLS policy
        const { data: rating, error } = await supabase
          .from('ratings')
          .update(data)
          .eq('id', id)
          .eq('student_id', user.id) // Double-check ownership
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
        // SECURITY FIX: Verify ownership before deleting
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          throw new Error('You must be logged in to delete a rating');
        }

        // First, verify the rating belongs to the current user
        const { data: existingRating, error: fetchError } = await supabase
          .from('ratings')
          .select('student_id')
          .eq('id', id)
          .single();

        if (fetchError) {
          throw new Error('Rating not found');
        }

        if (existingRating.student_id !== user.id) {
          throw new Error('Unauthorized: You can only delete your own ratings');
        }

        // Now delete with double-check via RLS policy
        const { error } = await supabase
          .from('ratings')
          .delete()
          .eq('id', id)
          .eq('student_id', user.id); // Double-check ownership

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