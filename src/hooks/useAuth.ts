import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { logger } from '../lib/logger';
import type { Profile } from '../types';
import type { User } from '@supabase/supabase-js';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useUser() {
  return useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      try {
        // Get the current session from Supabase
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          logger.error('Session fetch failed', sessionError);
          return null;
        }

        if (session?.user) {
          return session.user;
        }

        // If no session, return null
        return null;
      } catch (error) {
        logger.error('Failed to get user', error);
        return null;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false, // Don't retry to prevent delays
    refetchOnWindowFocus: true, // Refetch when window regains focus
    refetchOnMount: true, // Always refetch on mount
  });
}

export function useProfile(userId?: string) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data as Profile;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

interface SignUpData {
  email: string;
  password: string;
  displayName?: string;
}

export function useSignUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, password, displayName }: SignUpData) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      // Create profile. 'user' is the only role the DB accepts from
      // self-service writes (profiles_role_check constraint + the
      // "Users can insert own profile" RLS policy).
      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            email,
            role: 'user',
            display_name: displayName,
          });

        if (profileError) throw profileError;
      }

      return data;
    },
    onSuccess: (data) => {
      if (data.user) {
        queryClient.setQueryData(['user'], data.user);
      }
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

interface SignInData {
  email: string;
  password: string;
}

export function useSignIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, password }: SignInData) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // Set the user data immediately
      queryClient.setQueryData(['user'], data.user);
      // Then invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
    onSuccess: () => {
      // Explicitly set user to null before clearing
      queryClient.setQueryData(['user'], null);
      queryClient.clear();
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Profile> & { id: string }) => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return profile;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profile', variables.id] });
    },
  });
}

// Convenience hook that returns both user and loading state
export function useAuth() {
  const { data: user, isLoading } = useUser();
  return { user, isLoading };
}

// The effect below re-subscribes whenever `navigate` changes identity (every
// pathname change under BrowserRouter), and auth-js re-emits INITIAL_SESSION
// to each fresh subscription — so the ensure-profile work must be limited to
// once per user per page load, not once per subscription.
const profileEnsuredFor = new Set<string>();

// Hook to handle OAuth session and create profile if needed.
// Mount exactly once (App.tsx) — a second subscription doubles every handler.
export function useAuthStateChange() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;

    // GoTrue reports OAuth callback failures as error params on the redirect
    // URL (e.g. ?error=invalid_request&error_description=...). Nothing else
    // reads them, so surface the message on the sign-in page instead of
    // silently dropping the user wherever the redirect landed. Expired
    // password-reset links carry the same params but land on /reset-password,
    // which renders its own "Invalid Reset Link" screen — leave those alone.
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const oauthErrorDescription = search.get('error_description') || hash.get('error_description');
    if (oauthErrorDescription && window.location.pathname !== '/reset-password') {
      sessionStorage.setItem('oauthError', oauthErrorDescription);
      window.history.replaceState(null, '', window.location.pathname);
      navigate('/auth', { replace: true });
    }

    // Make sure the signed-in user has a profiles row, creating one if it's
    // missing. Runs OUTSIDE the onAuthStateChange callback (see below).
    // 'user' is the only role the DB accepts from self-service inserts
    // (profiles_role_check constraint + "Users can insert own profile" policy).
    const ensureProfile = async (user: User) => {
      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single();

        if (profileError && profileError.code === 'PGRST116') {
          const { error: createError } = await supabase
            .from('profiles')
            .upsert({
              id: user.id,
              email: user.email!,
              display_name: user.user_metadata?.full_name ||
                           user.user_metadata?.name ||
                           user.email?.split('@')[0],
              role: 'user',
            }, { ignoreDuplicates: true });

          if (createError) {
            logger.error('Failed to create profile', createError);
          } else {
            // A row was actually created — refresh consumers waiting on it.
            // (queryClient outlives this subscription, so no mounted check:
            // the effect re-subscribes on every navigation and this must run
            // even if that happened in between.)
            queryClient.invalidateQueries({ queryKey: ['user'] });
            queryClient.invalidateQueries({ queryKey: ['profile'] });
          }
        }
      } catch (error) {
        logger.error('Error ensuring profile exists', error);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      logger.debug('Auth state changed', { event });

      // Update user query data immediately when auth state changes
      if (session?.user) {
        queryClient.setQueryData(['user'], session.user);
      } else {
        queryClient.setQueryData(['user'], null);
      }

      if (
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') &&
        session?.user &&
        !profileEnsuredFor.has(session.user.id)
      ) {
        // auth-js emits events while holding its initialization lock, and any
        // awaited supabase query inside this callback deadlocks against that
        // lock (the query's fetch waits on the same initialization). Defer all
        // DB work until after the callback returns. INITIAL_SESSION is
        // included so users whose profile creation failed in the past are
        // healed on the next page load, not only on a fresh sign-in.
        // Mark before scheduling so SIGNED_IN + INITIAL_SESSION (both fire on
        // an OAuth callback) don't double-schedule; once scheduled it always
        // runs — a mounted check here would let the navigation-driven
        // re-subscribe cancel the only attempt while the set blocks retries.
        profileEnsuredFor.add(session.user.id);
        const user = session.user;
        setTimeout(() => {
          void ensureProfile(user);
        }, 0);
      }

      if (event === 'SIGNED_IN' && session?.user) {
        // After OAuth sign-in (a full-page redirect, so router state is lost),
        // return the user to where they were headed if a destination was stashed.
        const dest = sessionStorage.getItem('postLoginRedirect');
        if (dest) {
          sessionStorage.removeItem('postLoginRedirect');
          if (dest.startsWith('/') && !dest.startsWith('//') && dest !== window.location.pathname) {
            navigate(dest, { replace: true });
          }
        }
      }

      if (event === 'SIGNED_OUT') {
        queryClient.clear();
        // Don't automatically redirect - let each page handle this
        // navigate('/auth');
      }

      if (event === 'USER_UPDATED') {
        queryClient.invalidateQueries({ queryKey: ['user'] });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, queryClient]);
}