import { useEffect, useState } from 'react';
import { ratingSchema } from '../lib/validation';
import { useUser } from '../hooks/useAuth';
import { useUserRating } from '../hooks/useRatings';
import { useSubmitRating } from '../hooks/useSubmitRating';
import { useAnonymousTracking } from '../lib/anonymousTracking';
import { getPlaceholderText } from '../lib/profanityFilter';
import { RatingStars } from './RatingStars';
import { Button } from './Button';
import { useHaptic } from '../lib/haptic';

interface Props {
  teacherId: string;
  /** Escape hatch to the full review form on the profile page. */
  onViewFullProfile: () => void;
  onSuccess?: () => void;
}

/**
 * Compact "rate without leaving the page" widget. Reuses the shared submit
 * pipeline, schema, and anonymous tracking. Progressive disclosure: the comment
 * box only appears for low ratings (≤2★), which the schema requires; 3★+ can
 * submit with a single tap.
 */
export function InlineRating({ teacherId, onViewFullProfile, onSuccess }: Props) {
  const { data: user } = useUser();
  const { data: existingRating } = useUserRating(teacherId, user?.id);
  const { submit, mutation } = useSubmitRating();
  const haptic = useHaptic();
  const anon = useAnonymousTracking(teacherId);

  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [postAnonymously, setPostAnonymously] = useState(false);

  // Pre-fill when the user has already rated this teacher (edit mode).
  useEffect(() => {
    if (existingRating) {
      setScore(existingRating.score);
      setComment(existingRating.comment || '');
    }
  }, [existingRating]);

  const commentRequired = score > 0 && score <= 2;
  const cooldownBlocked = !user && !existingRating && !anon.canReview;

  const submitDisabled =
    mutation.isPending ||
    score === 0 ||
    cooldownBlocked ||
    (commentRequired && comment.trim().length < 10);

  const handleSubmit = async () => {
    setWarnings([]);
    const parsed = ratingSchema.safeParse({ score, comment });
    if (!parsed.success) {
      haptic.error();
      setWarnings(parsed.error.issues.map((i) => i.message));
      return;
    }
    haptic.medium();
    try {
      const result = await submit({
        teacherId,
        score,
        comment,
        // null = anonymous: signed-out users, or signed-in users who opted out.
        studentId: user && !postAnonymously ? user.id : null,
      });
      if (!result.ok) {
        haptic.error();
        setWarnings(result.warnings);
        return;
      }
      haptic.success();
      setDone(true);
      onSuccess?.();
    } catch {
      // Hard failures (e.g. the 24h cooldown) surface via mutation.error below.
      haptic.error();
    }
  };

  if (done) {
    return (
      <div role="alert" className="alert alert-success animate-pop-in">
        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="font-semibold">{existingRating ? 'Review updated' : 'Thanks for rating!'}</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-base-300 bg-base-200 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-semibold text-base-content">
          {existingRating ? 'Update your rating' : 'Rate this teacher'}
        </h3>
        <button
          type="button"
          onClick={onViewFullProfile}
          className="text-sm text-primary hover:text-primary-focus underline transition-colors"
        >
          Full review
        </button>
      </div>

      <div className="flex flex-col items-center gap-1.5">
        <RatingStars
          rating={score}
          size={36}
          interactive
          allowHalf
          onRatingChange={(r) => {
            haptic.medium();
            setScore(r);
          }}
        />
        <p className="text-xs text-base-content/70">Tap a star to rate</p>
      </div>

      {commentRequired && (
        <div className="mt-3 animate-slideIn">
          <label htmlFor="inline-rating-comment" className="text-sm font-medium text-base-content">
            Add a brief reason <span className="text-error">*</span>
          </label>
          <textarea
            id="inline-rating-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            rows={3}
            dir="auto"
            placeholder={getPlaceholderText(score)}
            className="mt-1 w-full bg-base-100 border-2 border-base-300 rounded-lg px-3 py-2 text-base text-base-content placeholder-base-content/60 resize-none transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            aria-label="Reason for your rating"
          />
        </div>
      )}

      {warnings.length > 0 && (
        <div role="alert" className="alert alert-error mt-3 text-sm">
          <ul className="list-disc list-inside">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {mutation.error && (
        <div role="alert" className="alert alert-error mt-3 text-sm">
          <span>{(mutation.error as Error).message}</span>
        </div>
      )}

      {/* Same condition as the full form: only offer the toggle on a fresh
          review — edits keep their original attribution. */}
      {user && !existingRating && (
        <label className="mt-3 flex items-center justify-between gap-2 cursor-pointer bg-base-100 border border-base-300 rounded-lg px-3 py-2">
          <span className="text-sm text-base-content">
            Post anonymously
            <span className="block text-xs text-base-content/70">Your name won&rsquo;t be displayed</span>
          </span>
          <input
            type="checkbox"
            checked={postAnonymously}
            onChange={(e) => {
              haptic.light();
              setPostAnonymously(e.target.checked);
            }}
            className="checkbox checkbox-primary checkbox-sm"
            aria-label="Post review anonymously"
          />
        </label>
      )}

      {cooldownBlocked && anon.cooldownMessage && (
        <p className="mt-2 text-xs text-base-content/70">{anon.cooldownMessage}</p>
      )}

      {!user && !cooldownBlocked && (
        <p className="mt-2 text-xs text-base-content/70">
          Posting anonymously.{' '}
          <a href="/auth" className="text-primary underline hover:text-primary-focus">
            Sign in
          </a>{' '}
          to manage your reviews.
        </p>
      )}

      <Button
        variant="primary"
        block
        className="mt-3 rounded-lg font-semibold"
        loading={mutation.isPending}
        disabled={submitDisabled}
        onClick={handleSubmit}
      >
        {existingRating ? 'Update rating' : 'Submit rating'}
      </Button>
    </div>
  );
}
