import React, { useMemo, useState, useCallback, useRef, Suspense } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Helmet } from 'react-helmet-async';
import { useTeachersOptimized, usePrefetchTeacher, useInstitutes, useDepartments } from '../hooks/useTeachersOptimized';
import { Pagination } from './Pagination';
import { TeacherListSkeleton } from './Skeleton';
import { RatingStars } from './RatingStars';
import { AvatarImage } from './AvatarImage';
import { useHaptic } from '../lib/haptic';
import { useMobileDetection, usePullToRefresh } from '../lib/mobile';
import { TeacherModal } from './TeacherModal';
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

// Extract constants outside component to prevent recreations
const RATING_EMOJIS = Object.freeze({
  1: { emoji: '🏆', color: 'bg-gradient-to-br from-yellow-400 to-yellow-600', text: 'text-white', shadow: 'shadow-yellow-500/50', glow: 'animate-pulse' },
  2: { emoji: '🥈', color: 'bg-gradient-to-br from-gray-300 to-gray-500', text: 'text-white', shadow: 'shadow-gray-500/50', glow: '' },
  3: { emoji: '🥉', color: 'bg-gradient-to-br from-orange-400 to-orange-600', text: 'text-white', shadow: 'shadow-orange-500/50', glow: '' },
});

const ACHIEVEMENT_THRESHOLDS = Object.freeze({
  diamond: { rating: 4.5, count: 0, emoji: '💎', tooltip: 'Diamond Rating' },
  popular: { rating: 0, count: 50, emoji: '🔥', tooltip: 'Popular Teacher' },
  highly_rated: { rating: 4.0, count: 0, emoji: '👑', tooltip: 'Highly Rated' },
  century: { rating: 0, count: 100, emoji: '💯', tooltip: 'Century Club' },
});

// Optimized memoized components
const RankingBadge = React.memo<{ position: number; className?: string }>(
  ({ position, className = '' }) => {
    const props = (RATING_EMOJIS as any)[position] || {
      emoji: '⭐',
      color: 'bg-gradient-to-br from-purple-500 to-pink-500',
      text: 'text-white',
      shadow: 'shadow-purple-500/50',
      glow: ''
    };

    return (
      <div className={`absolute -top-2 -right-2 ${props.color} ${props.text} ${props.shadow} ${props.glow} rounded-full w-10 h-10 flex items-center justify-center text-lg font-bold shadow-lg border-2 border-white ${className}`}>
        <span className="text-sm">{position <= 3 ? props.emoji : `#${position}`}</span>
      </div>
    );
  }
);

RankingBadge.displayName = 'RankingBadge';

