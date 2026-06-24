import React, { useMemo, useState, useCallback, useRef, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Helmet } from 'react-helmet-async';
import { useTeachersOptimized, usePrefetchTeacher, useInstitutes, useDepartments, useCities } from '../hooks/useTeachersOptimized';
import { Pagination } from './Pagination';
import { TeacherListSkeleton } from './Skeleton';
import { RatingStars } from './RatingStars';
import { AvatarImage } from './AvatarImage';
import { useHaptic } from '../lib/haptic';
import { useMobileDetection, usePullToRefresh } from '../lib/mobile';
import { TeacherModal } from './TeacherModal';
import { Button } from './Button';
import type { TeacherWithStats } from '../types';

// Utility function with better performance
const clamp = (v: number, min = 0, max = 5) => Math.max(min, Math.min(max, v));

// Debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Optimized memoized components
const RankingBadge = React.memo<{ position: number; className?: string }>(
  ({ position, className = '' }) => {
    // Top 3 get the accent; the rest a neutral surface badge — numeric, no medals
    const accent = position <= 3;
    return (
      <div className={`absolute -top-2 -right-2 ${accent ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/70 border border-base-300'} rounded-md min-w-[1.75rem] h-7 px-1.5 flex items-center justify-center text-xs font-semibold shadow-sm ${className}`}>
        #{position}
      </div>
    );
  }
);

RankingBadge.displayName = 'RankingBadge';

const AchievementBadges = React.memo<{ rating: number; count: number }>(
  ({ rating, count }) => {
    const badges = useMemo(() => {
      const result: string[] = [];
      if (rating >= 4.5) result.push('Top Rated');
      else if (rating >= 4.0) result.push('Highly Rated');
      if (count >= 100) result.push('100+ Reviews');
      else if (count >= 50) result.push('Popular');
      return result;
    }, [rating, count]);

    if (badges.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {badges.map((label) => (
          <span
            key={label}
            className="text-xs font-medium px-2 py-0.5 rounded-md bg-base-200 text-base-content/70 border border-base-300"
          >
            {label}
          </span>
        ))}
      </div>
    );
  },
  (prev, next) => prev.rating === next.rating && prev.count === next.count
);

AchievementBadges.displayName = 'AchievementBadges';

