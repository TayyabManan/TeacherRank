import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ratingSchema, RatingFormData } from '../lib/validation';
import { useCreateRating, useUserRating } from '../hooks/useRatings';
import { useUser } from '../hooks/useAuth';
import { logger } from '../lib/logger';
import { RatingStars } from './RatingStars';
import { useHaptic } from '../lib/haptic';
import { useMobileDetection, useKeyboardHeight } from '../lib/mobile';
import { 
  moderateContent, 
  getReviewSuggestions, 
  getPlaceholderText,
  validateReviewQuality 
} from '../lib/profanityFilter';

interface Props {
  teacherId: string;
  onSaved?: () => void;
}

// Emoji reactions for different ratings (now including half ratings)
const ratingEmojis: Record<number, { emoji: string; label: string; color: string }> = {
  0.5: { emoji: '😞', label: 'Very Poor', color: 'text-red-600' },
  1: { emoji: '😟', label: 'Poor', color: 'text-red-500' },
  1.5: { emoji: '😔', label: 'Disappointing', color: 'text-orange-600' },
  2: { emoji: '😕', label: 'Below Average', color: 'text-orange-500' },
  2.5: { emoji: '🤔', label: 'Mixed Feelings', color: 'text-yellow-600' },
  3: { emoji: '😐', label: 'Average', color: 'text-yellow-500' },
  3.5: { emoji: '🙂', label: 'Above Average', color: 'text-lime-500' },
  4: { emoji: '😊', label: 'Good', color: 'text-blue-500' },
  4.5: { emoji: '😃', label: 'Very Good', color: 'text-blue-600' },
  5: { emoji: '🤩', label: 'Excellent', color: 'text-green-500' }
};

// Encouraging messages for different scenarios
const encouragingMessages = [
  "Your feedback helps teachers improve! 🌟",
  "Thank you for taking the time to review! 📚",
  "Your honest opinion matters! 💭",
  "Help future students make informed decisions! 🎓"
];

