import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
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
          console.error('Session error:', sessionError);
          return null;
        }
        
        console.log('Current session:', session);
        
        if (session?.user) {
          console.log('User found in session:', session.user);
          return session.user;
        }
        
        // If no session, return null
        console.log('No session found');
        return null;
      } catch (error) {
        console.error('Failed to get user:', error);
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
  role: 'student' | 'teacher';
  displayName?: string;
}

export function useSignUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, password, role, displayName }: SignUpData) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      // Create profile
      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            email,
            role,
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
      console.log('Sign in successful, user:', data.user);
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

// Hook to handle OAuth session and create profile if needed
export function useAuthStateChange() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log('Auth state changed:', event, session?.user);
      
      // Update user query data immediately when auth state changes
      if (session?.user) {
        queryClient.setQueryData(['user'], session.user);
      } else {
        queryClient.setQueryData(['user'], null);
      }
      
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          // Check if profile exists with timeout
          const profilePromise = supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
          );
          
          const { data: profile, error: profileError } = await Promise.race([
            profilePromise,
            timeoutPromise
          ]).catch(err => ({ data: null, error: err })) as any;

          // If no profile exists, create one
          if (profileError && profileError.code === 'PGRST116') {
            const { error: createError } = await supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                email: session.user.email!,
                display_name: session.user.user_metadata?.full_name || 
                             session.user.user_metadata?.name || 
                             session.user.email?.split('@')[0],
                role: 'student', // Default role for OAuth users
              });

            if (createError) {
              console.error('Failed to create profile:', createError);
            }
          }
        } catch (error) {
          console.error('Error handling auth state change:', error);
        }

        // Invalidate queries to refresh user data
        if (mounted) {
          queryClient.invalidateQueries({ queryKey: ['user'] });
          queryClient.invalidateQueries({ queryKey: ['profile'] });
        }

        // After OAuth sign-in (a full-page redirect, so router state is lost),
        // return the user to where they were headed if a destination was stashed.
        if (mounted) {
          const dest = sessionStorage.getItem('postLoginRedirect');
          if (dest) {
            sessionStorage.removeItem('postLoginRedirect');
            if (dest.startsWith('/') && !dest.startsWith('//') && dest !== window.location.pathname) {
              navigate(dest, { replace: true });
            }
          }
        }
      }

      if (event === 'SIGNED_OUT' && mounted) {
        queryClient.clear();
        // Don't automatically redirect - let each page handle this
        // navigate('/auth');
      }
      
      if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed successfully');
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