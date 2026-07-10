import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ratingSchema, RatingFormData } from '../lib/validation';
import { useUserRating } from '../hooks/useRatings';
import { useSubmitRating } from '../hooks/useSubmitRating';
import { useAnonymousTracking } from '../lib/anonymousTracking';
import { useUser } from '../hooks/useAuth';
import { logger } from '../lib/logger';
import { RatingStars } from './RatingStars';
import { Button } from './Button';
import { useHaptic } from '../lib/haptic';
import { useMobileDetection, useKeyboardHeight } from '../lib/mobile';
import {
  moderateContent,
  getReviewSuggestions,
  getPlaceholderText
} from '../lib/profanityFilter';

interface Props {
  teacherId: string;
  onSaved?: () => void;
}

// Text label shown for the selected rating
const ratingLabels: Record<number, { label: string; color: string }> = {
  0.5: { label: 'Very Poor', color: 'text-error' },
  1: { label: 'Poor', color: 'text-error' },
  1.5: { label: 'Disappointing', color: 'text-warning' },
  2: { label: 'Below Average', color: 'text-warning' },
  2.5: { label: 'Mixed', color: 'text-warning' },
  3: { label: 'Average', color: 'text-warning' },
  3.5: { label: 'Above Average', color: 'text-success' },
  4: { label: 'Good', color: 'text-info' },
  4.5: { label: 'Very Good', color: 'text-info' },
  5: { label: 'Excellent', color: 'text-success' }
};

// Encouraging messages for different scenarios
const encouragingMessages = [
  "Your feedback helps other students choose their courses.",
  "Thank you for taking the time to review.",
  "Honest, specific reviews are the most useful.",
  "Help future students make an informed decision."
];

