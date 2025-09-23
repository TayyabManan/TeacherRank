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
                  <svg className="w-10 h-10 text-gray-400" viewBox="0 -8.5 158 158" fill="currentColor">
                    <g clipPath="url(#clip0)">
                      <path d="M25.3444 106.878C27.7828 108.544 28.102 109.755 26.8285 112.511C24.164 118.28 21.0905 125.117 18.4964 132.108C17.8052 133.97 17.7557 137.607 19.2508 139.067C20.4742 140.262 22.5497 140.426 24.5568 140.584C25.1503 140.631 25.7106 140.675 26.2382 140.744C26.3236 140.756 26.4095 140.761 26.4956 140.761C27.2256 140.692 27.9286 140.45 28.5463 140.056L28.8069 139.92C31.0067 138.785 33.2086 137.654 35.4126 136.526C41.7037 133.301 48.2085 129.963 54.5425 126.559L54.6018 126.528C62.2238 122.434 69.4168 118.566 78.2498 120.266C78.6185 120.325 78.9925 120.34 79.3651 120.309C79.483 120.303 79.6022 120.298 79.7188 120.297C100.703 120.106 116.873 115.762 130.606 106.626C151.64 92.6322 161.084 72.6056 156.517 51.6818C152.289 32.3089 143.953 20.2547 129.488 12.5985C114.782 4.81623 98.2103 0.344555 82.8262 0.00732422C82.8204 0.00829458 82.8145 0.00829458 82.8093 0.00732422C63.8205 0.0820479 47.9564 3.20238 32.8857 9.82936C14.6163 17.8612 4.59895 29.4004 2.26219 45.106C1.2549 51.4949 1.13475 57.9916 1.90517 64.4132C4.43476 83.9408 12.1024 97.831 25.3444 106.878ZM31.7762 122.668C33.0466 118.148 34.2452 113.879 35.7403 109.789C38.0855 103.379 34.6244 99.7777 31.3495 97.356C26.3685 93.6744 21.3302 89.436 18.2123 83.4113C10.1604 67.8526 9.06465 53.2775 14.86 38.8533C18.0032 31.0307 24.3842 25.2225 34.941 20.5741C49.512 14.1583 64.0147 10.9506 78.3527 10.9506C92.628 11.014 106.724 14.1301 119.691 20.088C134.661 26.8151 142.963 37.9101 145.818 55.0055C148.164 69.0345 144.266 80.7193 133.559 91.7764C124.025 101.622 111.17 107.416 93.1042 110.01C83.9989 111.317 73.2291 112.4 62.3899 110.52C61.0369 110.291 59.5235 111.136 58.2995 111.82C50.9622 115.933 43.6939 120.058 35.9996 124.425L30.3717 127.618C30.8629 125.919 31.3254 124.273 31.7762 122.668V122.668Z" />
                      <path d="M50.4727 69.7116H50.5632C51.5856 69.7084 52.597 69.5011 53.5381 69.1028C54.4792 68.7038 55.3311 68.1223 56.0439 67.3913C56.6562 66.761 57.1341 66.0131 57.4489 65.1938C57.7636 64.3742 57.9086 63.4996 57.8751 62.6226C57.7597 60.8352 56.9862 59.1535 55.7032 57.9004C54.4202 56.6472 52.7181 55.9107 50.9241 55.833C49.971 55.839 49.0285 56.034 48.1513 56.406C47.2742 56.778 46.4798 57.3195 45.8141 58C45.0885 58.6916 44.507 59.5195 44.1032 60.436C43.6994 61.3525 43.4811 62.34 43.4611 63.3409C43.4557 64.1543 43.6132 64.9604 43.9245 65.7123C44.2357 66.4641 44.6943 67.1457 45.2734 67.7188C46.6738 69.043 48.5435 69.7597 50.4727 69.7116Z" />
                      <path d="M81.3262 71.5141H81.3913C83.1594 71.4998 84.8499 70.7896 86.0955 69.5382C87.4055 68.2679 88.1606 66.533 88.1964 64.7109C88.2114 62.8915 87.2016 60.7403 85.5613 59.0997C84.4492 57.855 82.8981 57.0869 81.2317 56.9556H81.2109C77.8461 56.9751 74.4957 60.6551 74.4468 64.3848C74.4299 65.3173 74.5993 66.2438 74.9452 67.11C75.2905 67.9768 75.8051 68.7662 76.4598 69.4323C77.0924 70.0833 77.8481 70.6025 78.6832 70.9599C79.519 71.3172 80.4167 71.5057 81.3262 71.5141Z" />
                      <path d="M110.697 70.7603H110.74C112.416 70.6959 114.011 70.0228 115.225 68.8681C116.439 67.7128 117.189 66.1554 117.333 64.4883C117.287 62.8406 116.594 61.2767 115.402 60.1347C113.8 58.3543 111.576 57.2516 109.186 57.0521C108.579 57.0402 107.977 57.1519 107.416 57.3796C106.854 57.6072 106.345 57.9462 105.919 58.3764C105.249 59.0638 104.722 59.8774 104.37 60.7699C104.018 61.6623 103.847 62.6157 103.869 63.5745C103.828 65.4283 104.522 67.2223 105.801 68.5679C107.079 69.913 108.839 70.7018 110.697 70.7603Z" />
                    </g>
                    <defs>
                      <clipPath id="clip0">
                        <rect width="157" height="141" fill="white" transform="translate(0.777344)"/>
                      </clipPath>
                    </defs>
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