// Optimized TeacherCard with better memoization
const TeacherCard = React.memo<{
  teacher: TeacherWithStats & { rank: number };
  onModalOpen: (teacher: TeacherWithStats) => void;
  onRate: (teacher: TeacherWithStats) => void;
  onPrefetch: (id: string) => void;
  onNavigate: (path: string) => void;
}>(
  ({ teacher, onModalOpen, onRate, onPrefetch, onNavigate }) => {
    const handleViewProfile = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      // Haptic feedback will be handled by the parent component
      onNavigate(`/teacher/${teacher.id}`);
    }, [teacher.id, onNavigate]);

    const handleRateNow = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      // Open the quick-view modal in rate mode — no navigation away from the list.
      onRate(teacher);
    }, [teacher, onRate]);

    const handleCardClick = useCallback(() => {
      onModalOpen(teacher);
    }, [teacher, onModalOpen]);

    const handleMouseEnter = useCallback(() => {
      onPrefetch(teacher.id);
    }, [teacher.id, onPrefetch]);

    return (
      <article
        role="button"
        tabIndex={0}
        aria-label={`Quick view ${teacher.name}`}
        className="group relative bg-base-100 rounded-lg p-4 md:p-6 shadow-sm border border-base-300 card-hover cursor-pointer touch-manipulation"
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCardClick();
          }
        }}
        onMouseEnter={handleMouseEnter}
      >
        <RankingBadge position={teacher.rank} />

        <div className="flex items-start gap-3 md:gap-4 mb-4">
          <div className="relative flex-shrink-0">
            <AvatarImage
              src={teacher.avatar_url || undefined}
              name={teacher.name}
              designation={teacher.designation}
              institute={teacher.institute}
              size={56}
              className="border-2 border-base-300 md:w-16 md:h-16"
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base md:text-lg text-base-content mb-1 truncate">
              {teacher.name}
            </h3>
            <p className="text-base-content text-xs md:text-sm font-medium mb-1 truncate">
              {teacher.institute}
            </p>
            {teacher.department && (
              <p className="text-base-content/70 text-xs mb-2 truncate italic">
                {teacher.department}
              </p>
            )}
            
            <div className="flex items-center gap-3 mb-2">
              <RatingStars rating={clamp(teacher.average_rating ?? 0)} size={16} allowHalf={true} />
              <div className="text-sm font-semibold text-base-content">
                {teacher.average_rating ? teacher.average_rating.toFixed(1) : 'NEW'}
              </div>
              <div className="text-xs text-base-content/70">
                {(teacher.ratings_count ?? 0) > 0 ? `${teacher.ratings_count} reviews` : 'No reviews yet'}
              </div>
            </div>

            <AchievementBadges 
              rating={teacher.average_rating ?? 0} 
              count={teacher.ratings_count ?? 0} 
            />
          </div>
        </div>

        <p className="text-base-content/80 text-xs md:text-sm mb-4 md:mb-6 line-clamp-2 leading-relaxed">
          {teacher.bio || 'This teacher hasn\'t added a bio yet.'}
        </p>

        <div className="flex gap-2 md:gap-3">
          <Button
            variant="secondary"
            touch="default"
            className="flex-1 px-3 md:px-4 py-3 rounded-lg font-medium transition-all duration-200 text-sm md:text-base"
            onClick={handleViewProfile}
            aria-label={`View ${teacher.name}'s profile`}
          >
            View Profile
          </Button>
          <Button
            variant="primary"
            touch="default"
            className="flex-1 px-3 md:px-4 py-3 rounded-lg font-medium transition-all duration-200 text-sm md:text-base rate-button relative overflow-hidden"
            onClick={handleRateNow}
            aria-label={`Rate ${teacher.name}`}
          >
            <span className="flex items-center justify-center gap-1 transition-transform duration-200">
              <span className="rate-button-text">Rate Now</span>
              <svg
                className="w-4 h-4 rate-button-arrow opacity-0 -translate-x-2 transition-all duration-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </Button>
        </div>
      </article>
    );
  },
  // Custom comparison for better memoization
  (prevProps, nextProps) => {
    const prev = prevProps.teacher;
    const next = nextProps.teacher;
    
    return (
      prev.id === next.id &&
      prev.average_rating === next.average_rating &&
      prev.ratings_count === next.ratings_count &&
      prev.rank === next.rank &&
      prev.name === next.name &&
      prev.institute === next.institute &&
      prev.department === next.department &&
      prev.bio === next.bio &&
      prev.avatar_url === next.avatar_url
    );
  }
);

TeacherCard.displayName = 'TeacherCard';

// Modal container to prevent list re-renders
const TeacherModalPortal = React.memo<{
  teacher: TeacherWithStats | null;
  isOpen: boolean;
  onClose: () => void;
  autoRate?: boolean;
}>(({ teacher, isOpen, onClose, autoRate = false }) => {
  if (!teacher || !isOpen) return null;

  return createPortal(
    <Suspense fallback={<div className="loading loading-spinner loading-lg" />}>
      <TeacherModal teacher={teacher} isOpen={isOpen} onClose={onClose} autoRate={autoRate} />
    </Suspense>,
    document.body
  );
});

TeacherModalPortal.displayName = 'TeacherModalPortal';