export default function RatingFormEnhanced({ teacherId, onSaved }: Props) {
  const { data: user } = useUser();
  const { data: existingRating } = useUserRating(teacherId, user?.id);
  const { submit, mutation: createRatingMutation } = useSubmitRating();
  const haptic = useHaptic();
  const { mobile } = useMobileDetection();
  const { keyboardHeight, isKeyboardOpen } = useKeyboardHeight();
  const anon = useAnonymousTracking(teacherId);

  // Same up-front cooldown gate as InlineRating — block before the user writes
  // a review, not after they submit it.
  const cooldownBlocked = !user && !existingRating && !anon.canReview;

  // Picked once per mount — Math.random() in render re-rolled on every keystroke.
  const encouragingMessage = useMemo(
    () => encouragingMessages[Math.floor(Math.random() * encouragingMessages.length)],
    []
  );

  // State
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedRating, setSelectedRating] = useState(existingRating?.score || 0);
  const [commentText, setCommentText] = useState(existingRating?.comment || '');
  const [charCount, setCharCount] = useState((existingRating?.comment || '').length);
  const [contentWarnings, setContentWarnings] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // A written reason is required for harsh ratings; optional for 3 stars and up.
  const commentRequired = selectedRating > 0 && selectedRating <= 2;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    trigger
  } = useForm<RatingFormData>({
    resolver: zodResolver(ratingSchema),
    defaultValues: {
      score: existingRating?.score || 0,
      comment: existingRating?.comment || '',
    },
  });

  // The user's existing rating loads asynchronously (useUserRating), so the
  // useState/defaultValues initializers above run before it resolves. Sync local
  // state + form once it arrives so editing pre-fills instead of showing blank.
  useEffect(() => {
    if (existingRating) {
      setSelectedRating(existingRating.score);
      setCommentText(existingRating.comment || '');
      setCharCount((existingRating.comment || '').length);
      setValue('score', existingRating.score);
      setValue('comment', existingRating.comment || '');
    }
  }, [existingRating, setValue]);

  // Update form value when rating changes
  useEffect(() => {
    setValue('score', selectedRating);
    if (selectedRating > 0) {
      haptic.light(); // Light feedback for rating selection
      setSuggestions(getReviewSuggestions(selectedRating, commentText));
    }
  }, [selectedRating, setValue, haptic]);

  // Real-time content moderation — only flags genuine content issues once there's
  // enough text. Short/empty comments don't block (comment is optional for 3 stars+).
  useEffect(() => {
    if (commentText.trim().length >= 10) {
      const debounceTimer = setTimeout(() => {
        setIsValidating(true);
        const moderation = moderateContent(commentText);
        setContentWarnings(moderation.issues);
        setSuggestions([...moderation.suggestions, ...getReviewSuggestions(selectedRating, commentText)]);
        setIsValidating(false);
      }, 500);
      return () => clearTimeout(debounceTimer);
    }
    // Below the moderation threshold: nothing blocks submission.
    setContentWarnings([]);
    setSuggestions(selectedRating > 0 ? getReviewSuggestions(selectedRating, commentText) : []);
  }, [commentText, selectedRating]);

  // Handle text change with character count
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setCommentText(text);
    setCharCount(text.length);
    setValue('comment', text);
  };

  // Reset success state after showing message
  useEffect(() => {
    if (createRatingMutation.isSuccess) {
      const timer = setTimeout(() => {
        createRatingMutation.reset();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [createRatingMutation]);

  const onSubmit = async (data: RatingFormData) => {
    haptic.medium(); // Medium feedback for form submission

    // student_id is null for signed-out users OR when an authenticated user opts
    // to post anonymously. The shared hook runs the same moderation + mutation.
    const studentId = !user || isAnonymous ? null : user.id;

    try {
      const result = await submit({
        teacherId,
        score: data.score,
        comment: data.comment ?? '',
        studentId,
      });

      if (!result.ok) {
        haptic.error(); // Validation/moderation feedback
        setContentWarnings(result.warnings);
        return;
      }

      haptic.success(); // Success feedback
      if (onSaved) onSaved();
      if (!existingRating) {
        reset();
        setSelectedRating(0);
        setCommentText('');
        setCharCount(0);
        setIsAnonymous(false);
      }
    } catch (error) {
      haptic.error(); // Error feedback
      logger.error('Failed to save rating', error);
    }
  };

  // Keyboard navigation for rating stars
  const handleKeyDown = (e: React.KeyboardEvent, rating: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedRating(rating);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit(onSubmit)} 
      noValidate 
      className={`card bg-base-100 shadow-sm border-2 border-base-300 hover:shadow-md transition-all duration-200 ${
        mobile ? 'p-4 md:p-6' : 'p-6'
      } ${
        mobile && isKeyboardOpen ? 'mb-4' : ''
      }`}
      aria-label="Teacher rating form"
    >
      {/* Header with encouraging message */}
      <div className={`text-center ${
        mobile && isKeyboardOpen ? 'mb-4' : 'mb-6'
      }`}>
        <h2 className={`font-bold mb-2 text-primary ${
          mobile ? 'text-xl' : 'text-2xl'
        }`}>
          Write a Review
        </h2>
        <p className={`text-base-content/70 ${
          mobile ? 'text-xs' : 'text-sm'
        }`}>
          {encouragingMessage}
        </p>
      </div>

      {/* Cooldown gate for anonymous users — shown up-front, not post-submit */}
      {cooldownBlocked && (
        <div role="status" className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-4">
          <p className="text-sm font-semibold text-base-content mb-1">
            You&rsquo;ve already reviewed this teacher
          </p>
          <p className="text-sm text-base-content/80">
            {anon.cooldownMessage ?? 'Anonymous reviews are limited to one per teacher per day.'}
            <a href="/auth" className="ml-1 font-medium text-primary hover:text-primary-focus underline transition-colors">
              Sign in
            </a>
            <span className="ml-1">to manage your reviews.</span>
          </p>
        </div>
      )}

      {/* Anonymous submission info for non-logged users */}
      {!user && !cooldownBlocked && (
        <div className="bg-info/10 border border-info/30 rounded-lg p-4 mb-4 animate-slideIn">
          <div className="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="w-6 h-6 text-info flex-shrink-0 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" stroke="currentColor" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-base-content mb-1">
                Anonymous Review
              </p>
              <p className="text-sm text-base-content/80">
                Your review will be posted anonymously.
                <a href="/auth" className="ml-1 font-medium text-primary hover:text-primary-focus underline transition-colors">
                  Sign in
                </a>
                <span className="ml-1">to track and manage your reviews.</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Anonymous toggle for logged users */}
      {user && !existingRating && (
        <div className={`form-control ${
          mobile && isKeyboardOpen ? 'mb-3' : 'mb-4'
        }`}>
          <label className={`label cursor-pointer bg-base-200 rounded-lg hover:bg-base-300 transition-colors ${
            mobile ? 'p-2' : 'p-3'
          } ${
            mobile ? 'touch-target-tall touch-manipulation' : ''
          }`}>
            <span className="label-text font-medium text-base-content">
              Submit anonymously
              <span className={`text-base-content/70 block ${
                mobile ? 'text-xs' : 'text-xs'
              }`}>Your name won't be displayed</span>
            </span>
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => {
                haptic.light(); // Light feedback for toggle
                setIsAnonymous(e.target.checked);
              }}
              className={`checkbox checkbox-primary ${
                mobile ? 'checkbox-sm' : ''
              }`}
              aria-label="Submit review anonymously"
            />
          </label>
        </div>
      )}

      {/* Update warning for existing reviews */}
      {user && existingRating && !createRatingMutation.isSuccess && (
        <div className="alert alert-info mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div className="flex-1">
            <h3 className="font-bold text-sm text-info-content">Updating Your Review</h3>
            <div className="text-xs mt-1 text-base-content">You're editing your existing review.</div>
          </div>
        </div>
      )}

      {/* Interactive Rating Section */}
      <div className={`form-control ${
        mobile && isKeyboardOpen ? 'mb-4' : 'mb-6'
      }`}>
        <label className="label">
          <span className="label-text font-semibold text-base-content text-base md:text-lg">
            How would you rate this teacher? <span className="text-error">*</span>
          </span>
        </label>
        
        {/* Rating stars with emoji feedback */}
        <div className="flex flex-col items-center gap-3 md:gap-4 bg-base-200 rounded-lg p-4">
          <div className="flex flex-col items-center gap-2">
            <RatingStars
              rating={selectedRating}
              size={mobile ? (window.innerWidth < 380 ? 36 : 40) : 40}
              interactive={true}
              allowHalf={true}
              onRatingChange={(rating) => {
                haptic.medium(); // Medium feedback for rating selection
                setSelectedRating(rating);
                setValue('score', rating);
              }}
            />
            <div className={`text-base-content/70 mt-1 text-center ${
              mobile ? 'text-xs' : 'text-xs'
            }`}>
              {mobile ? 'Tap a star to rate' : 'Click on a star or hover to select half ratings'}
            </div>
          </div>
          
          {/* Rating label feedback */}
          {selectedRating > 0 && ratingLabels[selectedRating] && (
            <div className={`flex items-center gap-2 animate-fadeIn ${ratingLabels[selectedRating].color}`}>
              <span className="font-semibold text-lg">
                {ratingLabels[selectedRating].label}
              </span>
              <span className="text-sm text-base-content/70">
                ({selectedRating} {selectedRating === 1 ? 'star' : 'stars'})
              </span>
            </div>
          )}
        </div>
        
        {/* Hidden input for form */}
        <input type="hidden" {...register('score', { valueAsNumber: true })} value={selectedRating} />
        
        {errors.score && (
          <label className="label">
            <span className="label-text-alt text-error">{errors.score.message}</span>
          </label>
        )}
      </div>

      {/* Review Guidelines Toggle */}
      <Button
        variant="ghost"
        size="sm"
        type="button"
        onClick={() => {
          haptic.light(); // Light feedback for guidelines toggle
          setShowGuidelines(!showGuidelines);
        }}
        className={`text-base-content/70 hover:text-base-content ${
          mobile && isKeyboardOpen ? 'mb-3' : 'mb-4'
        } ${
          mobile ? 'touch-manipulation' : ''
        }`}
        aria-expanded={showGuidelines}
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Review Guidelines
      </Button>
      
      {showGuidelines && (
        <div className="bg-base-200 border border-base-300 rounded-lg p-4 mb-4 text-sm animate-slideIn">
          <ul className="list-disc list-inside space-y-1 text-base-content/80">
            <li>Be respectful and constructive</li>
            <li>Provide specific examples when possible</li>
            <li>Focus on teaching methods and course content</li>
            <li>Avoid personal attacks or inappropriate language</li>
            <li>Share both positives and areas for improvement</li>
          </ul>
        </div>
      )}

      {/* Comment Textarea with real-time feedback */}
      <div className={`form-control ${
        mobile && isKeyboardOpen ? 'mb-3' : 'mb-4'
      }`}>
        <label htmlFor="review-comment" className="label">
          <span className={`label-text font-semibold text-base-content ${
            mobile ? 'text-sm' : ''
          }`}>
            Your Review {commentRequired ? <span className="text-error">*</span> : <span className="font-normal text-base-content/60">(optional)</span>}
          </span>
          <span className={`label-text-alt text-base-content/70 ${
            mobile ? 'text-xs' : ''
          }`}>
            {charCount}/500 {isValidating && <span className="loading loading-dots loading-xs"></span>}
          </span>
        </label>
        
        <textarea
          id="review-comment"
          {...register('comment')}
          value={commentText}
          onChange={handleTextChange}
          className={`w-full bg-base-100 border-2 border-base-300 text-base-content placeholder-base-content/60 resize-none transition-all duration-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary ${
            mobile ? 'h-32 text-base min-h-[128px]' : 'h-32'
          } ${
            contentWarnings.length > 0 ? 'border-error focus:border-error focus:ring-error' : 'hover:border-primary'
          } ${
            mobile ? 'touch-manipulation' : ''
          }`}
          placeholder={getPlaceholderText(selectedRating)}
          aria-label="Review comment"
          aria-describedby="comment-warnings comment-suggestions"
          aria-invalid={errors.comment ? 'true' : 'false'}
          maxLength={500}
        />
        
        {/* Content warnings */}
        {contentWarnings.length > 0 && (
          <div id="comment-warnings" role="alert" className="alert alert-error mt-2 text-sm animate-shake">
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <ul className="list-disc list-inside">
              {contentWarnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Suggestions */}
        {suggestions.length > 0 && contentWarnings.length === 0 && (
          <div id="comment-suggestions" role="status" className="alert alert-info mt-2 text-sm">
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <ul className="list-disc list-inside">
              {suggestions.slice(0, 2).map((suggestion, idx) => (
                <li key={idx}>{suggestion}</li>
              ))}
            </ul>
          </div>
        )}
        
        {errors.comment && (
          <label className="label">
            <span className="label-text-alt text-error">{errors.comment.message}</span>
          </label>
        )}
      </div>

      {/* Error message */}
      {createRatingMutation.error && (
        <div role="alert" className="alert alert-error mt-4 animate-shake">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{(createRatingMutation.error as Error).message}</span>
        </div>
      )}

      {/* Success message */}
      {createRatingMutation.isSuccess && (
        <div role="alert" className="alert alert-success mt-4 animate-fadeIn">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-semibold">{existingRating ? 'Review updated' : 'Thank you for your review!'}</span>
        </div>
      )}

      {/* Submit button with loading state */}
      <div className={`flex items-center justify-between ${
        mobile && isKeyboardOpen ? 'mt-4' : 'mt-6'
      } ${
        mobile ? 'flex-col gap-3' : ''
      }`}>
        <div className={`text-base-content/70 ${
          mobile ? 'text-xs order-2' : 'text-sm'
        }`}>
          {isAnonymous || !user ? (
            <span className="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
              Submitting anonymously
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Submitting as {user?.email}
            </span>
          )}
        </div>
        
        <Button
          variant="primary"
          type="submit"
          loading={isSubmitting || createRatingMutation.isPending}
          block={mobile}
          wide={!mobile}
          touch={mobile ? 'tall' : undefined}
          className={`rounded-lg font-semibold ${mobile ? 'order-1' : 'px-8'}`}
          disabled={isSubmitting || createRatingMutation.isPending || cooldownBlocked || selectedRating === 0 || contentWarnings.length > 0 || (commentRequired && commentText.trim().length < 10)}
        >
          {existingRating ? (
            <>
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Update Review
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Submit Review
            </>
          )}
        </Button>
      </div>
    </form>
  );
}