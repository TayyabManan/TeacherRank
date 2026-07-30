import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { signUpSchema, signInSchema, SignUpFormData, SignInFormData } from '../lib/validation';
import { isSafeInternalPath } from '../utils/safeRedirect';
import { useSignUp, useSignIn } from '../hooks/useAuth';
import { FormInput, FormSelect } from './FormInput';
import { PasswordChecklist } from './PasswordChecklist';
import { logger } from '../lib/logger';
import { supabase } from '../lib/supabaseClient';
import { useHaptic } from '../lib/haptic';
import { useMobileDetection, useKeyboardHeight } from '../lib/mobile';
import ForgotPassword from './ForgotPassword';
import { Button, buttonClasses } from './Button';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from './ToastContainer';

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const { toasts, showToast, removeToast } = useToast();

  // Failed OAuth callbacks are stashed by useAuthStateChange (App.tsx) before
  // it redirects here — show the reason instead of a silent bounce.
  useEffect(() => {
    const message = sessionStorage.getItem('oauthError');
    if (message) {
      sessionStorage.removeItem('oauthError');
      setOauthError(message);
    }
  }, []);
  const navigate = useNavigate();
  const location = useLocation();
  const haptic = useHaptic();

  // Where to send the user after they authenticate: back to the page they were
  // headed to (captured by ProtectedRoute), falling back to the dashboard. Only
  // internal paths are honored, and never /auth itself.
  const requestedFrom = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
  const redirectTo =
    isSafeInternalPath(requestedFrom) && requestedFrom !== '/auth'
      ? requestedFrom
      : '/dashboard';
  const { mobile } = useMobileDetection();
  const { keyboardHeight, isKeyboardOpen } = useKeyboardHeight();

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
        displayName: data.displayName,
      });
      haptic.success();
      // Don't navigate: the account needs email confirmation first (a redirect
      // to /dashboard just bounced back here). Flip to sign-in with the email
      // carried over and show the check-your-email notice there.
      signInForm.setValue('email', data.email);
      setIsSignUp(false);
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
        navigate(redirectTo, { replace: true });
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

      // OAuth does a full-page redirect, so router state is lost — stash the
      // intended destination for useAuthStateChange to consume after sign-in.
      if (redirectTo !== '/dashboard') {
        sessionStorage.setItem('postLoginRedirect', redirectTo);
      }

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
      showToast(errorMessage, 'error');
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center py-20 px-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <Helmet>
        <title>{isSignUp ? 'Sign Up' : 'Sign In'}</title>
        <meta name="description" content={isSignUp ? 'Create your Teacher Rank account to rate and review teachers' : 'Sign in to Teacher Rank to access your dashboard and continue rating teachers'} />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      
      <div className="w-full max-w-sm sm:max-w-md px-4 sm:px-0">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-base-content mb-2 sm:mb-3">
            {isSignUp ? 'Join TeacherRank' : 'Welcome Back'}
          </h1>
          <p className="text-sm sm:text-base md:text-lg text-base-content">
            {isSignUp 
              ? 'Create your account to start rating teachers' 
              : 'Sign in to continue to your dashboard'}
          </p>
        </div>
        
        <div className="bg-base-100 backdrop-blur-md rounded-lg sm:rounded-lg shadow-md border border-base-300 p-6 sm:p-8">
          {showForgotPassword ? (
            <ForgotPassword onBack={() => setShowForgotPassword(false)} />
          ) : (
            renderFormContent()
          )}
        </div>
        
        {renderTrustIndicators()}
      </div>
    </div>
  );

  function renderFormContent() {
    const linkClass = "text-base-content hover:text-primary underline font-medium text-sm sm:text-base";

    const dividerClass = "divider before:bg-base-300 after:bg-base-300 text-base-content/70 my-3 sm:my-4 text-xs sm:text-sm";

    return (
      <div className="space-y-4">
        {oauthError && (
          <div role="alert" className="bg-error/20 backdrop-blur-sm border border-error/30 rounded-lg p-3 text-error-content">
            <span>Sign-in didn't complete: {oauthError}. Please try again.</span>
          </div>
        )}

        {/* OAuth Sign In Buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => handleOAuthSignIn('google')}
            disabled={isLoading !== null || signInMutation.isPending || signUpMutation.isPending}
            className={`w-full flex items-center justify-center gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3 bg-base-100 text-base-content rounded-lg font-semibold hover:bg-base-200 transition-all border border-base-300 text-sm sm:text-base ${
              mobile ? 'touch-target-tall touch-manipulation' : ''
            }`}
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
            {signUpMutation.isSuccess && (
              <div role="alert" className="bg-success/20 backdrop-blur-sm border border-success/30 rounded-lg p-3 text-success-content">
                <span>Account created! Check your email to confirm it, then sign in below.</span>
              </div>
            )}

            <FormInput
              label="Email"
              name="email"
              type="email"
              register={signInForm.register}
              error={signInForm.formState.errors.email}
              required
              autoComplete="email"
              autoFocus
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
              <div role="alert" className="bg-error/20 backdrop-blur-sm border border-error/30 rounded-lg p-3 text-error-content">
                <span>{(signInMutation.error as Error).message}</span>
              </div>
            )}

            <div className="space-y-3 mt-4 sm:mt-6">
              <div className="flex justify-end">
                <button
                  type="button"
                  className={`${linkClass} text-xs sm:text-sm ${mobile ? 'touch-manipulation' : ''}`}
                  onClick={() => {
                    haptic.light();
                    setShowForgotPassword(true);
                  }}
                >
                  Forgot Password?
                </button>
              </div>

              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-4">
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
                <Button
                  variant="primary"
                  type="submit"
                  touch={mobile ? 'tall' : undefined}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base w-full sm:w-auto"
                  loading={signInMutation.isPending}
                >
                  Sign In
                </Button>
              </div>
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
              autoFocus
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
            <PasswordChecklist password={signUpForm.watch('password') ?? ''} />

            {signUpMutation.error && (
              <div role="alert" className="bg-error/20 backdrop-blur-sm border border-error/30 rounded-lg p-3 text-error-content">
                <span>{(signUpMutation.error as Error).message}</span>
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
              <Button
                variant="primary"
                type="submit"
                touch={mobile ? 'tall' : undefined}
                className="px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold text-sm sm:text-base w-full sm:w-auto"
                loading={signUpMutation.isPending}
              >
                Sign Up
              </Button>
            </div>
          </form>
        )}
      </div>
    );
  }

  function renderTrustIndicators() {
    const textClass = "text-base-content";

    const linkClass = "text-primary underline hover:text-primary-focus";

    return (
      <div className="text-center space-y-2 sm:space-y-3 mt-4 sm:mt-6">
        <div className={`flex items-center justify-center gap-2 text-xs sm:text-sm ${textClass}`}>
          <svg className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-success flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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