import React from 'react';

interface SectionHeadingProps {
  children: React.ReactNode;
  /** Heading level — pick to keep the page outline sequential (no h1→h3 skips). */
  as?: 'h2' | 'h3';
  /** Right-aligned extras (count badge, small action). */
  actions?: React.ReactNode;
  className?: string;
}

/** The app's accent-bar section header (vertical primary bar + bold title). */
export function SectionHeading({ children, as = 'h2', actions, className = '' }: SectionHeadingProps) {
  const Tag = as;
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-1 md:w-1.5 h-6 md:h-7 bg-primary rounded-full shrink-0" aria-hidden="true" />
        <Tag className="text-xl md:text-2xl font-bold text-base-content">{children}</Tag>
      </div>
      {actions}
    </div>
  );
}
