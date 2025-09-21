import React, { useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useRatings } from '../hooks/useRatings';
import { useUser } from '../hooks/useAuth';
import { RatingStars } from './RatingStars';
import { AvatarImage } from './AvatarImage';
import { useHaptic } from '../lib/haptic';
import { useMobileDetection, useSwipeGesture } from '../lib/mobile';
import type { TeacherWithStats, RatingWithRelations } from '../types';

interface TeacherModalProps {
  teacher: TeacherWithStats;
  isOpen: boolean;
  onClose: () => void;
}

// Memoized ReviewCard component to prevent unnecessary re-renders
const ReviewCard = memo<{ rating: RatingWithRelations; currentUserId?: string; isMobile?: boolean }>(({ rating, currentUserId, isMobile }) => {
  const formatDate = useMemo(() => {
    return new Date(rating.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, [rating.created_at]);

  const studentInitial = useMemo(() => {
    return rating.student?.display_name?.charAt(0) || rating.student?.email?.charAt(0) || '?';
  }, [rating.student]);

  const studentName = useMemo(() => {
    if (currentUserId && rating.student_id === currentUserId) {
      return 'Your review';
    }
    return rating.student?.display_name || 'Anonymous Student';
  }, [currentUserId, rating.student_id, rating.student?.display_name]);

  return (
    <article className={`bg-gray-50 dark:bg-gray-700/50 rounded-xl transition-colors duration-200 ${
      isMobile ? 'p-3 space-y-2' : 'p-4 space-y-3'
    }`}>
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <RatingStars rating={rating.score} size={isMobile ? 14 : 16} allowHalf={true} />
          <span className={`font-semibold text-gray-900 dark:text-white ${
            isMobile ? 'text-xs' : 'text-sm'
          }`}>{rating.score}/5</span>
        </div>
        <time className="text-xs text-gray-500 dark:text-gray-400">{formatDate}</time>
      </header>
      
      {rating.comment && (
        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed line-clamp-3">
          {rating.comment}
        </p>
      )}
      
      <footer className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <div className="w-5 h-5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-medium">{studentInitial}</span>
        </div>
        <span className="truncate">{studentName}</span>
      </footer>
    </article>
  );
});

ReviewCard.displayName = 'ReviewCard';

// Optimized modal component with lazy loading and smooth animations
function TeacherModal({ teacher, isOpen, onClose }: TeacherModalProps) {
  const navigate = useNavigate();
  const { data: currentUser } = useUser();
  const haptic = useHaptic();
  const { mobile } = useMobileDetection();
  const modalRef = useRef<HTMLDivElement>(null);
  // Only fetch ratings when modal is actually open to improve performance
  const { data: ratingsData, isLoading: ratingsLoading } = useRatings(
    isOpen ? teacher.id : undefined
  );

  // Memoize expensive calculations
  const displayRating = useMemo(() => {
    const rating = teacher.average_rating ?? 0;
    return Math.max(0, Math.min(5, rating));
  }, [teacher.average_rating]);

  const reviewCount = useMemo(() => teacher.ratings_count ?? 0, [teacher.ratings_count]);

  const displayedReviews = useMemo(() => {
    return ratingsData?.slice(0, 5) || []; // Only show first 5 reviews for performance
  }, [ratingsData]);

  // Optimized event handlers with useCallback
  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      haptic.light();
      onClose();
    }
  }, [onClose, haptic]);

  const handleViewProfile = useCallback(() => {
    haptic.medium();
    navigate(`/teacher/${teacher.id}`);
    onClose();
  }, [navigate, teacher.id, onClose, haptic]);

  const handleRateTeacher = useCallback(() => {
    haptic.medium();
    navigate(`/teacher/${teacher.id}#rate`);
    onClose();
  }, [navigate, teacher.id, onClose, haptic]);

  // Set up swipe gestures for mobile modal
  useSwipeGesture(modalRef, mobile && isOpen ? {
    onSwipeDown: () => {
      haptic.swipe();
      onClose();
    }
  } : undefined);

  // Optimized effect for handling modal state
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen, handleEscapeKey]);

  // Don't render anything if modal is closed
  if (!isOpen) return null;

  return createPortal(
    <div className={`fixed inset-0 z-[9999] ${
      mobile 
        ? 'flex items-end justify-center' 
        : 'flex items-center justify-center p-4'
    }`}>
      {/* Backdrop with smooth fade */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />
      
      {/* Modal Content - Bottom sheet on mobile, centered on desktop */}
      <div 
        ref={modalRef}
        className={`relative w-full bg-white dark:bg-gray-800 shadow-2xl animate-in duration-300 overflow-hidden ${
          mobile 
            ? 'max-h-[90vh] rounded-t-3xl slide-in-from-bottom-full'
            : 'max-w-2xl max-h-[90vh] rounded-2xl zoom-in-95 slide-in-from-bottom-4'
        }`}
      >
        
        {/* Swipe indicator for mobile */}
        {mobile && (
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-14 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
          </div>
        )}
        
        {/* Header with gradient and improved spacing */}
        <header className={`relative bg-gradient-to-br from-purple-600 via-purple-500 to-indigo-600 dark:from-purple-700 dark:via-purple-600 dark:to-indigo-700 ${
          mobile ? 'px-4 pt-2 pb-5' : 'p-6'
        }`}>
          <button
            onClick={() => {
              haptic.light();
              onClose();
            }}
            className={`absolute p-2.5 text-white/80 hover:text-white hover:bg-white/15 rounded-full transition-all duration-200 hover:scale-105 ${
              mobile ? 'top-2 right-2 min-h-[44px] min-w-[44px]' : 'top-3 right-3'
            }`}
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className={`flex ${
            mobile ? 'gap-3 items-center' : 'gap-5 items-start'
          }`}>
            {/* Optimized Avatar */}
            <div className="shrink-0">
              <AvatarImage
                src={teacher.avatar_url || undefined}
                name={teacher.name}
                size={mobile ? 56 : 80}
                className="ring-4 ring-white/30 shadow-xl"
              />
            </div>
            
            {/* Teacher Info */}
            <div className="flex-1 text-white min-w-0">
              <h2 className={`font-bold ${
                mobile ? 'text-lg mb-0.5' : 'text-2xl mb-1'
              }`}>
                <span className="line-clamp-1">{teacher.name}</span>
              </h2>
              <p className={`text-purple-100 ${
                mobile ? 'text-xs mb-2' : 'text-base mb-3'
              }`}>
                <span className="line-clamp-1">{teacher.institute}</span>
              </p>
              
              {/* Rating Display */}
              <div className={`flex items-center gap-2 ${
                mobile ? 'mb-2' : 'mb-3 gap-3'
              }`}>
                <RatingStars rating={displayRating} size={mobile ? 14 : 18} allowHalf={true} />
                <span className={`font-semibold ${
                  mobile ? 'text-sm' : 'text-lg'
                }`}>
                  {teacher.average_rating ? teacher.average_rating.toFixed(1) : 'NEW'}
                </span>
                <span className={`text-purple-100 ${
                  mobile ? 'text-xs' : 'text-sm'
                }`}>
                  ({reviewCount})
                </span>
              </div>

              {/* Additional Info - Mobile optimized */}
              {!mobile && (
                <div className="flex flex-wrap gap-3 text-sm text-purple-100">
                  {teacher.department && (
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      {teacher.department}
                    </span>
                  )}
                  {teacher.designation && (
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      {teacher.designation}
                    </span>
                  )}
                  {teacher.city && (
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {teacher.city}
                    </span>
                  )}
                </div>
              )}

              {/* LinkedIn Link */}
              {teacher.linkedin_url && !mobile && (
                <div className="mt-3">
                  <a
                    href={teacher.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-purple-100 hover:text-white transition-colors duration-200 text-sm font-medium hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    LinkedIn Profile
                  </a>
                </div>
              )}
            </div>
          </div>
        </header>
        
        {/* Scrollable Content */}
        <div className={`flex-1 overflow-y-auto ${
          mobile ? 'max-h-[55vh] px-4 py-3 space-y-4' : 'max-h-96 p-6 space-y-6'
        }`}>
          {/* Bio Section - Mobile info badges */}
          <section>
            {mobile && (teacher.designation || teacher.city) && (
              <div className="flex flex-wrap gap-2 mb-3">
                {teacher.designation && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {teacher.designation}
                  </span>
                )}
                {teacher.city && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {teacher.city}
                  </span>
                )}
              </div>
            )}
            <h3 className={`font-semibold text-gray-900 dark:text-white ${
              mobile ? 'text-base mb-2' : 'text-lg mb-3'
            }`}>About</h3>
            <p className={`text-gray-700 dark:text-gray-300 leading-relaxed ${
              mobile ? 'text-sm' : 'text-sm'
            }`}>
              {teacher.bio || 'This teacher hasn\'t added a bio yet. Be the first to rate them and share your experience!'}
            </p>
          </section>
          
          {/* Reviews Section */}
          <section>
            <div className={`flex items-center justify-between ${
              mobile ? 'mb-3' : 'mb-4'
            }`}>
              <h3 className={`font-semibold text-gray-900 dark:text-white ${
                mobile ? 'text-base' : 'text-lg'
              }`}>
                Recent Reviews
              </h3>
              {displayedReviews.length > 0 && !mobile && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {displayedReviews.length} of {reviewCount}
                </span>
              )}
            </div>
            
            {ratingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
                <span className="ml-3 text-gray-500 dark:text-gray-400">Loading reviews...</span>
              </div>
            ) : displayedReviews.length > 0 ? (
              <div className="space-y-3">
                {displayedReviews.map((rating) => (
                  <ReviewCard key={rating.id} rating={rating} currentUserId={currentUser?.id} isMobile={mobile} />
                ))}
                {ratingsData && ratingsData.length > 5 && (
                  <button
                    onClick={handleViewProfile}
                    className="w-full text-center text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 text-sm font-medium py-2 hover:underline transition-colors duration-200"
                  >
                    View all {reviewCount} reviews
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-4.126-.98L3 21l1.98-5.874A8.955 8.955 0 013 12a8 8 0 018-8c4.418 0 8 3.582 8 8z" />
                  </svg>
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">No reviews yet</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">Be the first to share your experience!</p>
              </div>
            )}
          </section>
        </div>
        
        {/* Footer Actions with improved styling */}
        <footer className={`border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 ${
          mobile ? 'px-4 py-3 safe-area-inset-bottom' : 'p-6'
        }`}>
          <div className={`flex ${
            mobile ? 'gap-2' : 'gap-3'
          }`}>
            <button
              onClick={handleViewProfile}
              className={`bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                mobile ? 'flex-1 py-3.5 px-4 min-h-[50px] touch-manipulation text-sm font-semibold' : 'flex-1 px-4 py-3'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                View Profile
              </span>
            </button>
            <button
              onClick={handleRateTeacher}
              className={`bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-medium transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 shadow-lg hover:shadow-xl ${
                mobile ? 'flex-1 py-3.5 px-4 min-h-[50px] touch-manipulation text-sm font-semibold' : 'flex-1 px-4 py-3'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Rate Teacher
              </span>
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}

export default TeacherModal;
export { TeacherModal };