export default function RatingFormEnhanced({ teacherId, onSaved }: Props) {
  const { data: user } = useUser();
  const { data: existingRating } = useUserRating(teacherId, user?.id);
  const createRatingMutation = useCreateRating();
  const haptic = useHaptic();
  const { mobile } = useMobileDetection();
  const { keyboardHeight, isKeyboardOpen } = useKeyboardHeight();
  
  // State
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedRating, setSelectedRating] = useState(existingRating?.score || 0);
  const [commentText, setCommentText] = useState(existingRating?.comment || '');
  const [charCount, setCharCount] = useState(0);
  const [contentWarnings, setContentWarnings] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      score: existingRating?.score || 5,
      comment: existingRating?.comment || '',
    },
  });

  // Update form value when rating changes
  useEffect(() => {
    setValue('score', selectedRating);
    if (selectedRating > 0) {
      haptic.light(); // Light feedback for rating selection
      setSuggestions(getReviewSuggestions(selectedRating, commentText));
    }
  }, [selectedRating, setValue, haptic]);

  // Real-time content moderation
  useEffect(() => {
    if (commentText.length > 5) {
      const debounceTimer = setTimeout(() => {
        setIsValidating(true);
        const moderation = moderateContent(commentText);
        setContentWarnings(moderation.issues);
        setSuggestions([...moderation.suggestions, ...getReviewSuggestions(selectedRating, commentText)]);
        setIsValidating(false);
      }, 500);
      return () => clearTimeout(debounceTimer);
    }
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
    
    // Validate content quality
    const quality = validateReviewQuality(data.comment, data.score);
    if (!quality.isValid) {
      haptic.error(); // Error feedback for validation failure
      setContentWarnings(quality.errors);
      return;
    }

    // Final profanity check
    const moderation = moderateContent(data.comment);
    if (!moderation.isClean && moderation.score < 50) {
      haptic.error(); // Error feedback for content moderation failure
      setContentWarnings(['Please revise your review to be more constructive and respectful']);
      return;
    }

    try {
      if (!user) {
        // Anonymous submission
        await createRatingMutation.mutateAsync({
          teacher_id: teacherId,
          student_id: null,
          score: Number(data.score),
          comment: data.comment,
        });
      } else {
        // User submission
        await createRatingMutation.mutateAsync({
          teacher_id: teacherId,
          student_id: isAnonymous ? null : user.id,
          score: Number(data.score),
          comment: data.comment,
        });
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
      className={`card bg-white dark:bg-gray-800 shadow-xl border-2 border-gray-200 dark:border-gray-600 hover:shadow-2xl transition-all duration-300 ${
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
        <h2 className={`font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent ${
          mobile ? 'text-xl' : 'text-2xl'
        }`}>
          Share Your Experience
        </h2>
        <p className={`text-gray-600 dark:text-gray-400 animate-pulse ${
          mobile ? 'text-xs' : 'text-sm'
        }`}>
          {encouragingMessages[Math.floor(Math.random() * encouragingMessages.length)]}
        </p>
      </div>

      {/* Anonymous submission info for non-logged users */}
      {!user && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4 animate-slideIn">
          <div className="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" stroke="currentColor" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                🕵️ Anonymous Review
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Your review will be posted anonymously. 
                <a href="/auth" className="ml-1 font-medium text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 underline transition-colors">
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
          <label className={`label cursor-pointer bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors ${
            mobile ? 'p-2' : 'p-3'
          } ${
            mobile ? 'min-h-[48px] touch-manipulation' : ''
          }`}>
            <span className="label-text font-medium text-gray-800 dark:text-gray-200">
              🕵️ Submit Anonymously
              <span className={`text-gray-600 dark:text-gray-400 block ${
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
            <h3 className="font-bold text-sm text-blue-800 dark:text-blue-200">Updating Your Review</h3>
            <div className="text-xs mt-1 text-gray-700 dark:text-gray-300">You're editing your existing review.</div>
          </div>
        </div>
      )}

      {/* Interactive Rating Section */}
      <div className={`form-control ${
        mobile && isKeyboardOpen ? 'mb-4' : 'mb-6'
      }`}>
        <label className="label">
          <span className={`label-text font-semibold text-gray-800 dark:text-gray-200 ${
            mobile ? 'text-base' : 'text-lg'
          }`}>
            How would you rate this teacher? <span className="text-error">*</span>
          </span>
        </label>
        
        {/* Rating stars with emoji feedback */}
        <div className={`flex flex-col items-center gap-3 md:gap-4 bg-gray-100 dark:bg-gray-700 rounded-xl ${
          mobile ? 'p-4' : 'p-4'
        }`}>
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
            <div className={`text-gray-600 dark:text-gray-400 mt-1 text-center ${
              mobile ? 'text-xs' : 'text-xs'
            }`}>
              {mobile ? 'Tap a star to rate' : 'Click on a star or hover to select half ratings'}
            </div>
          </div>
          
          {/* Emoji feedback */}
          {selectedRating > 0 && ratingEmojis[selectedRating] && (
            <div className={`flex items-center gap-2 animate-fadeIn ${ratingEmojis[selectedRating].color}`}>
              <span className="text-4xl animate-pulse">
                {ratingEmojis[selectedRating].emoji}
              </span>
              <span className="font-bold text-lg">
                {ratingEmojis[selectedRating].label}
              </span>
              <span className="text-sm opacity-75">
                ({selectedRating} stars)
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
      <button
        type="button"
        onClick={() => {
          haptic.light(); // Light feedback for guidelines toggle
          setShowGuidelines(!showGuidelines);
        }}
        className={`btn btn-ghost btn-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 ${
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
      </button>
      
      {showGuidelines && (
        <div className="alert alert-warning mb-4 text-sm animate-slideIn bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
          <ul className="list-disc list-inside space-y-1 text-yellow-800 dark:text-yellow-200">
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
          <span className={`label-text font-semibold text-gray-800 dark:text-gray-200 ${
            mobile ? 'text-sm' : ''
          }`}>
            Your Review <span className="text-error">*</span>
          </span>
          <span className={`label-text-alt text-gray-500 dark:text-gray-400 ${
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
          className={`w-full bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-none transition-all duration-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
            mobile ? 'h-32 text-base min-h-[128px]' : 'h-32'
          } ${
            contentWarnings.length > 0 ? 'border-red-500 dark:border-red-400 focus:border-red-500 focus:ring-red-500' : 'hover:border-purple-300 dark:hover:border-purple-500'
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
          <div id="comment-warnings" className="alert alert-error mt-2 text-sm animate-shake bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <ul className="list-disc list-inside text-red-800 dark:text-red-200">
              {contentWarnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
        
        {/* Suggestions */}
        {suggestions.length > 0 && contentWarnings.length === 0 && (
          <div id="comment-suggestions" className="alert alert-info mt-2 text-sm bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <ul className="list-disc list-inside text-blue-800 dark:text-blue-200">
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
        <div role="alert" className="alert alert-error mt-4 animate-shake bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-red-800 dark:text-red-200">{(createRatingMutation.error as Error).message}</span>
        </div>
      )}

      {/* Success message */}
      {createRatingMutation.isSuccess && (
        <div role="alert" className="alert alert-success mt-4 animate-fadeIn bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-semibold text-green-800 dark:text-green-200">{existingRating ? 'Review updated successfully!' : 'Thank you for your review!'}</span>
        </div>
      )}

      {/* Submit button with loading state */}
      <div className={`flex items-center justify-between ${
        mobile && isKeyboardOpen ? 'mt-4' : 'mt-6'
      } ${
        mobile ? 'flex-col gap-3' : ''
      }`}>
        <div className={`text-gray-600 dark:text-gray-400 ${
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
        
        <button
          type="submit"
          className={`btn bg-purple-600 hover:bg-purple-700 text-white border-purple-600 hover:border-purple-700 shadow-lg hover:shadow-xl transition-all duration-200 disabled:bg-gray-400 disabled:border-gray-400 disabled:text-white disabled:cursor-not-allowed ${
            mobile ? 'btn-block min-h-[48px] order-1 touch-manipulation rounded-lg font-semibold' : 'btn-wide rounded-lg font-semibold px-8'
          }`}
          disabled={isSubmitting || createRatingMutation.isPending || selectedRating === 0 || contentWarnings.length > 0}
          aria-busy={isSubmitting || createRatingMutation.isPending}
        >
          {isSubmitting || createRatingMutation.isPending ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              Submitting...
            </>
          ) : existingRating ? (
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
        </button>
      </div>
    </form>
  );
}

// Add CSS animations (add to your global CSS or Tailwind config)
const animationStyles = `
@keyframes slideIn {
  from {
    transform: translateY(-10px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-2px); }
  20%, 40%, 60%, 80% { transform: translateX(2px); }
}

.animate-slideIn {
  animation: slideIn 0.3s ease-out;
}

.animate-fadeIn {
  animation: fadeIn 0.5s ease-out;
}

.animate-shake {
  animation: shake 0.5s ease-in-out;
}

.drop-shadow-glow {
  filter: drop-shadow(0 0 10px currentColor);
}
`;