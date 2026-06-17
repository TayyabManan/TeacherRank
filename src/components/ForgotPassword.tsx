import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, ForgotPasswordFormData } from '../lib/validation';
import { sendPasswordResetEmail } from '../lib/auth';
import { FormInput } from './FormInput';
import { logger } from '../lib/logger';
import { useHaptic } from '../lib/haptic';
import { useMobileDetection } from '../lib/mobile';
import { Button } from './Button';

interface ForgotPasswordProps {
  onBack: () => void;
  isAppContext?: boolean;
}

export default function ForgotPassword({ onBack, isAppContext = false }: ForgotPasswordProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDev, setIsDev] = useState(false);
  const haptic = useHaptic();
  const { mobile } = useMobileDetection();

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const handleSubmit = async (data: ForgotPasswordFormData) => {
    haptic.medium();
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendPasswordResetEmail(data.email);

      if (result.success) {
        setIsSuccess(true);
        setIsDev(result.isDev || false);
        haptic.success();
      } else {
        setError(result.error || 'Failed to send reset email');
        setIsDev(result.isDev || false);
        haptic.error();
      }
    } catch (error) {
      logger.error('Password reset request failed', error);
      setError('An unexpected error occurred. Please try again.');
      haptic.error();
    } finally {
      setIsLoading(false);
    }
  };

  const linkClass = isAppContext
    ? "btn btn-link text-sm sm:text-base"
    : "text-base-content/80 hover:text-primary underline font-medium text-sm sm:text-base";

  if (isSuccess) {
    return (
      <div className="space-y-4 text-center">
        <div className="w-16 h-16 mx-auto bg-success/10 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-base-content mb-2">
            Reset Email Sent
          </h3>
          <p className="text-sm text-base-content/70 mb-6">
            We've sent a password reset link to your email address. Please check your inbox and follow the instructions to reset your password.
          </p>

          {isDev && (
            <div className="bg-info/10 border border-info/30 rounded-lg p-3 mb-4">
              <p className="text-xs text-info">
                <strong>Development Mode:</strong> Check your Supabase Dashboard → Authentication → Logs to see the email details, or configure SMTP in Authentication → Email settings.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={onBack}
            className={`${linkClass} ${mobile ? 'touch-manipulation touch-target-tall' : ''}`}
          >
            Back to Sign In
          </button>

          <p className="text-xs text-base-content/70">
            Didn't receive the email? Check your spam folder or try again in a few minutes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-base-content mb-2">
          Reset Your Password
        </h2>
        <p className="text-sm text-base-content/70">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4" noValidate>
        <FormInput
          label="Email"
          name="email"
          type="email"
          register={form.register}
          error={form.formState.errors.email}
          required
          autoComplete="email"
          placeholder="you@example.com"
        />

        {error && (
          <div role="alert" className={isAppContext
            ? "alert alert-error mt-4"
            : "bg-error/10 border border-error/30 rounded-lg p-3 text-error"
          }>
            <span>{error}</span>
            {isDev && error.includes('Email service not configured') && (
              <div className="mt-2 pt-2 border-t border-error/30">
                <p className="text-xs">
                  <strong>Quick fixes:</strong>
                  <br />• Check Supabase Dashboard → Auth → Logs for reset links
                  <br />• Configure SMTP in Auth → Email Settings
                  <br />• Or use Magic Link sign-in as alternative
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 mt-6">
          <Button
            type="submit"
            variant="primary"
            block
            loading={isLoading}
            touch={mobile ? 'tall' : undefined}
          >
            {isLoading ? 'Sending Reset Email...' : 'Send Reset Email'}
          </Button>

          <button
            type="button"
            onClick={onBack}
            className={`${linkClass} ${mobile ? 'touch-manipulation touch-target-tall' : ''}`}
          >
            Back to Sign In
          </button>
        </div>
      </form>
    </div>
  );
}