// Main optimized component
export default function TeacherListingOptimized() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'rating_desc' | 'rating_asc' | 'institute_az' | 'name_az'>('rating_desc');
  const [selectedInstitute, setSelectedInstitute] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherWithStats | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rateIntent, setRateIntent] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSearchFilters, setShowSearchFilters] = useState(false);
  
  const navigate = useNavigate();
  const prefetchTeacher = usePrefetchTeacher();
  const haptic = useHaptic();
  const { mobile } = useMobileDetection();
  const containerRef = useRef<HTMLDivElement>(null);

  // Optimized debounced search
  const debouncedSearch = useMemo(
    () => debounce((value: string) => {
      setSearch(value);
      setPage(1);
    }, 300),
    []
  );

  const { data, isLoading, error, refetch } = useTeachersOptimized({
    search,
    institute: selectedInstitute,
    department: selectedDepartment,
    city: selectedCity !== 'all' ? selectedCity : undefined,
    sortBy: sort,
    page,
    pageSize: 12,
  });

  const { data: institutes } = useInstitutes();
  const { data: departments } = useDepartments(selectedInstitute);
  const { data: cities } = useCities(selectedInstitute);

  // Optimized ranking calculation
  const rankedTeachers = useMemo(() => {
    if (!data?.data || data.data.length === 0) return [];
    
    // If server already sorted by rating, just add ranks
    if (sort === 'rating_desc' || sort === 'rating_asc') {
      return data.data.map((teacher, index) => ({
        ...teacher,
        rank: sort === 'rating_desc' ? index + 1 : data.data.length - index
      }));
    }
    
    // Only recalculate for other sorts
    const sorted = [...data.data].sort((a, b) => 
      (b.average_rating ?? 0) - (a.average_rating ?? 0)
    );
    
    return sorted.map((teacher, index) => ({
      ...teacher,
      rank: index + 1
    }));
  }, [data?.data, sort]);

  // Stable callbacks
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleInstituteChange = useCallback((value: string) => {
    haptic.light(); // Light feedback for filter change
    setSelectedInstitute(value);
    setSelectedDepartment('all'); // Reset department when institute changes
    setSelectedCity('all'); // Reset city when institute changes
    setPage(1);
  }, [haptic]);

  const handleDepartmentChange = useCallback((value: string) => {
    haptic.light(); // Light feedback for filter change
    setSelectedDepartment(value);
    setPage(1);
  }, [haptic]);

  const handleCityChange = useCallback((value: string) => {
    haptic.light(); // Light feedback for filter change
    setSelectedCity(value);
    setPage(1);
  }, [haptic]);

  const handleSortChange = useCallback((value: string) => {
    haptic.light(); // Light feedback for sort change
    setSort(value as any);
    setPage(1);
  }, [haptic]);

  const clearAllFilters = useCallback(() => {
    haptic.medium(); // Medium feedback for clearing filters
    setSearch('');
    setSelectedInstitute('all');
    setSelectedDepartment('all');
    setSelectedCity('all');
    setPage(1);
  }, [haptic]);

  const openTeacherModal = useCallback((teacher: TeacherWithStats) => {
    haptic.medium(); // Medium feedback for modal open
    setSelectedTeacher(teacher);
    setRateIntent(false);
    setIsModalOpen(true);
  }, [haptic]);

  // Open the modal already in rate mode (card "Rate Now") — no page navigation.
  const openTeacherToRate = useCallback((teacher: TeacherWithStats) => {
    haptic.medium();
    setSelectedTeacher(teacher);
    setRateIntent(true);
    setIsModalOpen(true);
  }, [haptic]);

  const closeTeacherModal = useCallback(() => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedTeacher(null), 300); // Clear after animation
  }, []);

  const handleNavigate = useCallback((path: string) => {
    haptic.light(); // Light feedback for navigation
    navigate(path);
  }, [navigate, haptic]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    haptic.pullRefresh(); // Haptic feedback for refresh action
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500); // Small delay for better UX
  }, [refetch, haptic]);

  const toggleSearchFilters = useCallback(() => {
    haptic.light(); // Light feedback for toggle
    setShowSearchFilters(prev => !prev);
  }, [haptic]);

  // Pull to refresh for mobile
  usePullToRefresh(handleRefresh);

  return (
    <div ref={containerRef} className="space-y-6 max-w-wide mx-auto">
      <Helmet>
        <title>Teacher Rank (TeacherRank) - Find and Rate Your Teachers | Student Reviews & Ratings</title>
        <meta name="description" content="Teacher Rank (TeacherRank) helps you discover the best teachers through authentic student reviews. Rate your professors, share experiences, and help fellow students make informed decisions about their education on the Teacher Rank platform." />
        <meta name="keywords" content="teacher rank, teacherrank, teacher ratings, professor reviews, student feedback, university professors, teacher ranking, teacher rank app, rate my teacher, academic reviews, teacher rank platform" />
        <link rel="canonical" href="https://teacherrank.vercel.app/" />
        
        {/* Open Graph tags */}
        <meta property="og:title" content="Teacher Rank (TeacherRank) - Find and Rate Your Teachers" />
        <meta property="og:description" content="Teacher Rank helps you discover the best teachers through authentic student reviews. Join TeacherRank to rate professors and help fellow students." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://teacherrank.vercel.app/" />
        <meta property="og:image" content="https://teacherrank.vercel.app/og-image.jpg" />
        
        {/* Twitter Card tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Teacher Rank (TeacherRank) - Find and Rate Your Teachers" />
        <meta name="twitter:description" content="Teacher Rank helps you discover the best teachers through authentic student reviews on TeacherRank." />
        <meta name="twitter:image" content="https://teacherrank.vercel.app/og-image.jpg" />
        
        {/* Schema.org structured data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Teacher Rank",
            "alternateName": ["TeacherRank", "Teacher Rank App", "Teacher Ranking Platform"],
            "url": "https://teacherrank.vercel.app",
            "description": "Teacher Rank (TeacherRank) is the leading platform for student reviews and ratings of teachers and professors.",
            "keywords": "teacher rank, teacherrank, teacher reviews, professor ratings",
            "potentialAction": {
              "@type": "SearchAction",
              "target": {
                "@type": "EntryPoint",
                "urlTemplate": "https://teacherrank.vercel.app/?search={search_term_string}"
              },
              "query-input": "required name=search_term_string"
            }
          })}
        </script>
      </Helmet>
      
      {/* Pull to refresh indicator for mobile */}
      {mobile && (
        <div className="pull-to-refresh-indicator fixed top-20 left-1/2 transform -translate-x-1/2 opacity-0 transition-opacity duration-300 z-content">
          <div className="bg-base-100 rounded-full p-3 shadow-lg border border-base-300">
            <svg className="w-6 h-6 text-primary animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>
      )}

      {/* Hero + primary CTA — fade/rise in sequence on load */}
      <div className="stagger-enter space-y-6">
      {/* Hero Section */}
      <div className="text-center px-4">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-balance text-base-content max-w-3xl mx-auto mb-4">
          Know your <span className="text-primary">teacher</span> before you enroll.
        </h1>
        <p className="text-base-content/70 max-w-2xl mx-auto text-base md:text-lg text-balance">
          Real ratings and reviews from students who&rsquo;ve actually taken the class.
        </p>
      </div>

      {/* Search Toggle Button */}
      <div className="flex justify-center px-4 md:px-0">
        <Button
          variant="primary"
          touch="default"
          onClick={toggleSearchFilters}
          className="flex items-center gap-2 px-6 py-3 rounded-lg transition-all duration-200 font-medium shadow-sm"
          aria-label={showSearchFilters ? "Hide search and filters" : "Find a teacher — open search and filters"}
        >
          <svg 
            className={`w-5 h-5 transition-transform duration-200 ${showSearchFilters ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>{showSearchFilters ? 'Hide search' : 'Find a teacher'}</span>
          <svg 
            className={`w-4 h-4 transition-transform duration-200 ${showSearchFilters ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </Button>
      </div>
      </div>

      {/* Search and Filter Controls - Collapsible */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out mx-4 md:mx-0 ${
        showSearchFilters
          ? 'max-h-screen opacity-100 transform translate-y-0'
          : 'max-h-0 opacity-0 transform -translate-y-4'
      }`}>
        <div className="bg-base-100 rounded-lg p-4 md:p-6 shadow-sm border border-base-300">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative w-full">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-base-content/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                onChange={e => debouncedSearch(e.target.value)}
                placeholder="Search teachers or institutes..."
                className="w-full pl-10 pr-4 py-3 bg-base-200 border border-base-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 text-base-content placeholder-base-content/60 text-base touch-manipulation"
                aria-label="Search teachers"
              />
            </div>
            
            {/* Filters row */}
            <div className="flex flex-col sm:flex-row gap-3">

              {/* Sort */}
              <select
                className="flex-1 px-4 py-3 bg-base-200 border border-base-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 text-base-content text-base touch-manipulation"
                value={sort}
                onChange={e => handleSortChange(e.target.value)}
                aria-label="Sort by"
              >
              <option value="rating_desc">Top Rated</option>
              <option value="rating_asc">Rising Stars</option>
              <option value="name_az">Name A–Z</option>
              <option value="institute_az">Institute A–Z</option>
            </select>

              {/* Institute Filter */}
              <select
                className="flex-1 px-4 py-3 bg-base-200 border border-base-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 text-base-content text-base touch-manipulation"
                value={selectedInstitute}
                onChange={e => handleInstituteChange(e.target.value)}
                aria-label="Filter by institute"
              >
              <option value="all">All Institutes</option>
              {institutes?.map(ins => (
                <option key={ins} value={ins}>{ins}</option>
              ))}
            </select>

              {/* Department & City appear once an institute is chosen (progressive disclosure) */}
              {selectedInstitute !== 'all' && (
                <>
              {/* Department Filter */}
              <select
                className="flex-1 px-4 py-3 bg-base-200 border border-base-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 text-base-content text-base touch-manipulation"
                value={selectedDepartment}
                onChange={e => handleDepartmentChange(e.target.value)}
                aria-label="Filter by department"
              >
              <option value="all">
                {`All Departments in ${selectedInstitute}`}
              </option>
              {departments && departments.length > 0 ? (
                departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))
              ) : (
                <option disabled>No departments found</option>
              )}
            </select>

              {/* City Filter */}
              <select
                className="flex-1 px-4 py-3 bg-base-200 border border-base-300 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 text-base-content text-base touch-manipulation"
                value={selectedCity}
                onChange={e => handleCityChange(e.target.value)}
                aria-label="Filter by city"
              >
              <option value="all">
                {`All Cities in ${selectedInstitute}`}
              </option>
              {cities && cities.length > 0 ? (
                cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))
              ) : (
                <option disabled>No cities found</option>
              )}
            </select>
                </>
              )}

              {/* Refresh Button */}
              <Button
                variant="primary"
                touch="tall"
                loading={isLoading}
                onClick={handleRefresh}
                className="flex-shrink-0 px-4 py-3 disabled:cursor-not-allowed rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium"
                aria-label="Refresh teacher list"
              >
              {isLoading ? (
                <span>Refreshing...</span>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh</span>
                </>
              )}
              </Button>
            </div>

            {/* Results Statistics - Only shown when filters are open */}
            {!isLoading && !isRefreshing && data && (
              <div className="pt-4 border-t border-base-300">
                <div className="space-y-4">
                  {/* Statistics Header */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg shadow-md">
                      <svg className="w-4 h-4 text-primary-content" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-base-content">Search Results</h3>
                      <p className="text-xs text-base-content/70">
                        {(search || selectedInstitute !== 'all' || selectedDepartment !== 'all' || selectedCity !== 'all')
                          ? 'Statistics for your filtered results'
                          : 'Overview of all teachers'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Statistics Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-base-200 rounded-lg p-3">
                      <div className="text-center">
                        <div className="text-lg font-bold text-primary">
                          {data.data.length}
                        </div>
                        <div className="text-xs text-base-content/70">
                          Current Page
                        </div>
                      </div>
                    </div>

                    <div className="bg-base-200 rounded-lg p-3">
                      <div className="text-center">
                        <div className="text-lg font-bold text-info">
                          {data.total}
                        </div>
                        <div className="text-xs text-base-content/70">
                          Total Found
                        </div>
                      </div>
                    </div>

                    <div className="bg-base-200 rounded-lg p-3">
                      <div className="text-center">
                        <div className="text-lg font-bold text-success">
                          {data.totalPages}
                        </div>
                        <div className="text-xs text-base-content/70">
                          Total Pages
                        </div>
                      </div>
                    </div>

                    <div className="bg-base-200 rounded-lg p-3">
                      <div className="text-center">
                        <div className="text-lg font-bold text-warning">
                          {Math.round((data.data.filter(t => t.average_rating && t.average_rating > 0).length / data.data.length) * 100) || 0}%
                        </div>
                        <div className="text-xs text-base-content/70">
                          With Ratings
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Active Filters Summary */}
                  {(search || selectedInstitute !== 'all' || selectedDepartment !== 'all' || selectedCity !== 'all') && (
                    <div className="bg-primary/10 rounded-lg p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-primary">Active filters:</span>
                        {search && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-info/10 text-info rounded text-xs">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            "{search}"
                          </span>
                        )}
                        {selectedInstitute !== 'all' && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/20 text-primary rounded text-xs">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 7l6 3v11H6V10l6-3z" />
                            </svg>
                            {selectedInstitute}
                          </span>
                        )}
                        {selectedDepartment !== 'all' && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-success/10 text-success rounded text-xs">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            {selectedDepartment}
                          </span>
                        )}
                        {selectedCity !== 'all' && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-warning/10 text-warning rounded text-xs">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {selectedCity}
                          </span>
                        )}
                        <button
                          onClick={clearAllFilters}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-error/10 text-error hover:bg-error/20 rounded text-xs font-medium transition-colors duration-200"
                          aria-label="Clear all filters"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Clear All
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-error/10 border border-error/30 rounded-lg p-6 text-center">
          <p className="text-error font-medium">Failed to load teachers. Please try again later.</p>
          <Button
            variant="error"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded"
          >
            Refresh Page
          </Button>
        </div>
      )}

      {/* Loading State */}
      {(isLoading || isRefreshing) && <TeacherListSkeleton count={12} />}


      {/* Teacher Cards Grid */}
      {!isLoading && !isRefreshing && data && (
        <>
          <ul className="card-grid stagger-enter">
            {rankedTeachers.map((teacher) => (
              <li key={teacher.id}>
                <TeacherCard
                  teacher={teacher}
                  onModalOpen={openTeacherModal}
                  onRate={openTeacherToRate}
                  onPrefetch={prefetchTeacher}
                  onNavigate={handleNavigate}
                />
              </li>
            ))}

            {/* No Results State — turn the dead-end into a guided next step */}
            {rankedTeachers.length === 0 && (
              <li className="col-span-full text-center py-16 animate-fadeIn">
                <h3 className="text-xl font-bold text-base-content/70 mb-2">
                  No teachers found
                </h3>
                {search.trim() ? (
                  <>
                    <p className="text-base-content/70 mb-4">
                      We don&rsquo;t have a match for &ldquo;{search.trim()}&rdquo; yet.
                    </p>
                    <Button
                      variant="primary"
                      onClick={() =>
                        handleNavigate(`/feedback?tab=request&name=${encodeURIComponent(search.trim())}`)
                      }
                    >
                      Request &ldquo;{search.trim().length > 32 ? `${search.trim().slice(0, 32)}…` : search.trim()}&rdquo;
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-base-content/70 mb-4">
                      Try adjusting your filters.
                    </p>
                    <Button variant="secondary" onClick={clearAllFilters}>
                      Clear all filters
                    </Button>
                  </>
                )}
              </li>
            )}
          </ul>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="bg-base-100 rounded-lg p-4 shadow-sm border border-base-300">
              <Pagination
                currentPage={page}
                totalPages={data.totalPages}
                onPageChange={handlePageChange}
                className="justify-center"
              />
            </div>
          )}

          {/* Teacher Modal Portal */}
          <TeacherModalPortal
            teacher={selectedTeacher}
            isOpen={isModalOpen}
            onClose={closeTeacherModal}
            autoRate={rateIntent}
          />
        </>
      )}
    </div>
  );
}