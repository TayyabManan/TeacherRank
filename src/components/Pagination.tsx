import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = isMobile ? 3 : 7; // Show fewer pages on mobile

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (isMobile) {
        // Mobile: Show current page and maybe one neighbor
        if (currentPage > 2) {
          pages.push('...');
        }

        if (currentPage > 1 && currentPage < totalPages) {
          pages.push(currentPage);
        }

        if (currentPage < totalPages - 1) {
          pages.push('...');
        }
      } else {
        // Desktop: Original logic
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
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  // Mobile-optimized display showing current page info
  if (isMobile && totalPages > 5) {
    return (
      <div className={`flex items-center justify-center gap-2 ${className}`}>
        <Button
          variant="default"
          size="sm"
          touch="default"
          className="!min-h-11"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </Button>

        {/* Page indicator for mobile */}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-base-content/80">
            Page {currentPage} of {totalPages}
          </span>
        </div>

        <Button
          variant="default"
          size="sm"
          touch="default"
          className="!min-h-11"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  // Regular pagination for desktop or when there are few pages
  return (
    <div className={`flex items-center justify-center gap-1 sm:gap-2 ${className}`}>
      <Button
        variant="default"
        size="sm"
        touch="default"
        className="!min-h-11"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        <ChevronLeftIcon className="w-4 h-4" />
      </Button>

      <div className="flex gap-0.5 sm:gap-1">
        {getPageNumbers().map((page, index) => (
          <React.Fragment key={index}>
            {page === '...' ? (
              <span className="px-1 sm:px-3 py-1 text-xs sm:text-sm text-base-content/70 self-center">...</span>
            ) : (
              <Button
                variant={currentPage === page ? 'primary' : 'default'}
                size="sm"
                touch="default"
                className="!min-h-11"
                onClick={() => onPageChange(page as number)}
                aria-label={`Go to page ${page}`}
                aria-current={currentPage === page ? 'page' : undefined}
              >
                {page}
              </Button>
            )}
          </React.Fragment>
        ))}
      </div>

      <Button
        variant="default"
        size="sm"
        touch="default"
        className="!min-h-11"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        <ChevronRightIcon className="w-4 h-4" />
      </Button>
    </div>
  );
};
