import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ratingSchema, RatingFormData } from '../lib/validation';
import { useCreateRating, useUserRating } from '../hooks/useRatings';
import { useUser } from '../hooks/useAuth';
import { FormSelect, FormTextarea } from './FormInput';
import { logger } from '../lib/logger';
import { RatingStars } from './RatingStars';
import { useAnonymousTracking } from '../lib/anonymousTracking';

interface Props {
  teacherId: string;
  onSaved?: () => void;
}

export default function RatingForm({ teacherId, onSaved }: Props) {
  const { data: user } = useUser();
  const { data: existingRating } = useUserRating(teacherId, user?.id);
  const createRatingMutation = useCreateRating();
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedRating, setSelectedRating] = useState(existingRating?.score || 5);

  // Track anonymous reviews
  const { hasReviewed, canReview, cooldownMessage } = useAnonymousTracking(teacherId);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
  } = useForm<RatingFormData>({
    resolver: zodResolver(ratingSchema),
    defaultValues: {
      score: existingRating?.score || 5,
      comment: existingRating?.comment || '',
    },
  });

  // Update form value when rating changes
  React.useEffect(() => {
    setValue('score', selectedRating);
  }, [selectedRating, setValue]);

  // Reset success state after showing success message
  React.useEffect(() => {
    if (createRatingMutation.isSuccess) {
      const timer = setTimeout(() => {
        createRatingMutation.reset();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [createRatingMutation]);

  const onSubmit = async (data: RatingFormData) => {
    // For non-logged in users, always anonymous
    if (!user) {
      try {
        await createRatingMutation.mutateAsync({
          teacher_id: teacherId,
          student_id: null,
          score: Number(data.score),
          comment: data.comment,
        });

        if (onSaved) onSaved();
        reset();
        setSelectedRating(5);
      } catch (error) {
        logger.error('Failed to save rating', error);
      }
      return;
    }

    // For logged-in users
    try {
      if (existingRating) {
        // Update existing review - always keep the same student_id (can't change anonymous status)
        await createRatingMutation.mutateAsync({
          teacher_id: teacherId,
          student_id: user.id,
          score: Number(data.score),
          comment: data.comment,
        });
      } else {
        // New review - use the selected mode (anonymous or not)
        await createRatingMutation.mutateAsync({
          teacher_id: teacherId,
          student_id: isAnonymous ? null : user.id,
          score: Number(data.score),
          comment: data.comment,
        });
      }

      if (onSaved) onSaved();
      if (!existingRating) {
        reset();
        setSelectedRating(5);
        setIsAnonymous(false); // Reset anonymous toggle after submission
      }
    } catch (error) {
      logger.error('Failed to save rating', error);
    }
  };

  // Allow anonymous reviews even when not logged in

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="card bg-white dark:bg-gray-800 p-4 border border-gray-200 dark:border-gray-600">
      {/* Anonymous submission info and restrictions */}
      {!user && (
        <>
          {hasReviewed && !canReview ? (
            <div className="alert alert-warning mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="font-bold text-sm">Already Reviewed</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  {cooldownMessage}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                  <a href="/auth" className="link link-primary">Sign in</a> to submit unlimited reviews and track your ratings.
                </p>
              </div>
            </div>
          ) : (
            <div className="alert alert-info mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  You can submit one anonymous review per teacher every 24 hours.
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  <a href="/auth" className="link link-primary">Sign in</a> to submit unlimited reviews and track your ratings.
                </p>
              </div>
            </div>
          )}
        </>
      )}
      
      {/* Anonymous checkbox - only for new reviews */}
      {user && !existingRating && (
        <div className="form-control mb-4">
          <label className="label cursor-pointer">
            <span className="label-text text-gray-700 dark:text-gray-300">
              Submit as Anonymous
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">(Cannot be changed later)</span>
            </span>
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="checkbox checkbox-primary"
            />
          </label>
        </div>
      )}
      
      {/* Warning for existing reviews (don't show when success message is visible) */}
      {user && existingRating && !createRatingMutation.isSuccess && (
        <div className="alert alert-info mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div className="flex-1">
            <h3 className="font-bold text-sm text-gray-800 dark:text-gray-200">Updating Your Review</h3>
            <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">You can edit your rating and comment, but the review will remain linked to your account.</div>
            <div className="text-xs mt-2 text-gray-600 dark:text-gray-400">
              <strong>Want to submit anonymously?</strong>
              <ol className="ml-4 mt-1">
                <li>1. Go to <a href="/dashboard" className="link link-primary">Dashboard</a></li>
                <li>2. Delete this review</li>
                <li>3. Return here to submit anonymously</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Rating Stars */}
      <div className="form-control mb-4">
        <label className="label">
          <span className="label-text text-gray-700 dark:text-gray-300">
            Rating<span className="text-error ml-1">*</span>
          </span>
        </label>
        <div className="flex items-center gap-4">
          <RatingStars
            rating={selectedRating}
            size={32}
            interactive={true}
            onRatingChange={(rating) => {
              setSelectedRating(rating);
              setValue('score', rating);
            }}
          />
          <span className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            {selectedRating === 5 ? 'Excellent' :
             selectedRating === 4 ? 'Good' :
             selectedRating === 3 ? 'Average' :
             selectedRating === 2 ? 'Below Average' : 'Poor'}
          </span>
        </div>
        {errors.score && (
          <label className="label">
            <span className="label-text-alt text-error">{errors.score.message}</span>
          </label>
        )}
      </div>
      
      {/* Hidden input to store the score value for form submission */}
      <input type="hidden" {...register('score', { valueAsNumber: true })} value={selectedRating} />

      <FormTextarea
        label="Review"
        name="comment"
        register={register}
        error={errors.comment}
        required
        placeholder="Share your experience with this teacher..."
        rows={4}
      />

      {createRatingMutation.error && (
        <div role="alert" className="alert alert-error mt-4">
          <span>{(createRatingMutation.error as Error).message}</span>
        </div>
      )}

      {createRatingMutation.isSuccess && (
        <div role="alert" className="alert alert-success mt-4">
          <span>{existingRating ? 'Rating updated!' : 'Rating submitted!'}</span>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-500 dark:text-gray-400">
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
          className="btn btn-primary"
          disabled={isSubmitting || createRatingMutation.isPending || (!user && hasReviewed && !canReview)}
        >
          {isSubmitting || createRatingMutation.isPending ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : existingRating ? (
            'Update Rating'
          ) : (!user && hasReviewed && !canReview) ? (
            'Already Reviewed'
          ) : (
            'Submit Rating'
          )}
        </button>
      </div>
    </form>
  );
}