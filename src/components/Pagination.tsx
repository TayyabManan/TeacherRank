import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';
import { useMobileDetection } from '../lib/mobile';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

// Bespoke control (CLAUDE.md's tabs/pagination exemption): quiet ghost chips
// on the page ground, no borders, no wrapper card. The single accent mark is
// the current page. Chips keep the 44px touch minimum — which is also why
// mobile switches to the compact "Page X of Y" form at more than 3 pages:
// five-plus 44px chips overflow 320px-class viewports.
const CHIP =
  'min-w-11 min-h-11 px-2 inline-flex items-center justify-center rounded-lg text-sm font-medium tabular-nums transition-colors touch-manipulation';
const GHOST = 'text-base-content/70 hover:bg-base-200 hover:text-base-content';
const ARROW = `${CHIP} ${GHOST} disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-base-content/70 disabled:cursor-default`;

const ArrowButton: React.FC<{
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}> = ({ onClick, disabled, label, children }) => (
  <button type="button" className={ARROW} onClick={onClick} disabled={disabled} aria-label={label}>
    {children}
  </button>
);

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
}) => {
  // Shared definition of "mobile" — the same one the pages rendering this
  // component use, so the pager can't disagree with its page about breakpoints.
  const { mobile: isMobile } = useMobileDetection();

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('...');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('...');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const prev = (
    <ArrowButton onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} label="Previous page">
      <ChevronLeftIcon className="w-4 h-4" />
    </ArrowButton>
  );
  const next = (
    <ArrowButton onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} label="Next page">
      <ChevronRightIcon className="w-4 h-4" />
    </ArrowButton>
  );

  // Compact mobile form: arrows + "Page X of Y"
  if (isMobile && totalPages > 3) {
    return (
      <nav aria-label="Pagination" className={`flex items-center justify-center gap-2 ${className}`}>
        {prev}
        <span className="px-2 text-sm font-medium text-base-content/80 tabular-nums">
          Page {currentPage} of {totalPages}
        </span>
        {next}
      </nav>
    );
  }

  // Numbered chips for desktop, or when there are few pages
  return (
    <nav aria-label="Pagination" className={`flex items-center justify-center gap-1 ${className}`}>
      {prev}

      {getPageNumbers().map((page, index) => (
        <React.Fragment key={index}>
          {page === '...' ? (
            <span className="min-w-6 text-center text-sm text-base-content/50 select-none" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              type="button"
              className={`${CHIP} ${
                currentPage === page
                  ? 'bg-primary text-primary-content'
                  : GHOST
              }`}
              onClick={() => onPageChange(page as number)}
              aria-label={`Go to page ${page}`}
              aria-current={currentPage === page ? 'page' : undefined}
            >
              {page}
            </button>
          )}
        </React.Fragment>
      ))}

      {next}
    </nav>
  );
};
