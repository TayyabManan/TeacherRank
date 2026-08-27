import React from 'react';
import { isTopRated } from '../lib/reviewStandards';

interface TopRatedBadgeProps {
  rating?: number | null;
  count?: number | null;
}

/**
 * The one evidence-gated badge (thresholds in lib/reviewStandards.ts — also
 * rendered into /how-reviews-work's prose, so they can't drift apart).
 * Renders nothing below the bar; wrap in `empty:hidden` when a spacing
 * container must collapse with it.
 */
export function TopRatedBadge({ rating, count }: TopRatedBadgeProps) {
  if (!isTopRated(rating, count)) return null;
  return (
    <span className="text-xs font-medium text-primary bg-primary/10 rounded-md px-2 py-0.5">
      Top rated
    </span>
  );
}
