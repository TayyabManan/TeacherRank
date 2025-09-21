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
        <div role="alert" className="alert alert-error dark:bg-red-900 dark:border-red-700 dark:text-red-100">
          <span>Failed to load teacher profile. Please try again later.</span>
        </div>
        <button className="btn btn-primary dark:bg-blue-600 dark:hover:bg-blue-700 dark:border-blue-600 mt-4" onClick={() => navigate('/')}>
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
        <div role="alert" className="alert alert-warning dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-100">
          <span>Teacher not found</span>
        </div>
        <button className="btn btn-primary dark:bg-blue-600 dark:hover:bg-blue-700 dark:border-blue-600 mt-4" onClick={() => navigate('/')}>
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
      <div className="relative bg-gradient-to-br from-purple-600 via-purple-500 to-indigo-600 dark:from-purple-800 dark:via-purple-700 dark:to-indigo-800 rounded-xl md:rounded-2xl overflow-hidden">
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
                <h1 className="text-xl md:text-2xl lg:text-4xl font-bold text-white mb-1 lg:mb-2">{teacher.name}</h1>
                <p className="text-purple-100 text-sm md:text-base lg:text-lg mb-2 md:mb-3 lg:mb-4">{teacher.institute}</p>
                
                {/* Quick Info */}
                <div className="flex flex-wrap gap-2 lg:gap-3 justify-center lg:justify-start">
                  {teacher.designation && (
                    <div className="flex items-center gap-1 bg-white/20 text-white px-2 lg:px-3 py-1 rounded-full text-xs lg:text-sm">
                      <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>{teacher.designation}</span>
                    </div>
                  )}
                  {teacher.department && (
                    <div className="flex items-center gap-1 bg-white/20 text-white px-2 lg:px-3 py-1 rounded-full text-xs lg:text-sm">
                      <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>{teacher.department}</span>
                    </div>
                  )}
                  {teacher.city && (
                    <div className="flex items-center gap-1 bg-white/20 text-white px-2 lg:px-3 py-1 rounded-full text-xs lg:text-sm">
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
              <div className="bg-white/10 backdrop-blur-sm rounded-lg lg:rounded-xl p-3 md:p-4 lg:p-6 text-white">
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
                    <div className="text-purple-100 text-xs lg:text-sm mt-0.5 lg:mt-2">
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
                            <span className="text-purple-100 text-xs w-4 lg:w-6 text-center lg:text-left">{count}</span>
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
              className="bg-white text-purple-600 hover:bg-purple-50 px-4 py-2 md:px-6 md:py-3 rounded-lg md:rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm md:text-base"
            >
              Rate This Teacher
            </a>
            {teacher.linkedin_url && (
              <a
                href={teacher.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 px-4 py-2 md:px-6 md:py-3 rounded-lg md:rounded-xl font-semibold transition-all duration-200 border border-white/30 hover:border-white/50 text-sm md:text-base"
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
          <div className="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl p-4 md:p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-3 md:mb-4">
              <div className="w-1 md:w-2 h-6 md:h-8 bg-gradient-to-b from-purple-500 to-indigo-500 rounded-full"></div>
              <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">About</h2>
            </div>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm md:text-base">
              {teacher.bio || 'This teacher hasn\'t added a biography yet. Be the first to rate them and share your experience!'}
            </p>
          </div>

          {/* Rate Teacher Section */}
          <div id="rate" className="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl p-4 md:p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4 md:mb-6">
              <div className="w-1 md:w-2 h-6 md:h-8 bg-gradient-to-b from-purple-500 to-indigo-500 rounded-full"></div>
              <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">Rate This Teacher</h2>
            </div>
            <RatingFormEnhanced teacherId={id} onSaved={handleRatingSaved} />
          </div>
        </div>

        {/* Right Column: Quick Stats */}
        <div className="space-y-4 md:space-y-6">
          {/* Quick Stats Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl p-4 md:p-6 shadow-sm">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white mb-3 md:mb-4">Quick Stats</h3>
            <div className="space-y-3 md:space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400 text-sm md:text-base">Total Reviews</span>
                <span className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                  {reviews?.length || teacher.ratings_count || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400 text-sm md:text-base">Average Rating</span>
                <span className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                  {teacher.average_rating ? `${teacher.average_rating.toFixed(2)}/5.0` : 'NEW'}
                </span>
              </div>
            </div>
          </div>

          {/* Institute Info Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg md:rounded-xl p-4 md:p-6 shadow-sm">
            <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white mb-3 md:mb-4">Institution</h3>
            <div className="space-y-3 md:space-y-4">
              <div>
                <span className="text-xs md:text-sm text-gray-600 dark:text-gray-400 block mb-1">Institute</span>
                <span className="font-semibold text-gray-900 dark:text-white block leading-relaxed text-sm md:text-base">
                  {teacher.institute}
                </span>
              </div>
              {teacher.department && (
                <div>
                  <span className="text-xs md:text-sm text-gray-600 dark:text-gray-400 block mb-1">Department</span>
                  <span className="font-semibold text-gray-900 dark:text-white block leading-relaxed text-sm md:text-base">
                    {teacher.department}
                  </span>
                </div>
              )}
              {teacher.designation && (
                <div>
                  <span className="text-xs md:text-sm text-gray-600 dark:text-gray-400 block mb-1">Position</span>
                  <span className="font-semibold text-gray-900 dark:text-white block leading-relaxed text-sm md:text-base">
                    {teacher.designation}
                  </span>
                </div>
              )}
              {teacher.city && (
                <div>
                  <span className="text-xs md:text-sm text-gray-600 dark:text-gray-400 block mb-1">Location</span>
                  <span className="font-semibold text-gray-900 dark:text-white block text-sm md:text-base">
                    {teacher.city}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Achievement Badge */}
          {teacher.average_rating && teacher.average_rating >= 4.5 && (
            <div className="bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-lg md:rounded-xl p-4 md:p-6 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-3 mb-2 md:mb-3">
                <div className="text-xl md:text-2xl">🏆</div>
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 text-sm md:text-base">Excellent Teacher</h3>
              </div>
              <p className="text-xs md:text-sm text-yellow-700 dark:text-yellow-300">
                This teacher maintains an exceptional rating of {teacher.average_rating.toFixed(1)}/5.0!
              </p>
            </div>
          )}

          {/* Popular Badge */}
          {(teacher.ratings_count || 0) >= 20 && (
            <div className="bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-2xl">🔥</div>
                <h3 className="font-semibold text-purple-800 dark:text-purple-200">Popular Teacher</h3>
              </div>
              <p className="text-sm text-purple-700 dark:text-purple-300">
                Highly rated by {teacher.ratings_count} students and counting!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Reviews Section - Full Width */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm mx-2 md:mx-0">
        <div className="p-4 md:p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-2 h-6 md:h-8 bg-gradient-to-b from-purple-500 to-indigo-500 rounded-full"></div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Student Reviews</h2>
            </div>
            {reviews && reviews.length > 0 && (
              <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 px-4 py-2 rounded-full text-sm font-medium">
                {reviews.length} reviews
              </div>
            )}
          </div>
        </div>
        
        <div className="p-6">
          {reviewsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-500 border-t-transparent mr-3"></div>
              <span className="text-gray-600 dark:text-gray-400">Loading reviews...</span>
            </div>
          ) : reviewsError ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Unable to load reviews</h3>
              <p className="text-gray-500 dark:text-gray-400">Please try refreshing the page.</p>
            </div>
          ) : reviews && reviews.length > 0 ? (
            <div className="grid gap-4">
              {reviews.map((review: RatingWithRelations) => (
                <article key={review.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 md:p-6 border border-gray-200 dark:border-gray-600">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {review.student?.display_name?.charAt(0) || review.student?.email?.charAt(0) || '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                          {currentUser && review.student_id === currentUser.id 
                            ? 'Your review' 
                            : (review.student?.display_name || 'Anonymous Student')}
                        </h4>
                        <time className="text-xs md:text-sm text-gray-500 dark:text-gray-400">
                          {new Date(review.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </time>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-600 self-start">
                      <RatingStars rating={review.score} size={14} allowHalf={true} />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{review.score}</span>
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-sm md:text-base break-words">
                      {review.comment}
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-4.126-.98L3 21l1.98-5.874A8.955 8.955 0 013 12a8 8 0 018-8c4.418 0 8 3.582 8 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No reviews yet</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">Be the first to share your experience with this teacher!</p>
              <a href="#rate" className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200">
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