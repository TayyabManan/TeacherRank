import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import FocusLock from 'react-focus-lock';
import { useNavigate } from 'react-router-dom';
import { useRatings } from '../hooks/useRatings';
import { useUser } from '../hooks/useAuth';
import { RatingStars } from './RatingStars';
import { ReviewCard } from './ReviewCard';
import { AvatarImage } from './AvatarImage';
import { useHaptic } from '../lib/haptic';
import { useMobileDetection, useSwipeGesture } from '../lib/mobile';
import { usePresence } from '../hooks/usePresence';
import { MOTION } from '../utils/motion';
import { Button } from './Button';
import { InlineRating } from './InlineRating';
import { ReviewListSkeleton } from './Skeleton';
import { SpeechBubbleIcon, DocumentIcon, BriefcaseIcon, MapPinIcon, LinkedInIcon } from './icons';
import { reviewCountLabel } from '../lib/reviewStandards';
import type { TeacherWithStats } from '../types';

interface TeacherModalProps {
  teacher: TeacherWithStats;
  isOpen: boolean;
  onClose: () => void;
  /** Open with the inline rating widget already revealed (card "Rate Now"). */
  autoRate?: boolean;
}

// Optimized modal component with lazy loading and smooth animations
function TeacherModal({ teacher, isOpen, onClose, autoRate = false }: TeacherModalProps) {
  const navigate = useNavigate();
  const { data: currentUser } = useUser();
  const haptic = useHaptic();
  const { mobile } = useMobileDetection();
  // Swipe-down-to-close binds to the header/drag-handle region only — swiping
  // through the scrollable body used to close the sheet mid-read.
  const swipeRegionRef = useRef<HTMLDivElement | null>(null);
  // Inline rating: revealed in-place (no navigation) when the user taps "Rate".
  const [showRating, setShowRating] = useState(false);
  const ratingRef = useRef<HTMLDivElement | null>(null);
  // Keep the modal mounted through its exit animation, then unmount.
  const { shouldRender, status, ref: presenceRef } = usePresence(isOpen, {
    duration: MOTION.modal,
  });
  const exiting = status === 'exiting';
  // Only fetch ratings when modal is actually open to improve performance
  const { data: ratingsData, isLoading: ratingsLoading } = useRatings(
    isOpen ? teacher.id : undefined
  );

  const reviewCount = teacher.ratings_count ?? 0;

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

  // Reveal the inline rating widget in place instead of navigating away.
  const handleRateTeacher = useCallback(() => {
    haptic.medium();
    setShowRating(true);
  }, [haptic]);

  // Open already in rate mode when launched via the card's "Rate Now".
  useEffect(() => {
    if (autoRate) setShowRating(true);
  }, [autoRate]);

  // Scroll the rating widget into view whenever it is revealed.
  useEffect(() => {
    if (showRating) {
      requestAnimationFrame(() => {
        ratingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }, [showRating]);

  // Set up swipe gestures for mobile modal (header/drag-handle only)
  useSwipeGesture(swipeRegionRef, mobile && isOpen ? {
    onSwipeDown: () => {
      haptic.swipe();
      onClose();
    }
  } : undefined);

  // Keep scroll lock + Escape handling active through the exit animation,
  // then release on real unmount (keyed on shouldRender, not isOpen).
  useEffect(() => {
    if (shouldRender) {
      document.addEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
        document.body.style.overflow = 'unset';
      };
    }
  }, [shouldRender, handleEscapeKey]);

  // Don't render anything until mounted (stays mounted during exit animation)
  if (!shouldRender) return null;

  return createPortal(
    <FocusLock returnFocus={true}>
    <div className={`z-modal ${
      mobile
        ? 'fixed inset-x-0 top-0 h-dvh flex items-end justify-center'
        : 'fixed inset-0 flex items-center justify-center p-4'
    }`}>
      {/* Backdrop with smooth fade in/out */}
      <div
        className={`absolute inset-0 bg-scrim/60 backdrop-blur-sm duration-300 ${
          exiting ? 'animate-out fade-out' : 'animate-in fade-in'
        }`}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal Content - Bottom sheet on mobile, centered on desktop */}
      <div
        ref={presenceRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="teacher-modal-title"
        className={`relative w-full bg-base-100 shadow-md duration-300 flex flex-col ${
          mobile
            ? `max-h-[90dvh] rounded-t-lg ${exiting ? 'animate-out slide-out-to-bottom-full' : 'animate-in slide-in-from-bottom-full'}`
            : `max-w-2xl max-h-[85dvh] rounded-lg ${exiting ? 'animate-out zoom-out-95 slide-out-to-bottom-4' : 'animate-in zoom-in-95 slide-in-from-bottom-4'}`
        }`}
      >

        {/* Drag handle + header: the swipe-down-to-close region */}
        <div ref={swipeRegionRef} className="flex-shrink-0">
        {/* Swipe indicator for mobile */}
        {mobile && (
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-14 h-1.5 bg-base-300 rounded-full"></div>
          </div>
        )}

        {/* Header — quiet surface; violet appears only as the avatar ring
            (the old bg-primary slab was the loudest element in the modal). */}
        <header className={`relative bg-base-100 border-b border-base-300 ${
          mobile ? 'px-4 pt-2 pb-4 rounded-t-lg' : 'p-6 rounded-t-lg'
        }`}>
          <button
            onClick={() => {
              haptic.light();
              onClose();
            }}
            className={`absolute p-2.5 text-base-content/60 hover:text-base-content hover:bg-base-200 rounded-full transition-all duration-200 ${
              mobile ? 'top-2 right-2 touch-target' : 'top-3 right-3'
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
                className="ring-2 ring-primary/20"
              />
            </div>

            {/* Teacher Info */}
            <div className="flex-1 text-base-content min-w-0 pr-8">
              <h2 id="teacher-modal-title" dir="auto" className={`font-display font-semibold ${
                mobile ? 'text-xl mb-0.5' : 'text-2xl mb-1'
              }`}>
                <span className="line-clamp-1">{teacher.name}</span>
              </h2>
              <p className={`text-base-content/70 ${
                mobile ? 'text-xs mb-2' : 'text-base mb-3'
              }`}>
                <span className="line-clamp-1">{teacher.institute}</span>
              </p>

              {/* Rating Display — the average never appears without its count */}
              <div className={`flex items-center gap-2 ${
                mobile ? 'mb-2' : 'mb-3 gap-3'
              }`}>
                {teacher.average_rating ? (
                  <>
                    <RatingStars rating={teacher.average_rating} size={mobile ? 14 : 18} allowHalf={true} />
                    <span className={`font-semibold tabular-nums ${
                      mobile ? 'text-sm' : 'text-lg'
                    }`}>
                      {teacher.average_rating.toFixed(1)}
                    </span>
                    <span className={`text-base-content/70 tabular-nums ${
                      mobile ? 'text-xs' : 'text-sm'
                    }`}>
                      · {reviewCountLabel(reviewCount)}
                    </span>
                  </>
                ) : (
                  <span className={`text-base-content/70 ${mobile ? 'text-xs' : 'text-sm'}`}>
                    No reviews yet
                  </span>
                )}
              </div>

              {/* Additional Info - Mobile optimized */}
              {!mobile && (
                <div className="flex flex-wrap gap-3 text-sm text-base-content/70">
                  {teacher.department && (
                    <span className="inline-flex items-center gap-1.5">
                      <DocumentIcon className="w-4 h-4" />
                      {teacher.department}
                    </span>
                  )}
                  {teacher.designation && (
                    <span className="inline-flex items-center gap-1.5">
                      <BriefcaseIcon className="w-4 h-4" />
                      {teacher.designation}
                    </span>
                  )}
                  {teacher.city && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPinIcon className="w-4 h-4" />
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
                    className="inline-flex items-center gap-2 text-primary hover:text-primary-focus transition-colors duration-200 text-sm font-medium hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <LinkedInIcon className="w-4 h-4" />
                    LinkedIn
                  </a>
                </div>
              )}
            </div>
          </div>
        </header>
        </div>

        {/* Scrollable Content */}
        <div className={`flex-1 overflow-y-auto min-h-0 ${
          mobile ? 'px-4 py-3 space-y-4' : 'p-6 space-y-6'
        }`}>
          {/* Bio Section - Mobile info badges */}
          <section>
            {mobile && (teacher.designation || teacher.city) && (
              <div className="flex flex-wrap gap-2 mb-3">
                {teacher.designation && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-base-200 border border-base-300 text-base-content/80 rounded-md text-xs font-medium">
                    <BriefcaseIcon className="w-3.5 h-3.5" />
                    {teacher.designation}
                  </span>
                )}
                {teacher.city && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-base-200 border border-base-300 text-base-content/80 rounded-md text-xs font-medium">
                    <MapPinIcon className="w-3.5 h-3.5" />
                    {teacher.city}
                  </span>
                )}
              </div>
            )}
            <h3 className={`font-semibold text-base-content ${
              mobile ? 'text-base mb-2' : 'text-lg mb-3'
            }`}>About</h3>
            <p className={`text-base-content/80 leading-relaxed ${
              mobile ? 'text-sm' : 'text-sm'
            }`}>
              {teacher.bio || 'This teacher hasn\'t added a bio yet.'}
            </p>
          </section>

          {/* Inline rating — rate without leaving the listing */}
          {showRating && (
            <section ref={ratingRef}>
              <InlineRating
                teacherId={teacher.id}
                onViewFullProfile={handleViewProfile}
              />
            </section>
          )}

          {/* Reviews Section */}
          <section>
            <div className={`flex items-center justify-between ${
              mobile ? 'mb-3' : 'mb-4'
            }`}>
              <h3 className={`font-semibold text-base-content ${
                mobile ? 'text-base' : 'text-lg'
              }`}>
                Recent reviews
              </h3>
              {displayedReviews.length > 0 && !mobile && (
                <span className="text-sm text-base-content/70">
                  Showing {displayedReviews.length} of {reviewCount}
                </span>
              )}
            </div>
            
            {ratingsLoading ? (
              <ReviewListSkeleton count={2} />
            ) : displayedReviews.length > 0 ? (
              <div className="space-y-3 stagger-enter">
                {displayedReviews.map((rating) => (
                  <ReviewCard key={rating.id} review={rating} currentUserId={currentUser?.id} compact />
                ))}
                {ratingsData && ratingsData.length > 5 && (
                  <button
                    onClick={handleViewProfile}
                    className="w-full text-center text-primary hover:text-primary-focus text-sm font-medium py-2 hover:underline transition-colors duration-200"
                  >
                    View all {reviewCount} reviews
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-base-300 rounded-full flex items-center justify-center mx-auto mb-3 text-base-content/40">
                  <SpeechBubbleIcon className="w-10 h-10" />
                </div>
                <p className="text-base-content/70 font-medium mb-1">No reviews yet</p>
                <p className="text-sm text-base-content/70">Be the first to rate this teacher.</p>
              </div>
            )}
          </section>
        </div>
        
        {/* Footer Actions with improved styling */}
        <footer className={`border-t border-base-300 bg-base-100 flex-shrink-0 ${
          mobile ? 'px-4 py-3 safe-area-inset-bottom rounded-b-lg' : 'p-6 rounded-b-lg'
        }`}>
          <div className={`flex ${
            mobile ? 'gap-2' : 'gap-3'
          }`}>
            <Button
              variant="secondary"
              onClick={handleViewProfile}
              className={`rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-base-100 ${
                mobile ? 'flex-1 min-w-0 py-3.5 px-4 min-h-[50px] touch-manipulation text-[clamp(0.6875rem,4vw,0.875rem)] font-semibold' : 'flex-1 px-4 py-3'
              }`}
            >
              <span className="flex items-center justify-center gap-2 whitespace-nowrap">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                View profile
              </span>
            </Button>
            <Button
              variant="primary"
              onClick={handleRateTeacher}
              className={`rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-base-100 shadow-sm ${
                mobile ? 'flex-1 min-w-0 py-3.5 px-4 min-h-[50px] touch-manipulation text-[clamp(0.6875rem,4vw,0.875rem)] font-semibold' : 'flex-1 px-4 py-3'
              }`}
            >
              <span className="flex items-center justify-center gap-2 whitespace-nowrap">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Rate teacher
              </span>
            </Button>
          </div>
        </footer>
      </div>
    </div>
    </FocusLock>,
    document.body
  );
}

export default TeacherModal;
export { TeacherModal };