import React from 'react';
import { StarSolidIcon } from './icons';
import { MIN_REVIEWS_FOR_DISTRIBUTION } from '../lib/reviewStandards';

export type StarBucket = 1 | 2 | 3 | 4 | 5;

/** Half-star scores land in a whole-star bucket (4.5 → 5, 0.5 → 1). Both the
 *  distribution counts and the star filter use this same mapping, so filtered
 *  results always match the bar counts exactly. */
export const starBucket = (score: number): StarBucket =>
  Math.min(5, Math.max(1, Math.round(score))) as StarBucket;

interface RatingDistributionProps {
  /** Count per whole-star bucket (scores rounded to the nearest star, clamped 1–5). */
  distribution: Record<StarBucket, number>;
  /** Currently active star filter, or null for all. */
  selected: number | null;
  /** Radio-with-toggle-off: clicking the active bar clears the filter. */
  onSelect: (star: number | null) => void;
}

/**
 * The ratings-distribution summary, built to the Baymard requirements: users
 * trust the histogram more than review text, and ~90% instinctively try to
 * click the bars as filters — so every bar IS a filter (mutually exclusive,
 * click-again to clear), the summary renders expanded (no disclosure), and
 * it hides ITSELF below MIN_REVIEWS_FOR_DISTRIBUTION (a sparse histogram
 * advertises emptiness rather than building trust) — callers render it
 * unconditionally. Note for callers that also apply the filter: ignore an
 * active filter when the histogram is hidden, or reviews end up filtered
 * with no visible control.
 */
export function RatingDistribution({ distribution, selected, onSelect }: RatingDistributionProps) {
  const total = ([1, 2, 3, 4, 5] as const).reduce((sum, star) => sum + (distribution[star] || 0), 0);
  if (total < MIN_REVIEWS_FOR_DISTRIBUTION) return null;

  return (
    <div
      className="bg-base-100 border border-base-300 rounded-lg shadow-sm p-4 md:p-5"
      role="group"
      aria-label="Filter reviews by star rating"
    >
      <div className="space-y-1">
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const count = distribution[star] || 0;
          const percentage = (count / total) * 100;
          const active = selected === star;

          return (
            <button
              key={star}
              type="button"
              onClick={() => onSelect(active ? null : star)}
              disabled={count === 0}
              aria-pressed={active}
              aria-label={`${star} star reviews: ${count}${active ? ' (filter active)' : ''}`}
              className={`w-full flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors ${
                count === 0
                  ? 'opacity-40 cursor-default'
                  : 'hover:bg-base-200 cursor-pointer'
              } ${active ? 'bg-base-200' : ''}`}
            >
              <span className="w-3 text-base-content/80 tabular-nums text-left">{star}</span>
              <StarSolidIcon className="w-3.5 h-3.5 text-rating shrink-0" />
              <span className="flex-1 h-2 rounded-full bg-base-200 border border-base-300 overflow-hidden">
                <span
                  className="block h-full rounded-full bg-rating"
                  style={{ width: `${percentage}%` }}
                />
              </span>
              <span className="w-8 text-right text-xs text-base-content/70 tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <p className="mt-3 text-xs text-base-content/70">
          Showing {selected}-star reviews only.{' '}
          <button
            type="button"
            className="text-primary hover:text-primary-focus underline"
            onClick={() => onSelect(null)}
          >
            Show all reviews
          </button>
        </p>
      )}
    </div>
  );
}
