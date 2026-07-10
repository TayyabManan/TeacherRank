import React from 'react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  /** Human copy only — never a raw `error.message`. */
  message: string;
  onRetry?: () => void;
  /** Alternative escape hatch (e.g. a styled Link elsewhere). */
  secondaryAction?: React.ReactNode;
}

/**
 * In-page error card with a retry path. Callers write what happened and what
 * to do in plain words; raw error objects go to the logger, not the user.
 */
export function ErrorState({ title, message, onRetry, secondaryAction }: ErrorStateProps) {
  return (
    <div role="alert" className="bg-error/10 border border-error/30 rounded-lg p-6 text-center">
      {title && <h3 className="text-lg font-bold text-base-content mb-1">{title}</h3>}
      <p className="text-error font-medium">{message}</p>
      {(onRetry || secondaryAction) && (
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {onRetry && (
            <Button variant="outline" onClick={onRetry}>
              Try again
            </Button>
          )}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