const AchievementBadges = React.memo<{ rating: number; count: number }>(
  ({ rating, count }) => {
    const badges = useMemo(() => {
      const result = [];
      if (rating >= ACHIEVEMENT_THRESHOLDS.diamond.rating) {
        result.push(ACHIEVEMENT_THRESHOLDS.diamond);
      }
      if (count >= ACHIEVEMENT_THRESHOLDS.popular.count) {
        result.push(ACHIEVEMENT_THRESHOLDS.popular);
      }
      if (rating >= ACHIEVEMENT_THRESHOLDS.highly_rated.rating) {
        result.push(ACHIEVEMENT_THRESHOLDS.highly_rated);
      }
      if (count >= ACHIEVEMENT_THRESHOLDS.century.count) {
        result.push(ACHIEVEMENT_THRESHOLDS.century);
      }
      return result;
    }, [rating, count]);

    if (badges.length === 0) return null;

    return (
      <div className="flex gap-1 mt-2">
        {badges.map((badge, index) => (
          <div
            key={badge.tooltip}
            className="tooltip tooltip-top"
            data-tip={badge.tooltip}
          >
            <span className="inline-block w-6 h-6 text-sm animate-bounce" style={{ animationDelay: `${index * 200}ms` }}>
              {badge.emoji}
            </span>
          </div>
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
  onPrefetch: (id: string) => void;
  onNavigate: (path: string) => void;
}>(
  ({ teacher, onModalOpen, onPrefetch, onNavigate }) => {
    const handleViewProfile = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      // Haptic feedback will be handled by the parent component
      onNavigate(`/teacher/${teacher.id}`);
    }, [teacher.id, onNavigate]);

    const handleRateNow = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      // Haptic feedback will be handled by the parent component
      onNavigate(`/teacher/${teacher.id}#rate`);
    }, [teacher.id, onNavigate]);

    const handleCardClick = useCallback(() => {
      onModalOpen(teacher);
    }, [teacher, onModalOpen]);

    const handleMouseEnter = useCallback(() => {
      onPrefetch(teacher.id);
    }, [teacher.id, onPrefetch]);

    return (
      <article
        className="group relative bg-white dark:bg-gray-800 rounded-lg p-4 md:p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-purple-500/10 transition-all duration-200 cursor-pointer touch-manipulation"
        onClick={handleCardClick}
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
              className="border-2 border-gray-200 dark:border-gray-700 md:w-16 md:h-16"
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base md:text-lg text-gray-900 dark:text-white mb-1 truncate">
              {teacher.name}
            </h3>
            <p className="text-gray-700 dark:text-gray-300 text-xs md:text-sm font-medium mb-1 truncate">
              {teacher.institute}
            </p>
            {teacher.department && (
              <p className="text-gray-500 dark:text-gray-500 text-xs mb-2 truncate italic">
                {teacher.department}
              </p>
            )}
            
            <div className="flex items-center gap-3 mb-2">
              <RatingStars rating={clamp(teacher.average_rating ?? 0)} size={16} allowHalf={true} />
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {teacher.average_rating ? teacher.average_rating.toFixed(1) : 'NEW'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {(teacher.ratings_count ?? 0) > 0 ? `${teacher.ratings_count} reviews` : 'No reviews yet'}
              </div>
            </div>

            <AchievementBadges 
              rating={teacher.average_rating ?? 0} 
              count={teacher.ratings_count ?? 0} 
            />
          </div>
        </div>

        <p className="text-gray-600 dark:text-gray-400 text-xs md:text-sm mb-4 md:mb-6 line-clamp-2 leading-relaxed">
          {teacher.bio || 'This teacher hasn\'t added a bio yet. Be the first to rate them!'}
        </p>

        <div className="flex gap-2 md:gap-3">
          <button
            className="flex-1 px-3 md:px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 text-sm md:text-base min-h-[44px] touch-manipulation"
            onClick={handleViewProfile}
            aria-label={`View ${teacher.name}'s profile`}
          >
            View Profile
          </button>
          <button
            className="flex-1 px-3 md:px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors duration-200 text-sm md:text-base min-h-[44px] touch-manipulation"
            onClick={handleRateNow}
            aria-label={`Rate ${teacher.name}`}
          >
            Rate Now
          </button>
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
}>(({ teacher, isOpen, onClose }) => {
  if (!teacher || !isOpen) return null;

  return createPortal(
    <Suspense fallback={<div className="loading loading-spinner loading-lg" />}>
      <TeacherModal teacher={teacher} isOpen={isOpen} onClose={onClose} />
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
  const [page, setPage] = useState(1);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherWithStats | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
    sortBy: sort,
    page,
    pageSize: 12,
  });

  const { data: institutes } = useInstitutes();
  const { data: departments } = useDepartments(selectedInstitute);

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
    setPage(1);
  }, [haptic]);

  const handleDepartmentChange = useCallback((value: string) => {
    haptic.light(); // Light feedback for filter change
    setSelectedDepartment(value);
    setPage(1);
  }, [haptic]);

  const handleSortChange = useCallback((value: string) => {
    haptic.light(); // Light feedback for sort change
    setSort(value as any);
    setPage(1);
  }, [haptic]);

  const openTeacherModal = useCallback((teacher: TeacherWithStats) => {
    haptic.medium(); // Medium feedback for modal open
    setSelectedTeacher(teacher);
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
    <div ref={containerRef} className="space-y-8">
      <Helmet>
        <title>Teacher Rank - Find and Rate Your Teachers | Student Reviews & Ratings</title>
        <meta name="description" content="Discover the best teachers through authentic student reviews. Rate your professors, share experiences, and help fellow students make informed decisions about their education." />
        <meta name="keywords" content="teacher ratings, professor reviews, student feedback, university professors, teacher ranking, rate my teacher, academic reviews" />
        <link rel="canonical" href="https://teacherrank.vercel.app/" />
        
        {/* Open Graph tags */}
        <meta property="og:title" content="Teacher Rank - Find and Rate Your Teachers" />
        <meta property="og:description" content="Discover the best teachers through authentic student reviews. Rate your professors and help fellow students." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://teacherrank.vercel.app/" />
        <meta property="og:image" content="https://teacherrank.vercel.app/og-image.jpg" />
        
        {/* Twitter Card tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Teacher Rank - Find and Rate Your Teachers" />
        <meta name="twitter:description" content="Discover the best teachers through authentic student reviews." />
        <meta name="twitter:image" content="https://teacherrank.vercel.app/og-image.jpg" />
        
        {/* Schema.org structured data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Teacher Rank",
            "url": "https://teacherrank.vercel.app",
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
        <div className="pull-to-refresh-indicator fixed top-20 left-1/2 transform -translate-x-1/2 opacity-0 transition-opacity duration-300 z-10">
          <div className="bg-white dark:bg-gray-800 rounded-full p-3 shadow-lg border border-gray-200 dark:border-gray-700">
            <svg className="w-6 h-6 text-purple-600 dark:text-purple-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="text-center px-4">
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Teacher Rankings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-sm md:text-base">
          Discover and rate teachers based on student reviews and feedback.
        </p>
      </div>

      {/* Search Toggle Button */}
      <div className="flex justify-center px-4 md:px-0">
        <button
          onClick={toggleSearchFilters}
          className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all duration-200 font-medium min-h-[44px] touch-manipulation shadow-lg hover:shadow-xl"
          aria-label={showSearchFilters ? "Hide search and filters" : "Show search and filters"}
        >
          <svg 
            className={`w-5 h-5 transition-transform duration-200 ${showSearchFilters ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span>{showSearchFilters ? 'Hide Search' : 'Search & Filter'}</span>
          <svg 
            className={`w-4 h-4 transition-transform duration-200 ${showSearchFilters ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Search and Filter Controls - Collapsible */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out mx-4 md:mx-0 ${
        showSearchFilters 
          ? 'max-h-96 opacity-100 transform translate-y-0' 
          : 'max-h-0 opacity-0 transform -translate-y-4'
      }`}>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 md:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col gap-4">
            {/* Search */}
            <div className="relative w-full">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                onChange={e => debouncedSearch(e.target.value)}
                placeholder="Search teachers or institutes..."
                className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-base touch-manipulation"
                aria-label="Search teachers"
              />
            </div>
            
            {/* Filters row */}
            <div className="flex flex-col sm:flex-row gap-3">

              {/* Sort */}
              <select
                className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 text-gray-900 dark:text-white text-base touch-manipulation"
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
                className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 text-gray-900 dark:text-white text-base touch-manipulation"
                value={selectedInstitute}
                onChange={e => handleInstituteChange(e.target.value)}
                aria-label="Filter by institute"
              >
              <option value="all">All Institutes</option>
              {institutes?.map(ins => (
                <option key={ins} value={ins}>{ins}</option>
              ))}
            </select>

              {/* Department Filter */}
              <select
                className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 text-gray-900 dark:text-white text-base touch-manipulation"
                value={selectedDepartment}
                onChange={e => handleDepartmentChange(e.target.value)}
                aria-label="Filter by department"
              >
              <option value="all">
                {selectedInstitute !== 'all'
                  ? `All Departments in ${selectedInstitute}`
                  : 'All Departments'}
              </option>
              {departments && departments.length > 0 ? (
                departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))
              ) : (
                selectedInstitute !== 'all' && <option disabled>No departments found</option>
              )}
            </select>

              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="flex-shrink-0 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium min-h-[48px] touch-manipulation"
                aria-label="Refresh teacher list"
              >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  <span>Refreshing...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Refresh</span>
                </>
              )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <p className="text-red-700 dark:text-red-400 font-medium">Failed to load teachers. Please try again later.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Refresh Page
          </button>
        </div>
      )}

      {/* Loading State */}
      {(isLoading || isRefreshing) && <TeacherListSkeleton count={12} />}

      {/* Teacher Cards Grid */}
      {!isLoading && !isRefreshing && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 px-4 md:px-0">
            {rankedTeachers.map((teacher) => (
              <TeacherCard
                key={teacher.id}
                teacher={teacher}
                onModalOpen={openTeacherModal}
                onPrefetch={prefetchTeacher}
                onNavigate={handleNavigate}
              />
            ))}

            {/* No Results State */}
            {rankedTeachers.length === 0 && (
              <div className="col-span-full text-center py-16">
                <h3 className="text-xl font-bold text-gray-600 mb-2">
                  No Teachers Found
                </h3>
                <p className="text-gray-500">
                  Try adjusting your search filters or check back later!
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
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
          />
        </>
      )}
    </div>
  );
}