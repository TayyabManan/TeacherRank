import { useCreateRating } from './useRatings';
import { moderateContent, validateReviewQuality } from '../lib/profanityFilter';

export interface SubmitRatingArgs {
  teacherId: string;
  score: number;
  comment: string;
  studentId: string | null; // null = submit anonymously
}

export type SubmitRatingResult = { ok: true } | { ok: false; warnings: string[] };

/**
 * Shared rating-submission pipeline used by BOTH the full review form
 * (RatingFormEnhanced) and the inline quick-rate widget (InlineRating), so the
 * moderation checks and the create/update mutation live in exactly one place.
 *
 * Returns content warnings instead of throwing for the "needs revision" case.
 * The underlying mutation still throws for hard failures (e.g. the anonymous
 * 24h cooldown), so callers should await within a try/catch and read
 * `mutation.error` for the message.
 */
export function useSubmitRating() {
  const mutation = useCreateRating();

  const submit = async ({
    teacherId,
    score,
    comment,
    studentId,
  }: SubmitRatingArgs): Promise<SubmitRatingResult> => {
    const trimmed = (comment ?? '').trim();

    // Only moderate when a comment was actually written (it's optional for 3★+).
    if (trimmed.length > 0) {
      const quality = validateReviewQuality(trimmed, score);
      if (!quality.isValid) {
        return { ok: false, warnings: quality.errors };
      }
      const moderation = moderateContent(trimmed);
      if (!moderation.isClean && moderation.score < 50) {
        return {
          ok: false,
          warnings: ['Please revise your review to be more constructive and respectful'],
        };
      }
    }

    await mutation.mutateAsync({
      teacher_id: teacherId,
      student_id: studentId,
      score: Number(score),
      comment: comment || '',
    });
    return { ok: true };
  };

  return { submit, mutation };
}
