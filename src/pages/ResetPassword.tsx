import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { resetPasswordSchema, ResetPasswordFormData } from '../lib/validation';
import { updatePassword } from '../lib/auth';
import { FormInput } from '../components/FormInput';
import { logger } from '../lib/logger';
import { useHaptic } from '../lib/haptic';
import { useMobileDetection } from '../lib/mobile';
import { supabase } from '../lib/supabaseClient';

export default function ResetPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const haptic = useHaptic();
  const { mobile } = useMobileDetection();

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    // Check if we have the necessary URL parameters for password reset
    const checkResetToken = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          logger.error('Error checking session for password reset', error);
          setIsValidToken(false);
          return;
        }

        // If there's a session, it means the reset token is valid
        if (session) {
          setIsValidToken(true);
        } else {
          // Check URL parameters for token
          const accessToken = searchParams.get('access_token');
          const refreshToken = searchParams.get('refresh_token');

          if (accessToken && refreshToken) {
            // Set the session manually
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (setSessionError) {
              logger.error('Error setting session for password reset', setSessionError);
              setIsValidToken(false);
            } else {
              setIsValidToken(true);
            }
          } else {
            setIsValidToken(false);
          }
        }
      } catch (error) {
        logger.error('Error validating reset token', error);
        setIsValidToken(false);
      }
    };

    checkResetToken();
  }, [searchParams]);

  const handleSubmit = async (data: ResetPasswordFormData) => {
    haptic.medium();
    setIsLoading(true);
    setError(null);

    try {
      const result = await updatePassword(data.password);

      if (result.success) {
        setIsSuccess(true);
        haptic.success();

        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      } else {
        setError(result.error || 'Failed to update password');
        haptic.error();
      }
    } catch (error) {
      logger.error('Password update failed', error);
      setError('An unexpected error occurred. Please try again.');
      haptic.error();
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state while checking token validity
  if (isValidToken === null) {
    return (
      <div className="min-h-screen flex items-center justify-center py-20 px-4">
        <Helmet>
          <title>Reset Password - Teacher Rank</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>

        <div className="text-center">
          <div className="loading loading-spinner loading-lg"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Validating reset link...</p>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (!isValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center py-20 px-4">
        <Helmet>
          <title>Reset Password - Teacher Rank</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>

        <div className="w-full max-w-md text-center">
          <div className="bg-white dark:bg-gray-800 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
            <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>

            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Invalid Reset Link
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              This password reset link is invalid or has expired. Please request a new password reset.
            </p>

            <button
              onClick={() => navigate('/auth')}
              className={`px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-full font-semibold hover:from-purple-700 hover:to-purple-800 transition-all text-sm sm:text-base w-full ${
                mobile ? 'min-h-[48px] touch-manipulation' : ''
              }`}
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center py-20 px-4">
        <Helmet>
          <title>Password Reset Successful - Teacher Rank</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>

        <div className="w-full max-w-md text-center">
          <div className="bg-white dark:bg-gray-800 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
            <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Password Updated Successfully
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Your password has been updated. You will be redirected to your dashboard shortly.
            </p>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="loading loading-spinner loading-sm"></span>
              Redirecting to dashboard...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Reset password form
  return (
    <div className="min-h-screen flex items-center justify-center py-20 px-4">
      <Helmet>
        <title>Reset Password - Teacher Rank</title>
        <meta name="description" content="Create a new password for your Teacher Rank account" />
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3">
            Create New Password
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
            Please enter your new password below
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 backdrop-blur-md rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4" noValidate>
            <FormInput
              label="New Password"
              name="password"
              type="password"
              register={form.register}
              error={form.formState.errors.password}
              required
              autoComplete="new-password"
              placeholder="Enter your new password"
            />

            <FormInput
              label="Confirm New Password"
              name="confirmPassword"
              type="password"
              register={form.register}
              error={form.formState.errors.confirmPassword}
              required
              autoComplete="new-password"
              placeholder="Confirm your new password"
            />

            {error && (
              <div role="alert" className="bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-lg p-3 text-red-900 dark:text-red-100">
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              className={`px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-full font-semibold hover:from-purple-700 hover:to-purple-800 transition-all text-sm sm:text-base w-full ${
                mobile ? 'min-h-[48px] touch-manipulation' : ''
              }`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Updating Password...
                </>
              ) : (
                'Update Password'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}