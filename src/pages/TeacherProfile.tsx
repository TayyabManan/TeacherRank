import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTeacher } from '../hooks/useTeachers';
import { useRatings } from '../hooks/useRatings';
import { useUser } from '../hooks/useAuth';
import RatingFormEnhanced from '../components/RatingFormEnhanced';
import { ProfileSkeleton } from '../components/Skeleton';
import { RatingStars } from '../components/RatingStars';
import { AvatarImage } from '../components/AvatarImage';
import type { RatingWithRelations } from '../types';

export default function TeacherProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: currentUser } = useUser();
  
  const { data: teacher, isLoading: teacherLoading, error: teacherError } = useTeacher(id || '');
  const { data: reviews, isLoading: reviewsLoading, error: reviewsError } = useRatings(id);

  // Debug logging
  React.useEffect(() => {
    if (teacher) {
      console.log('Teacher data loaded:', {
        name: teacher.name,
        department: teacher.department,
        institute: teacher.institute,
        designation: teacher.designation,
        average_rating: teacher.average_rating,
        ratings_count: teacher.ratings_count
      });
    }
    if (reviews) {
      console.log('Reviews loaded:', reviews.length, 'reviews');
    }
  }, [teacher, reviews]);

  // Calculate rating distribution from reviews
  const ratingDistribution = React.useMemo(() => {
    if (!reviews || reviews.length === 0) return null;
    
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach(review => {
      const score = Math.floor(review.score);
      if (score >= 1 && score <= 5) {
        distribution[score as keyof typeof distribution]++;
      }
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
      <div className="max-w-4xl mx-auto p-4">
        <div role="alert" className="alert alert-error dark:bg-red-900 dark:border-red-700 dark:text-red-100">
          <span>Invalid teacher ID</span>
        </div>
      </div>
    );
  }

  if (teacherError) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div role="alert" className="alert alert-error">
          <span>Failed to load teacher profile. Please try again later.</span>
        </div>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/')}>
          Back to Teachers
        </button>
      </div>
    );
  }

  if (teacherLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <ProfileSkeleton />
      </div>
    );
  }

  if (!teacher) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div role="alert" className="alert alert-warning">
          <span>Teacher not found</span>
        </div>
        <button className="btn btn-primary mt-4" onClick={() => navigate('/')}>
          Back to Teachers
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4 md:space-y-6">
      <Helmet>
        <title>{teacher.name} - {teacher.designation} at {teacher.institute} | Teacher Rank</title>
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
          {JSON.stringify({
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
          {JSON.stringify({
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
      <div className="relative bg-gradient-to-br from-primary via-primary to-primary-focus rounded-xl md:rounded-2xl overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
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
                className="ring-2 md:ring-4 ring-white/30 shadow-xl md:w-[120px] md:h-[120px] lg:w-[140px] lg:h-[140px]"
              />
              <div className="mt-3 lg:mt-4">
                <h1 className="text-xl md:text-2xl lg:text-4xl font-bold text-primary-content mb-1 lg:mb-2">{teacher.name}</h1>
                <p className="text-primary-content/90 text-sm md:text-base lg:text-lg mb-2 md:mb-3 lg:mb-4">{teacher.institute}</p>
                
                {/* Quick Info */}
                <div className="flex flex-wrap gap-2 lg:gap-3 justify-center lg:justify-start">
                  {teacher.designation && (
                    <div className="flex items-center gap-1 bg-white/20 text-primary-content px-2 lg:px-3 py-1 rounded-full text-xs lg:text-sm">
                      <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>{teacher.designation}</span>
                    </div>
                  )}
                  {teacher.department && (
                    <div className="flex items-center gap-1 bg-white/20 text-primary-content px-2 lg:px-3 py-1 rounded-full text-xs lg:text-sm">
                      <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>{teacher.department}</span>
                    </div>
                  )}
                  {teacher.city && (
                    <div className="flex items-center gap-1 bg-white/20 text-primary-content px-2 lg:px-3 py-1 rounded-full text-xs lg:text-sm">
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
              <div className="bg-white/10 backdrop-blur-sm rounded-lg lg:rounded-xl p-3 md:p-4 lg:p-6 text-primary-content">
                <h3 className="text-base md:text-lg lg:text-xl font-semibold mb-2 lg:mb-4 text-center lg:text-left">Rating Overview</h3>
                
                <div className="flex flex-col lg:grid lg:grid-cols-2 items-center lg:items-start gap-4 lg:gap-6">
                  {/* Main Rating */}
                  <div className="text-center">
                    <div className="text-xl md:text-3xl lg:text-5xl font-bold mb-1 lg:mb-2">
                      {teacher.average_rating ? teacher.average_rating.toFixed(1) : 'NEW'}
                    </div>
                    <div className="flex justify-center mb-1">
                      <RatingStars rating={teacher.average_rating || 0} size={14} allowHalf={true} className="lg:scale-125" />
                    </div>
                    <div className="text-primary-content/90 text-xs lg:text-sm mt-0.5 lg:mt-2">
                      {reviews?.length || teacher.ratings_count || 0} reviews
                    </div>
                  </div>

                  {/* Rating Distribution */}
                  {ratingDistribution && (
                    <div className="space-y-1 lg:space-y-2 w-full max-w-xs lg:max-w-none">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = ratingDistribution[star as keyof typeof ratingDistribution];
                        const total = reviews?.length || 1;
                        const percentage = (count / total) * 100;
                        
                        return (
                          <div key={star} className="flex items-center justify-center lg:justify-start gap-2 lg:gap-3 text-xs lg:text-sm">
                            <span className="w-2 text-white text-center lg:text-left">{star}</span>
                            <div className="w-3 h-3 lg:w-4 lg:h-4 text-yellow-300">⭐</div>
                            <div className="flex-1 bg-white/20 rounded-full h-1 lg:h-2 max-w-32 lg:max-w-24">
                              <div 
                                className="bg-yellow-300 h-1 lg:h-2 rounded-full transition-all duration-500" 
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
              className="bg-white text-primary hover:bg-gray-100 px-4 py-2 md:px-6 md:py-3 rounded-lg md:rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm md:text-base"
            >
              Rate This Teacher
            </a>
            {teacher.linkedin_url && (
              <a
                href={teacher.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/20 backdrop-blur-sm text-primary-content hover:bg-white/30 px-4 py-2 md:px-6 md:py-3 rounded-lg md:rounded-xl font-semibold transition-all duration-200 border border-white/30 hover:border-white/50 text-sm md:text-base"
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
          <div className="bg-base-100 rounded-lg md:rounded-xl p-4 md:p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3 md:mb-4">
              <div className="w-1 md:w-2 h-6 md:h-8 bg-gradient-to-b from-primary to-primary-focus rounded-full"></div>
              <h2 className="text-lg md:text-2xl font-bold text-base-content">About</h2>
            </div>
            <p className="text-base-content/80 leading-relaxed text-sm md:text-base">
              {teacher.bio || 'This teacher hasn\'t added a biography yet. Be the first to rate them and share your experience!'}
            </p>
          </div>

          {/* Rate Teacher Section */}
          <div id="rate" className="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl p-4 md:p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4 md:mb-6">
              <div className="w-1 md:w-2 h-6 md:h-8 bg-gradient-to-b from-primary to-primary-focus rounded-full"></div>
              <h2 className="text-lg md:text-2xl font-bold text-base-content">Rate This Teacher</h2>
            </div>
            <RatingFormEnhanced teacherId={id} onSaved={handleRatingSaved} />
          </div>
        </div>

        {/* Right Column: Quick Stats */}
        <div className="space-y-4 md:space-y-6">
          {/* Quick Stats Card */}
          <div className="bg-base-100 rounded-lg md:rounded-xl p-4 md:p-6 shadow-sm">
            <h3 className="text-base md:text-lg font-semibold text-base-content mb-3 md:mb-4">Quick Stats</h3>
            <div className="space-y-3 md:space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-base-content/70 text-sm md:text-base">Total Reviews</span>
                <span className="font-semibold text-base-content text-sm md:text-base">
                  {reviews?.length || teacher.ratings_count || 0}
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
          <div className="bg-base-100 rounded-lg md:rounded-xl p-4 md:p-6 shadow-sm">
            <h3 className="text-base md:text-lg font-semibold text-base-content mb-3 md:mb-4">Institution</h3>
            <div className="space-y-3 md:space-y-4">
              <div>
                <span className="text-xs md:text-sm text-base-content/60 block mb-1">Institute</span>
                <span className="font-semibold text-base-content block leading-relaxed text-sm md:text-base">
                  {teacher.institute}
                </span>
              </div>
              {teacher.department && (
                <div>
                  <span className="text-xs md:text-sm text-base-content/60 block mb-1">Department</span>
                  <span className="font-semibold text-base-content block leading-relaxed text-sm md:text-base">
                    {teacher.department}
                  </span>
                </div>
              )}
              {teacher.designation && (
                <div>
                  <span className="text-xs md:text-sm text-base-content/60 block mb-1">Position</span>
                  <span className="font-semibold text-base-content block leading-relaxed text-sm md:text-base">
                    {teacher.designation}
                  </span>
                </div>
              )}
              {teacher.city && (
                <div>
                  <span className="text-xs md:text-sm text-base-content/60 block mb-1">Location</span>
                  <span className="font-semibold text-base-content block text-sm md:text-base">
                    {teacher.city}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Achievement Badge */}
          {teacher.average_rating && teacher.average_rating >= 4.5 && (
            <div className="bg-gradient-to-br from-warning/20 to-warning/30 rounded-lg md:rounded-xl p-4 md:p-6 border border-warning/40">
              <div className="flex items-center gap-3 mb-2 md:mb-3">
                <div className="text-xl md:text-2xl">🏆</div>
                <h3 className="font-semibold text-warning-content text-sm md:text-base">Excellent Teacher</h3>
              </div>
              <p className="text-xs md:text-sm text-warning-content/90">
                This teacher maintains an exceptional rating of {teacher.average_rating.toFixed(1)}/5.0!
              </p>
            </div>
          )}

          {/* Popular Badge */}
          {(teacher.ratings_count || 0) >= 20 && (
            <div className="bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl p-6 border border-primary/40">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-2xl">🔥</div>
                <h3 className="font-semibold text-primary">Popular Teacher</h3>
              </div>
              <p className="text-sm text-primary/90">
                Highly rated by {teacher.ratings_count} students and counting!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reviews Section - Full Width */}
      <div className="bg-base-100 rounded-xl shadow-sm mx-2 md:mx-0">
        <div className="p-4 md:p-6 border-b border-base-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-6 md:h-8 bg-gradient-to-b from-primary to-primary-focus rounded-full"></div>
              <h2 className="text-xl md:text-2xl font-bold text-base-content">Student Reviews</h2>
            </div>
            {reviews && reviews.length > 0 && (
              <div className="bg-primary/20 text-primary px-4 py-2 rounded-full text-sm font-medium">
                {reviews.length} reviews
              </div>
            )}
          </div>
        </div>
        
        <div className="p-6">
          {reviewsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mr-3"></div>
              <span className="text-base-content/70">Loading reviews...</span>
            </div>
          ) : reviewsError ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-error/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-base-content mb-2">Unable to load reviews</h3>
              <p className="text-base-content/60">Please try refreshing the page.</p>
            </div>
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
                        <h4 className="font-semibold text-base-content text-sm md:text-base">
                          {currentUser && review.student_id === currentUser.id 
                            ? 'Your review' 
                            : (review.student?.display_name || 'Anonymous Student')}
                        </h4>
                        <time className="text-xs md:text-sm text-base-content/60">
                          {new Date(review.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </time>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-base-100 px-3 py-1 rounded-full border border-base-300 self-start">
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
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-base-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-base-content/40" viewBox="0 -8.5 158 158" fill="currentColor">
                    <g clipPath="url(#clip0)">
                      <path d="M25.3444 106.878C27.7828 108.544 28.102 109.755 26.8285 112.511C24.164 118.28 21.0905 125.117 18.4964 132.108C17.8052 133.97 17.7557 137.607 19.2508 139.067C20.4742 140.262 22.5497 140.426 24.5568 140.584C25.1503 140.631 25.7106 140.675 26.2382 140.744C26.3236 140.756 26.4095 140.761 26.4956 140.761C27.2256 140.692 27.9286 140.45 28.5463 140.056L28.8069 139.92C31.0067 138.785 33.2086 137.654 35.4126 136.526C41.7037 133.301 48.2085 129.963 54.5425 126.559L54.6018 126.528C62.2238 122.434 69.4168 118.566 78.2498 120.266C78.6185 120.325 78.9925 120.34 79.3651 120.309C79.483 120.303 79.6022 120.298 79.7188 120.297C100.703 120.106 116.873 115.762 130.606 106.626C151.64 92.6322 161.084 72.6056 156.517 51.6818C152.289 32.3089 143.953 20.2547 129.488 12.5985C114.782 4.81623 98.2103 0.344555 82.8262 0.00732422C82.8204 0.00829458 82.8145 0.00829458 82.8093 0.00732422C63.8205 0.0820479 47.9564 3.20238 32.8857 9.82936C14.6163 17.8612 4.59895 29.4004 2.26219 45.106C1.2549 51.4949 1.13475 57.9916 1.90517 64.4132C4.43476 83.9408 12.1024 97.831 25.3444 106.878ZM31.7762 122.668C33.0466 118.148 34.2452 113.879 35.7403 109.789C38.0855 103.379 34.6244 99.7777 31.3495 97.356C26.3685 93.6744 21.3302 89.436 18.2123 83.4113C10.1604 67.8526 9.06465 53.2775 14.86 38.8533C18.0032 31.0307 24.3842 25.2225 34.941 20.5741C49.512 14.1583 64.0147 10.9506 78.3527 10.9506C92.628 11.014 106.724 14.1301 119.691 20.088C134.661 26.8151 142.963 37.9101 145.818 55.0055C148.164 69.0345 144.266 80.7193 133.559 91.7764C124.025 101.622 111.17 107.416 93.1042 110.01C83.9989 111.317 73.2291 112.4 62.3899 110.52C61.0369 110.291 59.5235 111.136 58.2995 111.82C50.9622 115.933 43.6939 120.058 35.9996 124.425L30.3717 127.618C30.8629 125.919 31.3254 124.273 31.7762 122.668V122.668Z" />
                      <path d="M50.4727 69.7116H50.5632C51.5856 69.7084 52.597 69.5011 53.5381 69.1028C54.4792 68.7038 55.3311 68.1223 56.0439 67.3913C56.6562 66.761 57.1341 66.0131 57.4489 65.1938C57.7636 64.3742 57.9086 63.4996 57.8751 62.6226C57.7597 60.8352 56.9862 59.1535 55.7032 57.9004C54.4202 56.6472 52.7181 55.9107 50.9241 55.833C49.971 55.839 49.0285 56.034 48.1513 56.406C47.2742 56.778 46.4798 57.3195 45.8141 58C45.0885 58.6916 44.507 59.5195 44.1032 60.436C43.6994 61.3525 43.4811 62.34 43.4611 63.3409C43.4557 64.1543 43.6132 64.9604 43.9245 65.7123C44.2357 66.4641 44.6943 67.1457 45.2734 67.7188C46.6738 69.043 48.5435 69.7597 50.4727 69.7116Z" />
                      <path d="M81.3262 71.5141H81.3913C83.1594 71.4998 84.8499 70.7896 86.0955 69.5382C87.4055 68.2679 88.1606 66.533 88.1964 64.7109C88.2114 62.8915 87.2016 60.7403 85.5613 59.0997C84.4492 57.855 82.8981 57.0869 81.2317 56.9556H81.2109C77.8461 56.9751 74.4957 60.6551 74.4468 64.3848C74.4299 65.3173 74.5993 66.2438 74.9452 67.11C75.2905 67.9768 75.8051 68.7662 76.4598 69.4323C77.0924 70.0833 77.8481 70.6025 78.6832 70.9599C79.519 71.3172 80.4167 71.5057 81.3262 71.5141Z" />
                      <path d="M110.697 70.7603H110.74C112.416 70.6959 114.011 70.0228 115.225 68.8681C116.439 67.7128 117.189 66.1554 117.333 64.4883C117.287 62.8406 116.594 61.2767 115.402 60.1347C113.8 58.3543 111.576 57.2516 109.186 57.0521C108.579 57.0402 107.977 57.1519 107.416 57.3796C106.854 57.6072 106.345 57.9462 105.919 58.3764C105.249 59.0638 104.722 59.8774 104.37 60.7699C104.018 61.6623 103.847 62.6157 103.869 63.5745C103.828 65.4283 104.522 67.2223 105.801 68.5679C107.079 69.913 108.839 70.7018 110.697 70.7603Z" />
                    </g>
                    <defs>
                      <clipPath id="clip0">
                        <rect width="157" height="141" fill="white" transform="translate(0.777344)"/>
                      </clipPath>
                    </defs>
                  </svg>
              </div>
              <h3 className="text-xl font-semibold text-base-content mb-2">No reviews yet</h3>
              <p className="text-base-content/60 mb-4">Be the first to share your experience with this teacher!</p>
              <a href="#rate" className="inline-flex items-center gap-2 bg-primary hover:bg-primary-focus text-primary-content px-6 py-3 rounded-lg font-medium transition-colors duration-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Write the first review
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}