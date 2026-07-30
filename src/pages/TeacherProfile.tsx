import React, { Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTeacher } from '../hooks/useTeachers';
import { useRatings } from '../hooks/useRatings';
import { useUser } from '../hooks/useAuth';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { ProfileSkeleton, ReviewListSkeleton, FormSkeleton } from '../components/Skeleton';
import { RatingStars } from '../components/RatingStars';
import { AvatarImage } from '../components/AvatarImage';
import { Button, buttonClasses } from '../components/Button';
import { CountUp } from '../components/CountUp';
import { Reveal } from '../components/Reveal';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { SectionErrorBoundary } from '../components/SectionErrorBoundary';
import { SpeechBubbleIcon } from '../components/icons';
import { jsonLd } from '../utils/jsonLd';
import type { RatingWithRelations } from '../types';

// ~540 lines of form + react-hook-form/zod wiring that only matters once the
// visitor decides to rate. Lazy so it stays out of the profile route chunk.
const RatingFormEnhanced = lazyWithRetry(() => import('../components/RatingFormEnhanced'));

export default function TeacherProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: currentUser } = useUser();
  
  const { data: teacher, isLoading: teacherLoading, error: teacherError } = useTeacher(id || '');
  const { data: reviews, isLoading: reviewsLoading, error: reviewsError, refetch: refetchReviews } = useRatings(id);

  // Calculate rating distribution from reviews
  const ratingDistribution = React.useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(review => {
      // Round + clamp so half-stars land in a bucket (4.5 → 5, 0.5 → 1) and every
      // review counts — flooring dropped 0.5 entirely and pushed 4.5 down to "4".
      const score = Math.min(5, Math.max(1, Math.round(review.score)));
      distribution[score as keyof typeof distribution]++;
    });
    
    return distribution;
  }, [reviews]);

  // No need for manual refetch - React Query will handle it via invalidation
  const handleRatingSaved = () => {
    // The useCreateRating hook already invalidates and refetches the necessary queries
    // This callback can be used for UI feedback if needed
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
              Back to Teachers
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
              Back to Teachers
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
      
      {/* Header Section with Hero Background */}
      <div className="relative bg-primary rounded-lg md:rounded-lg overflow-hidden">
        <div className="relative p-4 md:p-8">
          <div className="flex flex-col lg:flex-row items-center lg:items-start gap-4 md:gap-8">
            {/* Avatar and Basic Info - Centered on mobile, left-aligned on desktop */}
            <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
              <AvatarImage
                src={teacher.avatar_url || undefined}
                name={teacher.name}
                designation={teacher.designation}
                institute={teacher.institute}
                size={80}
                loading="eager"
                className="ring-2 md:ring-4 ring-primary-content/30 shadow-sm md:w-28 md:h-28 lg:w-36 lg:h-36"
              />
              <div className="mt-3 lg:mt-4">
                <h1 className="text-xl md:text-2xl lg:text-4xl font-bold text-primary-content mb-1 lg:mb-2">{teacher.name}</h1>
                <p className="text-primary-content/90 text-sm md:text-base lg:text-lg mb-2 md:mb-3 lg:mb-4">{teacher.institute}</p>
                
                {/* Quick Info */}
                <div className="flex flex-wrap gap-2 lg:gap-3 justify-center lg:justify-start">
                  {teacher.designation && (
                    <div className="flex items-center gap-1 bg-primary-content/15 text-primary-content px-2 lg:px-3 py-1 rounded-md text-xs lg:text-sm">
                      <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>{teacher.designation}</span>
                    </div>
                  )}
                  {teacher.department && (
                    <div className="flex items-center gap-1 bg-primary-content/15 text-primary-content px-2 lg:px-3 py-1 rounded-md text-xs lg:text-sm">
                      <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>{teacher.department}</span>
                    </div>
                  )}
                  {teacher.city && (
                    <div className="flex items-center gap-1 bg-primary-content/15 text-primary-content px-2 lg:px-3 py-1 rounded-md text-xs lg:text-sm">
                      <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{teacher.city}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Rating Statistics - Centered on mobile, right side on desktop */}
            <div className="w-full max-w-2xl lg:flex-1 lg:ml-8">
              <div className="bg-primary-content/10 backdrop-blur-sm rounded-lg lg:rounded-lg p-3 md:p-4 lg:p-6 text-primary-content">
                <h2 className="text-base md:text-lg lg:text-xl font-semibold mb-2 lg:mb-4 text-center lg:text-left">Rating Overview</h2>
                
                <div className="flex flex-col lg:grid lg:grid-cols-2 items-center lg:items-start gap-4 lg:gap-6">
                  {/* Main Rating */}
                  <div className="text-center">
                    <div className="text-xl md:text-3xl lg:text-5xl font-bold mb-1 lg:mb-2">
                      {teacher.average_rating ? <CountUp end={teacher.average_rating} decimals={1} /> : 'NEW'}
                    </div>
                    <div className="flex justify-center mb-1">
                      <RatingStars rating={teacher.average_rating || 0} size={14} allowHalf={true} className="lg:scale-125" />
                    </div>
                    <div className="text-primary-content/90 text-xs lg:text-sm mt-0.5 lg:mt-2">
                      <CountUp end={reviews?.length || teacher.ratings_count || 0} /> reviews
                    </div>
                  </div>

                  {/* Rating Distribution */}
                  {ratingDistribution && (
                    <div className="space-y-1 lg:space-y-2 w-full max-w-xs lg:max-w-none">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = ratingDistribution[star as keyof typeof ratingDistribution];
                        // Denominator = sum of the buckets so the bars match the
                        // per-star counts (a stray out-of-range score can't skew it).
                        const total = Object.values(ratingDistribution).reduce((a, b) => a + b, 0) || 1;
                        const percentage = (count / total) * 100;
                        
                        return (
                          <div key={star} className="flex items-center justify-center lg:justify-start gap-2 lg:gap-3 text-xs lg:text-sm">
                            <span className="w-2 text-primary-content text-center lg:text-left">{star}</span>
                            <svg className="w-3 h-3 lg:w-4 lg:h-4 text-warning" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                            <div className="flex-1 bg-primary-content/15 rounded-full h-1 lg:h-2 max-w-32 lg:max-w-24">
                              <div
                                className="bg-rating h-1 lg:h-2 rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-primary-content/90 text-xs w-4 lg:w-6 text-center lg:text-left">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 md:gap-3 mt-4 md:mt-6 justify-center lg:justify-start">
            <a
              href="#rate"
              className="bg-primary-content text-primary hover:bg-base-200 px-4 py-2 md:px-6 md:py-3 rounded-lg md:rounded-lg font-semibold transition-all duration-200 shadow-sm text-sm md:text-base"
            >
              Rate This Teacher
            </a>
            {teacher.linkedin_url && (
              <a
                href={teacher.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-primary-content/15 backdrop-blur-sm text-primary-content hover:bg-primary-content/25 px-4 py-2 md:px-6 md:py-3 rounded-lg md:rounded-lg font-semibold transition-all duration-200 border border-primary-content/30 hover:border-primary-content/50 text-sm md:text-base"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn
                </div>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        
        {/* Left Column: About & Rate */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          {/* About Section */}
          <div className="bg-base-100 rounded-lg md:rounded-lg p-4 md:p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3 md:mb-4">
              <div className="w-1 md:w-2 h-6 md:h-8 bg-primary rounded-full"></div>
              <h2 className="text-lg md:text-2xl font-bold text-base-content">About</h2>
            </div>
            <p className="text-base-content/80 leading-relaxed text-sm md:text-base">
              {teacher.bio || 'This teacher hasn\'t added a biography yet.'}
            </p>
          </div>

          {/* Rate Teacher Section */}
          <div id="rate" className="bg-base-100 rounded-lg md:rounded-lg p-4 md:p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4 md:mb-6">
              <div className="w-1 md:w-2 h-6 md:h-8 bg-primary rounded-full"></div>
              <h2 className="text-lg md:text-2xl font-bold text-base-content">Rate This Teacher</h2>
            </div>
            <SectionErrorBoundary
              resetKey={id}
              title="The rating form hit a snag"
              message="You can still read this profile. Reload the form to try rating again."
            >
              <Suspense fallback={<FormSkeleton />}>
                <RatingFormEnhanced teacherId={id} onSaved={handleRatingSaved} />
              </Suspense>
            </SectionErrorBoundary>
          </div>
        </div>

        {/* Right Column: Quick Stats */}
        <div className="space-y-4 md:space-y-6">
          {/* Quick Stats Card */}
          <div className="bg-base-100 rounded-lg md:rounded-lg p-4 md:p-6 shadow-sm">
            <h3 className="text-base md:text-lg font-semibold text-base-content mb-3 md:mb-4">Quick Stats</h3>
            <div className="space-y-3 md:space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-base-content/70 text-sm md:text-base">Total Reviews</span>
                <span className="font-semibold text-base-content text-sm md:text-base">
                  <CountUp end={reviews?.length || teacher.ratings_count || 0} />
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-base-content/70 text-sm md:text-base">Average Rating</span>
                <span className="font-semibold text-base-content text-sm md:text-base">
                  {teacher.average_rating ? `${teacher.average_rating.toFixed(2)}/5.0` : 'NEW'}
                </span>
              </div>
            </div>
          </div>

          {/* Institute Info Card */}
          <div className="bg-base-100 rounded-lg md:rounded-lg p-4 md:p-6 shadow-sm">
            <h3 className="text-base md:text-lg font-semibold text-base-content mb-3 md:mb-4">Institution</h3>
            <div className="space-y-3 md:space-y-4">
              <div>
                <span className="text-xs md:text-sm text-base-content/70 block mb-1">Institute</span>
                <span className="font-semibold text-base-content block leading-relaxed text-sm md:text-base">
                  {teacher.institute}
                </span>
              </div>
              {teacher.department && (
                <div>
                  <span className="text-xs md:text-sm text-base-content/70 block mb-1">Department</span>
                  <span className="font-semibold text-base-content block leading-relaxed text-sm md:text-base">
                    {teacher.department}
                  </span>
                </div>
              )}
              {teacher.designation && (
                <div>
                  <span className="text-xs md:text-sm text-base-content/70 block mb-1">Position</span>
                  <span className="font-semibold text-base-content block leading-relaxed text-sm md:text-base">
                    {teacher.designation}
                  </span>
                </div>
              )}
              {teacher.city && (
                <div>
                  <span className="text-xs md:text-sm text-base-content/70 block mb-1">Location</span>
                  <span className="font-semibold text-base-content block text-sm md:text-base">
                    {teacher.city}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Achievement Badge */}
          {teacher.average_rating && teacher.average_rating >= 4.5 && (
            <div className="bg-warning/10 rounded-lg p-4 md:p-6 border border-warning/30">
              <div className="flex items-center gap-3 mb-2 md:mb-3">
                <h3 className="font-semibold text-warning-content text-sm md:text-base">Excellent Teacher</h3>
              </div>
              <p className="text-xs md:text-sm text-warning-content/90">
                This teacher maintains an exceptional rating of {teacher.average_rating.toFixed(1)} out of 5.
              </p>
            </div>
          )}

          {/* Popular Badge */}
          {(teacher.ratings_count || 0) >= 20 && (
            <div className="bg-primary/10 rounded-lg p-6 border border-primary/30">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="font-semibold text-primary">Popular Teacher</h3>
              </div>
              <p className="text-sm text-primary/90">
                Rated by {teacher.ratings_count} students.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reviews Section - Full Width */}
      <SectionErrorBoundary
        resetKey={id}
        title="We couldn't show the reviews"
        message="The rest of this profile is fine. Try loading the reviews again."
      >
      <Reveal className="bg-base-100 rounded-lg shadow-sm mx-2 md:mx-0">
        <div className="p-4 md:p-6 border-b border-base-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-6 md:h-8 bg-primary rounded-full"></div>
              <h2 className="text-xl md:text-2xl font-bold text-base-content">Student Reviews</h2>
            </div>
            {reviews && reviews.length > 0 && (
              <div className="bg-primary/20 text-primary px-4 py-2 rounded-md text-sm font-medium">
                {reviews.length} reviews
              </div>
            )}
          </div>
        </div>
        
        <div className="p-6">
          {reviewsLoading ? (
            <ReviewListSkeleton count={3} />
          ) : reviewsError ? (
            <ErrorState
              title="Unable to load reviews"
              message="The reviews didn't come through. Try again in a moment."
              onRetry={() => refetchReviews()}
            />
          ) : reviews && reviews.length > 0 ? (
            <div className="grid gap-4">
              {reviews.map((review: RatingWithRelations) => (
                <article key={review.id} className="bg-base-200 rounded-lg p-4 md:p-6 border border-base-300">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-content font-semibold flex-shrink-0">
                        {review.student?.display_name?.charAt(0) || review.student?.email?.charAt(0) || '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-base-content text-sm md:text-base">
                          {currentUser && review.student_id === currentUser.id
                            ? 'Your review'
                            : (review.student?.display_name || 'Anonymous Student')}
                        </h3>
                        <time className="text-xs md:text-sm text-base-content/70">
                          {new Date(review.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </time>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-base-100 px-3 py-1 rounded-md border border-base-300 self-start">
                      <RatingStars rating={review.score} size={14} allowHalf={true} />
                      <span className="text-sm font-semibold text-base-content">{review.score}</span>
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-base-content/80 leading-relaxed text-sm md:text-base break-words">
                      {review.comment}
                    </p>
                  )}
                </article>
              ))}
            </div>
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
        </div>
      </Reveal>
      </SectionErrorBoundary>
    </div>
  );
}