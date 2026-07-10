import React, { useId } from 'react';
import { ChevronDownIcon } from './icons';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Required — filter selects often render without a visible label. */
  'aria-label': string;
  /** Optional visible label above the select. */
  label?: string;
  className?: string;
}

/**
 * Controlled select — the app's single filter-select look (appearance-none +
 * chevron). This is the plain-state counterpart to the RHF-only `FormSelect`.
 */
export function Select({
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
  label,
  className = '',
}: SelectProps) {
  const selectId = useId();

  return (
    <div className={className}>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-base-content/80 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={ariaLabel}
          className="w-full px-4 py-3 pr-10 bg-base-200 border border-base-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-200 text-base-content text-base touch-manipulation appearance-none"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/50 pointer-events-none" />
      </div>
    </div>
  );
}
