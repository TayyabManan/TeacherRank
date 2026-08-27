import React, { Suspense, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from '../components/Meta';
import { useTeacher } from '../hooks/useTeachers';
import { useRatings } from '../hooks/useRatings';
import { useUser } from '../hooks/useAuth';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { ProfileSkeleton, ReviewListSkeleton, FormSkeleton } from '../components/Skeleton';
import { RatingStars } from '../components/RatingStars';
import { RatingDistribution, starBucket, StarBucket } from '../components/RatingDistribution';
import { ReviewCard } from '../components/ReviewCard';
import { TopRatedBadge } from '../components/TopRatedBadge';
import { AvatarImage } from '../components/AvatarImage';
import { Button, buttonClasses } from '../components/Button';
import { Reveal } from '../components/Reveal';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { SectionErrorBoundary } from '../components/SectionErrorBoundary';
import { SectionHeading } from '../components/SectionHeading';
import { DocumentIcon, MapPinIcon, LinkedInIcon, SpeechBubbleIcon } from '../components/icons';
import { MIN_REVIEWS_FOR_DISTRIBUTION, reviewCountLabel } from '../lib/reviewStandards';
import { jsonLd } from '../utils/jsonLd';
import type { RatingWithRelations } from '../types';

// ~540 lines of form + react-hook-form/zod wiring that only matters once the
// visitor decides to rate. Lazy so it stays out of the profile route chunk.
const RatingFormEnhanced = lazyWithRetry(() => import('../components/RatingFormEnhanced'));

interface ReviewsSectionProps {
  reviews: RatingWithRelations[] | undefined;
  isLoading: boolean;
  hasError: boolean;
  onRetry: () => void;
  currentUserId?: string;
}

/**
 * The reviews region owns the star filter, so a histogram click re-renders
 * only this subtree (not the hero, form, and head tags). Rendered with
 * key={teacher id} by the parent: navigating to another teacher remounts it,
 * which resets the filter for free.
 */
const ReviewsSection = React.memo<ReviewsSectionProps>(
  ({ reviews, isLoading, hasError, onRetry, currentUserId }) => {
    // One star filter at a time (radio semantics — Baymard). Client-side only:
    // reviews are already fetched, so filtering adds zero requests.
    const [starFilter, setStarFilter] = useState<number | null>(null);

    const ratingDistribution = useMemo(() => {
      if (!reviews || reviews.length === 0) return null;
      const distribution: Record<StarBucket, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
      reviews.forEach((review) => {
        distribution[starBucket(review.score)]++;
      });
      return distribution;
    }, [reviews]);

    const visibleReviews = useMemo(() => {
      if (!reviews) return [];
      // Ignore the filter whenever the histogram hides itself — otherwise a
      // shrunken review list could stay filtered with no visible control.
      if (starFilter === null || reviews.length < MIN_REVIEWS_FOR_DISTRIBUTION) return reviews;
      return reviews.filter((review) => starBucket(review.score) === starFilter);
    }, [reviews, starFilter]);

    return (
      <Reveal className="space-y-4">
        <SectionHeading
          as="h2"
          actions={
            <span className="flex items-center gap-3 text-sm">
              {reviews && reviews.length > 0 && (
                <span className="text-base-content/70 tabular-nums">
                  {reviewCountLabel(reviews.length)}
                </span>
              )}
              {/* Trust standards linked where the data is judged */}
              <Link to="/how-reviews-work" className="text-primary hover:text-primary-focus hover:underline whitespace-nowrap">
                How reviews work
              </Link>
            </span>
          }
        >
          Student reviews
        </SectionHeading>

        {isLoading ? (
          <ReviewListSkeleton count={3} />
        ) : hasError ? (
          <ErrorState
            title="Unable to load reviews"
            message="The reviews didn't come through. Try again in a moment."
            onRetry={onRetry}
          />
        ) : reviews && reviews.length > 0 ? (
          <>
            {/* Doubles as the star filter; hides itself below the published
                review minimum (lib/reviewStandards.ts). */}
            {ratingDistribution && (
              <RatingDistribution
                distribution={ratingDistribution}
                selected={starFilter}
                onSelect={setStarFilter}
              />
            )}

            {visibleReviews.length > 0 ? (
              <ul className="grid gap-4 list-none p-0 m-0">
                {visibleReviews.map((review) => (
                  <li key={review.id}>
                    <ReviewCard review={review} currentUserId={currentUserId} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title={`No ${starFilter}-star reviews`}
                description="No reviews land in this bucket yet."
                action={
                  <Button variant="secondary" onClick={() => setStarFilter(null)}>
                    Show all reviews
                  </Button>
                }
              />
            )}
          </>
        ) : (
          <EmptyState
            icon={<SpeechBubbleIcon className="w-10 h-10" />}
            title="No reviews yet"
            description="Be the first to share your experience with this teacher."
            action={
              <a href="#rate" className={buttonClasses({ variant: 'primary', className: 'inline-flex items-center gap-2' })}>
                Write the first review
              </a>
            }
          />
        )}
      </Reveal>
    );
  }
);

ReviewsSection.displayName = 'ReviewsSection';

export default function TeacherProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: currentUser } = useUser();

  const { data: teacher, isLoading: teacherLoading, error: teacherError } = useTeacher(id || '');
  const { data: reviews, isLoading: reviewsLoading, error: reviewsError, refetch: refetchReviews } = useRatings(id);

  const reviewCount = reviews?.length ?? teacher?.ratings_count ?? 0;

  // No need for manual refetch - React Query will handle it via invalidation
  const handleRatingSaved = () => {
    // The useCreateRating hook already invalidates and refetches the necessary queries
  };

  if (!id) {
    return (
      <div className="max-w-wide mx-auto">
        <div role="alert" className="alert alert-error">
          <span>Invalid teacher ID</span>
        </div>
      </div>
    );
  }

  if (teacherError) {
    return (
      <div className="max-w-wide mx-auto">
        <ErrorState
          title="Couldn't load this profile"
          message="Something went wrong on our end. Try again in a moment."
          secondaryAction={
            <Button variant="primary" onClick={() => navigate('/')}>
              Back to teachers
            </Button>
          }
        />
      </div>
    );
  }

  if (teacherLoading) {
    return (
      <div className="max-w-wide mx-auto">
        <ProfileSkeleton />
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="max-w-wide mx-auto">
        <EmptyState
          title="Teacher not found"
          description="This profile doesn't exist or may have been removed."
          action={
            <Button variant="primary" onClick={() => navigate('/')}>
              Back to teachers
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-wide mx-auto space-y-4 md:space-y-6">
      <Helmet>
        <title>{`${teacher.name} - ${teacher.designation} at ${teacher.institute}`}</title>
        <meta name="description" content={`Read ${teacher.ratings_count || 0} student reviews for ${teacher.name}, ${teacher.designation} at ${teacher.institute}. Average rating: ${teacher.average_rating?.toFixed(1) || 'N/A'}/5.`} />
        <meta name="keywords" content={`${teacher.name}, ${teacher.institute}, ${teacher.designation}, teacher review, professor rating, student feedback`} />
        <link rel="canonical" href={`https://teacherrank.vercel.app/teacher/${teacher.id}`} />

        {/* Open Graph tags */}
        <meta property="og:title" content={`${teacher.name} - ${teacher.designation} at ${teacher.institute}`} />
        <meta property="og:description" content={`Read ${teacher.ratings_count || 0} student reviews. Average rating: ${teacher.average_rating?.toFixed(1) || 'N/A'}/5`} />
        <meta property="og:type" content="profile" />
        <meta property="og:url" content={`https://teacherrank.vercel.app/teacher/${teacher.id}`} />
        <meta property="og:image" content={teacher.avatar_url || `https://teacherrank.vercel.app/default-avatar.png`} />

        {/* Twitter Card tags */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={`${teacher.name} - ${teacher.designation}`} />
        <meta name="twitter:description" content={`${teacher.ratings_count || 0} reviews, ${teacher.average_rating?.toFixed(1) || 'N/A'}/5 rating at ${teacher.institute}`} />

        {/* Schema.org structured data */}
        <script type="application/ld+json">
          {jsonLd({
            "@context": "https://schema.org",
            "@type": "Person",
            "name": teacher.name,
            "jobTitle": teacher.designation,
            "worksFor": {
              "@type": "EducationalOrganization",
              "name": teacher.institute
            },
            "aggregateRating": teacher.average_rating ? {
              "@type": "AggregateRating",
              "ratingValue": teacher.average_rating.toFixed(1),
              "bestRating": "5",
              "worstRating": "1",
              "ratingCount": teacher.ratings_count || 0
            } : undefined,
            "url": `https://teacherrank.vercel.app/teacher/${teacher.id}`
          })}
        </script>

        {/* BreadcrumbList structured data */}
        <script type="application/ld+json">
          {jsonLd({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": "https://teacherrank.vercel.app"
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": teacher.institute,
                "item": `https://teacherrank.vercel.app/institute/${encodeURIComponent(teacher.institute)}`
              },
              {
                "@type": "ListItem",
                "position": 3,
                "name": teacher.name,
                "item": `https://teacherrank.vercel.app/teacher/${teacher.id}`
              }
            ]
          })}
        </script>
      </Helmet>

      {/* Hero — a quiet elevated surface; the brand violet appears only as
          small marks (avatar ring, institute link, top-rated chip). */}
      <header className="bg-base-100 border border-base-300 rounded-lg shadow-sm p-4 md:p-8">
        <div className="flex flex-col sm:flex-row items-start gap-4 md:gap-6">
          <AvatarImage
            src={teacher.avatar_url || undefined}
            name={teacher.name}
            designation={teacher.designation}
            institute={teacher.institute}
            size={80}
            loading="eager"
            className="ring-2 ring-primary/20 md:w-28 md:h-28"
          />

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 dir="auto" className="text-3xl md:text-4xl font-bold text-base-content">
                {teacher.name}
              </h1>
              <TopRatedBadge rating={teacher.average_rating} count={teacher.ratings_count} />
            </div>

            <p className="mt-1 text-base md:text-lg text-base-content/70">
              {/* Guarded: request-created teachers can carry a blank designation,
                  and a dangling separator reads broken. */}
              {teacher.designation && (
                <>
                  {teacher.designation}
                  <span className="mx-1.5 text-base-content/30" aria-hidden="true">·</span>
                </>
              )}
              <Link
                to={`/institute/${encodeURIComponent(teacher.institute)}`}
                className="text-primary hover:text-primary-focus hover:underline"
              >
                {teacher.institute}
              </Link>
            </p>

            {(teacher.department || teacher.city) && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-base-content/70">
                {teacher.department && (
                  <span className="inline-flex items-center gap-1.5">
                    <DocumentIcon className="w-4 h-4" />
                    {teacher.department}
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

            {/* The average never appears without its count — an unpaired
                average gets discounted or distrusted. */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {teacher.average_rating ? (
                <>
                  <RatingStars rating={teacher.average_rating} size={18} allowHalf={true} />
                  <span className="font-display text-xl font-semibold text-base-content tabular-nums">
                    {teacher.average_rating.toFixed(1)}
                  </span>
                  <span className="text-sm text-base-content/70 tabular-nums">
                    · {reviewCountLabel(reviewCount)}
                  </span>
                </>
              ) : (
                <span className="text-sm text-base-content/70">
                  No reviews yet. Be the first to help other students.
                </span>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <a href="#rate" className={buttonClasses({ variant: 'primary' })}>
                Rate this teacher
              </a>
              {teacher.linkedin_url && (
                <a
                  href={teacher.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClasses({ variant: 'outline', className: 'gap-2' })}
                >
                  <LinkedInIcon className="w-4 h-4" />
                  LinkedIn
                </a>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* About */}
      <section className="bg-base-100 border border-base-300 rounded-lg shadow-sm p-4 md:p-6">
        <SectionHeading as="h2">About</SectionHeading>
        <p dir="auto" className="mt-3 md:mt-4 text-base-content/80 leading-relaxed text-sm md:text-base max-w-reading">
          {teacher.bio || 'This teacher hasn\'t added a biography yet.'}
        </p>
      </section>

      {/* Rate */}
      <section id="rate" className="bg-base-100 border border-base-300 rounded-lg shadow-sm p-4 md:p-6">
        <SectionHeading as="h2" className="mb-4 md:mb-6">Rate this teacher</SectionHeading>
        <SectionErrorBoundary
          resetKey={id}
          title="The rating form hit a snag"
          message="You can still read this profile. Reload the form to try rating again."
        >
          <Suspense fallback={<FormSkeleton />}>
            <RatingFormEnhanced teacherId={id} onSaved={handleRatingSaved} />
          </Suspense>
        </SectionErrorBoundary>
      </section>

      {/* Reviews — the product's core content: elevated cards on the page
          ground, with the distribution summary acting as a star filter. */}
      <SectionErrorBoundary
        resetKey={id}
        title="We couldn't show the reviews"
        message="The rest of this profile is fine. Try loading the reviews again."
      >
        <ReviewsSection
          key={id}
          reviews={reviews}
          isLoading={reviewsLoading}
          hasError={!!reviewsError}
          onRetry={() => refetchReviews()}
          currentUserId={currentUser?.id}
        />
      </SectionErrorBoundary>
    </div>
  );
}
