import React from 'react';
import { RatingStars } from './RatingStars';
import type { RatingWithRelations } from '../types';

/** "edited" only when the update is meaningfully after creation — DB defaults
 *  can stamp updated_at ≈ created_at on insert. */
const isEdited = (review: RatingWithRelations): boolean =>
  !!review.updated_at &&
  new Date(review.updated_at).getTime() - new Date(review.created_at).getTime() > 60_000;

interface ReviewCardProps {
  review: RatingWithRelations;
  currentUserId?: string;
  /** Quick-view variant (modal): tighter paddings, clamped comment, score-first layout. */
  compact?: boolean;
}

/**
 * THE review card — one component for every surface (profile, modal), so the
 * trust metadata (honest dates, "· edited", "Anonymous student", 'A' monogram)
 * can never drift between them. CLAUDE.md's review-presentation rules are
 * implemented here and only here.
 */
export const ReviewCard = React.memo<ReviewCardProps>(({ review, currentUserId, compact = false }) => {
  const isOwn = !!currentUserId && review.student_id === currentUserId;
  const name = isOwn ? 'Your review' : (review.student?.display_name || 'Anonymous student');
  const initial = review.student?.display_name?.charAt(0) || 'A';
  const edited = isEdited(review);
  const date = new Date(review.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: compact ? 'short' : 'long',
    day: 'numeric',
  });

  if (compact) {
    return (
      <article className="bg-base-100 border border-base-300 rounded-lg p-3 space-y-2">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <RatingStars rating={review.score} size={14} allowHalf={true} />
            <span className="font-semibold text-base-content tabular-nums text-xs">
              {review.score}/5
            </span>
          </div>
          <time dateTime={review.created_at} className="text-xs text-base-content/70">
            {date}
            {edited && <span> · edited</span>}
          </time>
        </header>

        {review.comment && (
          <p dir="auto" className="text-base-content/80 text-sm leading-relaxed line-clamp-3">
            {review.comment}
          </p>
        )}

        <footer className="flex items-center gap-2 text-xs text-base-content/70">
          <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
            <span className="text-primary text-xs font-medium">{initial}</span>
          </div>
          <span dir="auto" className="truncate">{name}</span>
        </footer>
      </article>
    );
  }

  return (
    <article className="bg-base-100 border border-base-300 rounded-lg shadow-sm p-4 md:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center font-semibold flex-shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <h3 dir="auto" className="font-semibold text-base-content text-sm md:text-base truncate">
              {name}
            </h3>
            <p className="text-xs md:text-sm text-base-content/60">
              <time dateTime={review.created_at}>{date}</time>
              {edited && <span> · edited</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start flex-shrink-0">
          <RatingStars rating={review.score} size={14} allowHalf={true} />
          <span className="text-sm font-semibold text-base-content tabular-nums">
            {review.score}
          </span>
        </div>
      </div>
      {review.comment && (
        <p dir="auto" className="text-base-content/90 leading-relaxed text-sm md:text-base break-words">
          {review.comment}
        </p>
      )}
    </article>
  );
});

ReviewCard.displayName = 'ReviewCard';
