import React, { Component, ReactNode } from 'react';
import { logger } from '../lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Error caught by boundary', error, { errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-base-200 dark:bg-gray-900">
          <div className="card w-96 bg-base-100 dark:bg-gray-800 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-error dark:text-red-400">Something went wrong</h2>
              <p className="text-sm opacity-70 dark:text-gray-300">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              <div className="card-actions justify-end mt-4">
                <button 
                  className="btn btn-primary dark:bg-purple-600 dark:hover:bg-purple-700 dark:border-purple-600"
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </button>
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