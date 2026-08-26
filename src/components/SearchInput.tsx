import React, { useId } from 'react';
import { SearchIcon, CloseIcon } from './icons';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Required — search boxes often render without a visible label. */
  'aria-label': string;
  /** Optional visible label above the input. */
  label?: string;
  placeholder?: string;
  /** Extra work to run when the clear-X is pressed (the box always clears itself). */
  onClear?: () => void;
  className?: string;
}

/**
 * Controlled search box — the app's single search-input look (leading icon,
 * clear-X with a 44px touch target). Controlled by design so "Clear all
 * filters" actually empties the box.
 */
export function SearchInput({
  value,
  onChange,
  'aria-label': ariaLabel,
  label,
  placeholder = 'Search...',
  onClear,
  className = '',
}: SearchInputProps) {
  const inputId = useId();

  const handleClear = () => {
    onChange('');
    onClear?.();
  };

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-base-content/80 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/50 pointer-events-none" />
        <input
          id={inputId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          dir="auto"
          className={`w-full pl-10 py-3 bg-base-200 border border-base-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all duration-200 text-base-content placeholder-base-content/60 text-base touch-manipulation ${
            value ? 'pr-12' : 'pr-4'
          }`}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className="absolute right-0 top-1/2 -translate-y-1/2 touch-target flex items-center justify-center text-base-content/50 hover:text-base-content hover:bg-base-300 rounded-lg transition-colors"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
