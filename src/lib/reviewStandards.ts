/**
 * The published review standards — the single source for every threshold the
 * /how-reviews-work page promises. Rendering surfaces AND the trust page's
 * prose import from here, so a rule change updates the product and its
 * published description in one edit (an out-of-date transparency page is
 * worse than none).
 */

/** "Top rated" needs evidence, not just a high number — volume is part of credibility. */
export const TOP_RATED_MIN_AVG = 4.5;
export const TOP_RATED_MIN_REVIEWS = 10;

/** Below this many reviews the ratings histogram hides itself — a sparse
 *  histogram implies more data than actually exists. */
export const MIN_REVIEWS_FOR_DISTRIBUTION = 6;

export const isTopRated = (
  avg: number | null | undefined,
  count: number | null | undefined,
): boolean => (avg ?? 0) >= TOP_RATED_MIN_AVG && (count ?? 0) >= TOP_RATED_MIN_REVIEWS;

/** "1 review" / "N reviews" — the wording every surface pairs with an average. */
export const reviewCountLabel = (count: number): string =>
  `${count} ${count === 1 ? 'review' : 'reviews'}`;
