import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { signUpSchema, signInSchema, SignUpFormData, SignInFormData } from '../lib/validation';
import { useSignUp, useSignIn } from '../hooks/useAuth';
import { FormInput, FormSelect } from './FormInput';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabaseClient';
import { useHaptic } from '../lib/haptic';
import { useMobileDetection, useKeyboardHeight } from '../lib/mobile';

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const haptic = useHaptic();
  const { mobile } = useMobileDetection();
  const { keyboardHeight, isKeyboardOpen } = useKeyboardHeight();
  
  const isAppContext = false; // Remove app context check since we're moving to root paths
  
  const signUpMutation = useSignUp();
  const signInMutation = useSignIn();

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
  });

  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
  });

  const handleSignUp = async (data: SignUpFormData) => {
    haptic.medium();
    try {
      await signUpMutation.mutateAsync({
        email: data.email,
        password: data.password,
        role: 'student', // Default role for all users
        displayName: data.displayName,
      });
      haptic.success();
      navigate('/dashboard');
    } catch (error) {
      haptic.error();
      logger.error('Sign up failed', error);
    }
  };

  const handleSignIn = async (data: SignInFormData) => {
    haptic.medium();
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Sign in timeout. Please check your connection and try again.')), 15000)
      );
      
      const signInPromise = signInMutation.mutateAsync(data);
      
      await Promise.race([signInPromise, timeoutPromise]);
      haptic.success();
      // Navigate to app after a small delay to ensure state is updated
      setTimeout(() => {
        navigate('/dashboard');
      }, 100);
    } catch (error) {
      haptic.error();
      logger.error('Sign in failed', error);
    }
  };

  const handleOAuthSignIn = async (provider: 'google') => {
    haptic.light();
    try {
      setIsLoading(provider);
      
      const timeoutId = setTimeout(() => {
        if (isLoading === provider) {
          setIsLoading(null);
          logger.error('OAuth redirect timeout');
        }
      }, 15000);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          skipBrowserRedirect: false,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      });

      if (error) {
        clearTimeout(timeoutId);
        throw error;
      }
      
      setTimeout(() => {
        clearTimeout(timeoutId);
        if (isLoading === provider) {
          setIsLoading(null);
        }
      }, 3000);
    } catch (error) {
      haptic.error();
      logger.error(`${provider} sign in failed`, error);
      setIsLoading(null);
      const errorMessage = error instanceof Error ? error.message : 'Sign in failed. Please try again.';
      const alertEl = document.createElement('div');
      alertEl.className = 'alert alert-error fixed top-4 right-4 z-50 max-w-md';
      const spanEl = document.createElement('span');
      spanEl.textContent = errorMessage;
      alertEl.appendChild(spanEl);
      document.body.appendChild(alertEl);
      setTimeout(() => alertEl.remove(), 5000);
    }
  };

  // App context - clean design for use within the app
  if (isAppContext) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center py-8 px-4">
        <Helmet>
          <title>{isSignUp ? 'Sign Up' : 'Sign In'} - Teacher Rank</title>
          <meta name="description" content={isSignUp ? 'Create your Teacher Rank account to rate and review teachers' : 'Sign in to Teacher Rank to access your dashboard and continue rating teachers'} />
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {isSignUp ? 'Join TeacherRank' : 'Welcome Back'}
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
              {isSignUp 
                ? 'Create your account to start rating teachers' 
                : 'Sign in to continue to your dashboard'}
            </p>
          </div>
          
          <div className="card shadow-xl bg-base-100 dark:bg-gray-800 dark:shadow-gray-700/50">
            <div className="card-body p-6 lg:p-8">
              {renderFormContent()}
            </div>
          </div>
          
          {renderTrustIndicators()}
        </div>
      </div>
    );
  }

  // Landing context - glassmorphic design
  return (
    <div className="min-h-screen flex items-center justify-center py-20 px-4">
      <Helmet>
        <title>{isSignUp ? 'Sign Up' : 'Sign In'} - Teacher Rank</title>
        <meta name="description" content={isSignUp ? 'Create your Teacher Rank account to rate and review teachers' : 'Sign in to Teacher Rank to access your dashboard and continue rating teachers'} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      <div className="w-full max-w-sm sm:max-w-md px-4 sm:px-0">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3" 
              style={{ textShadow: '2px 2px 4px rgba(255, 255, 255, 0.5)' }}>
            {isSignUp ? 'Join TeacherRank' : 'Welcome Back'}
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-gray-800 dark:text-gray-200">
            {isSignUp 
              ? 'Create your account to start rating teachers' 
              : 'Sign in to continue to your dashboard'}
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
          {renderFormContent()}
        </div>
        
        {renderTrustIndicators()}
      </div>
    </div>
  );

  function renderFormContent() {
    const buttonClass = isAppContext
      ? "btn btn-primary dark:bg-blue-600 dark:hover:bg-blue-700 dark:border-blue-600 w-full sm:w-auto"
      : "px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-full font-semibold hover:from-purple-700 hover:to-purple-800 transition-all text-sm sm:text-base w-full sm:w-auto";

    const linkClass = isAppContext
      ? "btn btn-link dark:text-blue-400 dark:hover:text-blue-300 text-sm sm:text-base"
      : "text-gray-800 dark:text-gray-200 hover:text-purple-600 dark:hover:text-purple-400 underline font-medium text-sm sm:text-base";

    const dividerClass = isAppContext
      ? "divider dark:before:bg-gray-600 dark:after:bg-gray-600 dark:text-gray-400 my-3 sm:my-4 text-xs sm:text-sm"
      : "divider before:bg-gray-300 dark:before:bg-gray-600 after:bg-gray-300 dark:after:bg-gray-600 text-gray-600 dark:text-gray-400 my-3 sm:my-4 text-xs sm:text-sm";

    return (
      <div className="space-y-4">
        {/* OAuth Sign In Buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleOAuthSignIn('google')}
            disabled={isLoading !== null || signInMutation.isPending || signUpMutation.isPending}
            className={isAppContext 
              ? `btn btn-outline w-full gap-3 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white relative ${
                  mobile ? 'min-h-[48px] touch-manipulation text-base' : ''
                }`
              : `w-full flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-full font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-all border border-gray-300 dark:border-gray-600 text-sm sm:text-base ${
                  mobile ? 'min-h-[48px] touch-manipulation' : ''
                }`
            }
          >
            {isLoading === 'google' ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                <span>Redirecting to Google...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>
        </div>
        
        {/* Divider */}
        <div className={dividerClass}>OR</div>
        
        {!isSignUp ? (
          <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-4" noValidate>
            <FormInput
              label="Email"
              name="email"
              type="email"
              register={signInForm.register}
              error={signInForm.formState.errors.email}
              required
              autoComplete="email"
            />
            
            <FormInput
              label="Password"
              name="password"
              type="password"
              register={signInForm.register}
              error={signInForm.formState.errors.password}
              required
              autoComplete="current-password"
            />

            {signInMutation.error && (
              <div role="alert" className={isAppContext 
                ? "alert alert-error mt-4 dark:bg-red-900 dark:border-red-700 dark:text-red-100"
                : "bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-lg p-3 text-red-900"
              }>
                <span>{(signInMutation.error as Error).message}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-4 mt-4 sm:mt-6">
              <button
                type="button"
                className={`${linkClass} ${mobile ? 'touch-manipulation' : ''}`}
                onClick={() => {
                  haptic.light();
                  setIsSignUp(true);
                }}
              >
                Need an account?
              </button>
              <button
                type="submit"
                className={`${buttonClass} ${mobile ? 'min-h-[48px] touch-manipulation' : ''}`}
                disabled={signInMutation.isPending}
              >
                {signInMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4" noValidate>
            <FormInput
              label="Email"
              name="email"
              type="email"
              register={signUpForm.register}
              error={signUpForm.formState.errors.email}
              required
              autoComplete="email"
            />
            
            <FormInput
              label="Display Name"
              name="displayName"
              register={signUpForm.register}
              error={signUpForm.formState.errors.displayName}
              autoComplete="name"
            />
            
            <FormInput
              label="Password"
              name="password"
              type="password"
              register={signUpForm.register}
              error={signUpForm.formState.errors.password}
              required
              autoComplete="new-password"
            />
            
            <FormInput
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              register={signUpForm.register}
              error={signUpForm.formState.errors.confirmPassword}
              required
              autoComplete="new-password"
            />
            {signUpMutation.error && (
              <div role="alert" className={isAppContext 
                ? "alert alert-error mt-4 dark:bg-red-900 dark:border-red-700 dark:text-red-100"
                : "bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-lg p-3 text-red-900"
              }>
                <span>{(signUpMutation.error as Error).message}</span>
              </div>
            )}

            {signUpMutation.isSuccess && (
              <div role="alert" className={isAppContext 
                ? "alert alert-success mt-4 dark:bg-green-900 dark:border-green-700 dark:text-green-100"
                : "bg-green-500/20 backdrop-blur-sm border border-green-500/30 rounded-lg p-3 text-green-900"
              }>
                <span>Account created! Check your email for confirmation.</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-4 mt-4 sm:mt-6">
              <button
                type="button"
                className={`${linkClass} ${mobile ? 'touch-manipulation' : ''}`}
                onClick={() => {
                  haptic.light();
                  setIsSignUp(false);
                }}
              >
                Already have an account?
              </button>
              <button
                type="submit"
                className={`${buttonClass} ${mobile ? 'min-h-[48px] touch-manipulation' : ''}`}
                disabled={signUpMutation.isPending}
              >
                {signUpMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Sign Up'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  function renderTrustIndicators() {
    const textClass = isAppContext
      ? "text-gray-600 dark:text-gray-400"
      : "text-gray-700 dark:text-gray-300";

    const linkClass = isAppContext
      ? "text-purple-600 dark:text-purple-400 hover:underline"
      : "text-purple-600 dark:text-purple-400 underline hover:text-purple-700 dark:hover:text-purple-300";

    return (
      <div className="text-center space-y-2 sm:space-y-3 mt-4 sm:mt-6">
        <div className={`flex items-center justify-center gap-2 text-xs sm:text-sm ${textClass}`}>
          <svg className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
          </svg>
          <span>Secure authentication powered by Supabase</span>
        </div>
        
        <p className={`${textClass} ${mobile ? 'text-xs' : 'text-sm'}`}>
          By signing {isSignUp ? 'up' : 'in'}, you agree to our{' '}
          <Link 
            to="/terms" 
            className={`${linkClass} ${mobile ? 'touch-manipulation' : ''}`}
            onClick={() => haptic.light()}
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link 
            to="/privacy" 
            className={`${linkClass} ${mobile ? 'touch-manipulation' : ''}`}
            onClick={() => haptic.light()}
          >
            Privacy Policy
          </Link>
        </p>
      </div>
    );
  }
}