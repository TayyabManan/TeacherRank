import React from 'react';

interface RatingStarsProps {
  rating: number;
  size?: number;
  className?: string;
  showNumber?: boolean;
  interactive?: boolean;
  allowHalf?: boolean;
  onRatingChange?: (rating: number) => void;
}

const clamp = (v: number, min = 0, max = 5) => Math.max(min, Math.min(max, v));

export const RatingStars = React.memo<RatingStarsProps>(({ 
  rating, 
  size = 16, 
  className = '',
  showNumber = false,
  interactive = false,
  allowHalf = false,
  onRatingChange
}) => {
  const [hoverRating, setHoverRating] = React.useState<number | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const displayRating = hoverRating !== null ? hoverRating : rating;
  const clampedRating = clamp(displayRating);
  const full = Math.floor(clampedRating);
  const half = clampedRating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  
  const handleClick = (value: number) => {
    if (interactive && onRatingChange) {
      onRatingChange(value);
      setHoverRating(null);
    }
  };

  const calculateRatingFromPosition = (clientX: number) => {
    if (!containerRef.current) return null;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const totalWidth = rect.width;
    const starWidth = totalWidth / 5;
    
    // Calculate which star and which half
    const starIndex = Math.floor(x / starWidth) + 1;
    const positionInStar = x % starWidth;
    const isLeftHalf = allowHalf && positionInStar < starWidth / 2;
    
    // Clamp between 0.5 and 5
    if (starIndex < 1) return allowHalf ? 0.5 : 1;
    if (starIndex > 5) return 5;
    
    return allowHalf && isLeftHalf ? starIndex - 0.5 : starIndex;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive) return;
    
    const newRating = calculateRatingFromPosition(e.clientX);
    if (newRating !== null) {
      setHoverRating(newRating);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!interactive) return;
    e.preventDefault(); // Prevent scrolling while dragging
    
    const touch = e.touches[0];
    const newRating = calculateRatingFromPosition(touch.clientX);
    if (newRating !== null) {
      setHoverRating(newRating);
      setIsDragging(true);
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!interactive) return;
    
    const touch = e.touches[0];
    const newRating = calculateRatingFromPosition(touch.clientX);
    if (newRating !== null) {
      setHoverRating(newRating);
      setIsDragging(true);
    }
  };

  const handleMouseLeave = () => {
    if (interactive) {
      setHoverRating(null);
    }
  };

  const handleTouchEnd = () => {
    if (interactive) {
      if (isDragging && hoverRating !== null) {
        handleClick(hoverRating);
      }
      setIsDragging(false);
      // Keep the hover rating visible for a moment before clearing
      setTimeout(() => setHoverRating(null), 100);
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`flex items-center ${interactive ? 'gap-0.5' : 'gap-1'} ${className} ${interactive ? 'select-none' : ''}`} 
      aria-label={`Rating: ${clampedRating.toFixed(1)} out of 5`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        if (interactive && !isDragging) {
          const newRating = calculateRatingFromPosition(e.clientX);
          if (newRating !== null) {
            handleClick(newRating);
          }
        }
      }}
    >
      {[1, 2, 3, 4, 5].map((starIndex) => {
        const isFull = starIndex <= full;
        const isHalf = starIndex === full + 1 && half;
        const isEmpty = starIndex > full + (half ? 1 : 0);
        
        return (
          <div
            key={starIndex}
            className={`relative ${interactive ? 'pointer-events-none' : ''}`}
          >
            {isFull ? (
              <svg 
                width={size} 
                height={size} 
                viewBox="0 0 24 24" 
                fill="currentColor" 
                className={`text-yellow-500 dark:text-yellow-400 drop-shadow-lg ${interactive ? 'hover:scale-110 transition-transform' : ''}`}
                style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2))' }}
              >
                <path d="M12 .587l3.668 7.431L23.5 9.75l-5.75 5.6L19.334 24 12 20.2 4.666 24l1.584-8.65L.5 9.75l7.832-1.732z" />
              </svg>
            ) : isHalf ? (
              <div className="relative" style={{ width: size, height: size }}>
                {/* Background empty star */}
                <svg 
                  width={size} 
                  height={size} 
                  viewBox="0 0 24 24" 
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="absolute inset-0 text-gray-400 dark:text-gray-600"
                >
                  <path d="M12 .587l3.668 7.431L23.5 9.75l-5.75 5.6L19.334 24 12 20.2 4.666 24l1.584-8.65L.5 9.75l7.832-1.732z" />
                </svg>
                {/* Half filled star */}
                <svg 
                  width={size} 
                  height={size} 
                  viewBox="0 0 24 24" 
                  className={`absolute inset-0 ${interactive ? 'hover:scale-110 transition-transform' : ''}`}
                  style={{ clipPath: 'polygon(0 0, 50% 0, 50% 100%, 0 100%)', filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2))' }}
                >
                  <path 
                    d="M12 .587l3.668 7.431L23.5 9.75l-5.75 5.6L19.334 24 12 20.2 4.666 24l1.584-8.65L.5 9.75l7.832-1.732z" 
                    fill="currentColor"
                    className="text-yellow-500 dark:text-yellow-400"
                  />
                </svg>
              </div>
            ) : (
              <svg 
                width={size} 
                height={size} 
                viewBox="0 0 24 24" 
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className={`text-gray-400 dark:text-gray-600 ${interactive ? 'hover:text-yellow-500 dark:hover:text-yellow-400 hover:fill-current hover:scale-110 transition-all' : ''}`}
              >
                <path d="M12 .587l3.668 7.431L23.5 9.75l-5.75 5.6L19.334 24 12 20.2 4.666 24l1.584-8.65L.5 9.75l7.832-1.732z" />
              </svg>
            )}
          </div>
        );
      })}
      {showNumber && (
        <span className="ml-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {clampedRating > 0 ? clampedRating.toFixed(1) : 'NEW'}
        </span>
      )}
    </div>
  );
});

RatingStars.displayName = 'RatingStars';