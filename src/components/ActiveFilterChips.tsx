import React from 'react';
import { Button } from './Button';

type Tone = 'info' | 'success' | 'warning' | 'primary' | 'neutral';

const TONE: Record<Tone, string> = {
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  primary: 'bg-primary/20 text-primary',
  neutral: 'bg-base-200 text-base-content/80',
};

export interface FilterChip {
  key: string;
  label: string;
  /** Small leading icon (from icons.tsx). */
  icon?: React.ReactNode;
  tone?: Tone;
}

interface ActiveFilterChipsProps {
  filters: FilterChip[];
  onClearAll: () => void;
  className?: string;
}

/** The "Active filters: [chips] Clear all" row shown under filter bars. */
export function ActiveFilterChips({ filters, onClearAll, className = '' }: ActiveFilterChipsProps) {
  if (filters.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-xs text-base-content/70">Active filters:</span>
      {filters.map((filter) => (
        <span
          key={filter.key}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs ${TONE[filter.tone ?? 'neutral']}`}
        >
          {filter.icon}
          {filter.label}
        </span>
      ))}
      <Button variant="ghost" size="xs" onClick={onClearAll} className="text-error">
        Clear all
      </Button>
    </div>
  );
}
