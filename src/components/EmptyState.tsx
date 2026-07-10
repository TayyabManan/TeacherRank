import React from 'react';

interface EmptyStateProps {
  /** Decorative icon (from icons.tsx); rendered in a muted circle. */
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  /** Guided next step — always try to provide one (a Button or styled Link). */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Empty state with a guided next step. Prefer passing an `action` — a dead-end
 * empty state is a UX bug (see the TeacherListing "request this teacher" flow).
 */
export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      {icon && (
        <div className="w-16 h-16 mx-auto mb-4 bg-base-200 rounded-full flex items-center justify-center text-base-content/40">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-bold text-base-content/70 mb-2">{title}</h3>
      {description && <p className="text-base-content/70 mb-4">{description}</p>}
      {action}
    </div>
  );
}
