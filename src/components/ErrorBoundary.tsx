import React, { Component, ReactNode } from 'react';
import { logger } from '../lib/logger';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  resetKey?: string | number; // Add resetKey prop to reset error boundary
}

interface State {
  hasError: boolean;
  error?: Error;
  resetKey?: string | number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  static getDerivedStateFromProps(props: Props, state: State): State | null {
    // Reset error boundary when resetKey changes
    if (props.resetKey !== state.resetKey) {
      return {
        hasError: false,
        error: undefined,
        resetKey: props.resetKey,
      };
    }
    return null;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Error caught by boundary', error, { errorInfo });

    // Handle chunk load errors specifically
    if (error.name === 'ChunkLoadError' ||
        error.message.includes('Failed to fetch dynamically imported module') ||
        error.message.includes('Loading chunk')) {

      // Check if we've already tried to refresh
      const hasRefreshed = sessionStorage.getItem('error_page_refreshed');

      if (!hasRefreshed) {
        sessionStorage.setItem('error_page_refreshed', 'true');
        // Clear the flag after a delay
        setTimeout(() => sessionStorage.removeItem('error_page_refreshed'), 5000);
        // Force refresh to get new chunks
        window.location.reload();
      }
    }
  }

  getSafeErrorMessage(error?: Error): string {
    // Don't expose internal error details to users
    if (!error) return 'An unexpected error occurred. Please try again.';

    // Map known errors to user-friendly messages
    const errorMap: Record<string, string> = {
      'NetworkError': 'Connection error. Please check your internet connection.',
      'TypeError': 'Something went wrong. Please refresh the page.',
      'ReferenceError': 'Something went wrong. Please refresh the page.',
      'ChunkLoadError': 'Failed to load resources. Please refresh the page.',
      'Unauthorized': 'You need to sign in to access this page.',
      'Forbidden': 'You don\'t have permission to access this resource.',
    };

    // Check for known error types
    for (const [key, message] of Object.entries(errorMap)) {
      if (error.name === key || error.message.includes(key)) {
        return message;
      }
    }

    // Generic message for unknown errors
    return 'An unexpected error occurred. Please try again.';
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-dvh flex items-center justify-center bg-base-200">
          <div className="card w-96 bg-base-100 shadow-sm">
            <div className="card-body">
              <h2 className="card-title text-error">Something went wrong</h2>
              <p className="text-sm text-base-content/70">
                {this.getSafeErrorMessage(this.state.error)}
              </p>
              <div className="card-actions justify-end mt-4">
                <Button
                  variant="primary"
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
}