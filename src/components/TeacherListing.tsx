import React, { useMemo, useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import { SearchInput } from './SearchInput';
import { SectionErrorBoundary } from './SectionErrorBoundary';
import { Select } from './Select';
import { EmptyState } from './EmptyState';
import { ActiveFilterChips, FilterChip } from './ActiveFilterChips';
import { SearchIcon, ChevronDownIcon, RefreshIcon, BuildingIcon, DocumentIcon, MapPinIcon } from './icons';
import { usePlatformStats } from '../hooks/useStats';
import type { TeacherWithStats } from '../types';

// Utility function with better performance
const clamp = (v: number, min = 0, max = 5) => Math.max(min, Math.min(max, v));

// URL param vocabulary (D4): `search` matches the published JSON-LD
// SearchAction (/?search={term}); defaults are removed so URLs stay clean.
const SORT_OPTIONS = ['rating_desc', 'rating_asc', 'name_az', 'institute_az'] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

const PARAM_DEFAULTS: Record<string, string> = {
  search: '',
  institute: 'all',
  dept: 'all',
  city: 'all',
  sort: 'rating_desc',
  page: '1',
};

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
        className="group relative flex flex-col h-full bg-base-100 rounded-lg p-4 md:p-6 shadow-sm border border-base-300 card-hover cursor-pointer touch-manipulation"
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

        <div className="flex gap-2 md:gap-3 mt-auto">
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
      prev.avatar_url === next.avatar_url &&
      prev.designation === next.designation &&
      prev.city === next.city &&
      prev.linkedin_url === next.linkedin_url
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
  // Gate on `teacher` only (not `isOpen`) so the modal stays mounted while
  // isOpen=false and TeacherModal's usePresence can play its exit animation
  // before unmounting itself. `selectedTeacher` is cleared after the animation.
  if (!teacher) return null;

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

  // The URL is the single source of truth for filters/sort/page (D4) —
  // shareable, bookmarkable, and back/forward step through filter states.
  const search = searchParams.get('search') ?? '';
  const selectedInstitute = searchParams.get('institute') ?? 'all';
  const selectedDepartment = searchParams.get('dept') ?? 'all';
  const selectedCity = searchParams.get('city') ?? 'all';
  const sortParam = searchParams.get('sort');
  const sort: SortOption = SORT_OPTIONS.includes(sortParam as SortOption)
    ? (sortParam as SortOption)
    : 'rating_desc';
  const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);

  // Only remaining local state: the input's live text + a guard so our own
  // debounced pushes don't echo back into the box.
  const [searchText, setSearchText] = useState(search);
  const lastPushedSearch = useRef(search);

  const [selectedTeacher, setSelectedTeacher] = useState<TeacherWithStats | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rateIntent, setRateIntent] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Arriving on a shared/bookmarked URL with filters? Open the panel so the
  // active state is visible.
  const [showSearchFilters, setShowSearchFilters] = useState(
    () =>
      Boolean(search) ||
      selectedInstitute !== 'all' ||
      selectedDepartment !== 'all' ||
      selectedCity !== 'all' ||
      sort !== 'rating_desc'
  );

  const navigate = useNavigate();
  const prefetchTeacher = usePrefetchTeacher();
  const haptic = useHaptic();
  const { mobile } = useMobileDetection();
  const containerRef = useRef<HTMLDivElement>(null);

  // Write params, dropping defaults so URLs stay clean (D4).
  const updateParams = useCallback(
    (updates: Record<string, string>, { replace = false } = {}) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(updates)) {
            if (value === PARAM_DEFAULTS[key]) next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace }
      );
    },
    [setSearchParams]
  );

  // Debounce the live text into the URL with { replace: true } — keystrokes
  // don't pollute history; any search change resets the page.
  useEffect(() => {
    if (searchText === search) return;
    const timer = setTimeout(() => {
      lastPushedSearch.current = searchText;
      updateParams({ search: searchText, page: '1' }, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, search, updateParams]);

  // Back/forward re-sync: when the URL's search changes underneath us (POP,
  // shared link), adopt it into the input.
  useEffect(() => {
    if (search !== lastPushedSearch.current) {
      lastPushedSearch.current = search;
      setSearchText(search);
    }
  }, [search]);

  // Count of active (non-default) filters — shown on the closed toggle.
  const activeFilterCount =
    (search ? 1 : 0) +
    (selectedInstitute !== 'all' ? 1 : 0) +
    (selectedDepartment !== 'all' ? 1 : 0) +
    (selectedCity !== 'all' ? 1 : 0);

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
  const { data: platformStats } = usePlatformStats();

  // Optimized ranking calculation
  const rankedTeachers = useMemo(() => {
    if (!data?.data || data.data.length === 0) return [];

    // The server already returns the page in the chosen order. Assign a GLOBAL
    // rank using the page offset — never re-sort here (re-sorting silently broke
    // the "Name A–Z" / "Institute A–Z" options by reordering them by rating).
    const offset = (page - 1) * 12; // pageSize

    if (sort === 'rating_asc') {
      // Ascending list (lowest first): #1 still means the globally highest-rated,
      // so count down from the filtered total to keep ranks consistent with desc.
      return data.data.map((teacher, index) => ({
        ...teacher,
        rank: (data.total ?? 0) - (offset + index),
      }));
    }

    // rating_desc + alphabetical sorts: rank by global position in server order.
    return data.data.map((teacher, index) => ({
      ...teacher,
      rank: offset + index + 1,
    }));
  }, [data?.data, data?.total, sort, page]);

  // Stable callbacks — filter/sort/page changes PUSH (back steps filter
  // states); every filter change resets the page.
  const handlePageChange = useCallback((newPage: number) => {
    updateParams({ page: String(newPage) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [updateParams]);

  const handleInstituteChange = useCallback((value: string) => {
    haptic.light(); // Light feedback for filter change
    // Department/city are scoped to the institute, so they reset with it.
    updateParams({ institute: value, dept: 'all', city: 'all', page: '1' });
  }, [haptic, updateParams]);

  const handleDepartmentChange = useCallback((value: string) => {
    haptic.light(); // Light feedback for filter change
    updateParams({ dept: value, page: '1' });
  }, [haptic, updateParams]);

  const handleCityChange = useCallback((value: string) => {
    haptic.light(); // Light feedback for filter change
    updateParams({ city: value, page: '1' });
  }, [haptic, updateParams]);

  const handleSortChange = useCallback((value: string) => {
    haptic.light(); // Light feedback for sort change
    updateParams({ sort: value, page: '1' });
  }, [haptic, updateParams]);

  const clearAllFilters = useCallback(() => {
    haptic.medium(); // Medium feedback for clearing filters
    setSearchText('');
    lastPushedSearch.current = '';
    updateParams({ search: '', institute: 'all', dept: 'all', city: 'all', page: '1' });
  }, [haptic, updateParams]);

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

  // Keep the modal header stats live: after an inline submit, the existing
  // invalidation refetches this listing — reuse that row instead of the
  // snapshot captured at open time (zero extra requests, D5).
  const liveSelectedTeacher = useMemo(() => {
    if (!selectedTeacher) return null;
    return data?.data.find((t) => t.id === selectedTeacher.id) ?? selectedTeacher;
  }, [data?.data, selectedTeacher]);

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
      <Helmet titleTemplate="%s">
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
        {platformStats && (platformStats.totalTeachers > 0 || platformStats.totalRatings > 0) && (
          <p className="mt-4 text-sm text-base-content/60">
            <span className="font-semibold text-base-content/80">{platformStats.totalTeachers.toLocaleString()}</span> teachers
            <span className="mx-1.5 text-base-content/30" aria-hidden="true">·</span>
            <span className="font-semibold text-base-content/80">{platformStats.totalRatings.toLocaleString()}</span> reviews
            {platformStats.averageRating > 0 && (
              <>
                <span className="mx-1.5 text-base-content/30" aria-hidden="true">·</span>
                <span className="font-semibold text-base-content/80">{platformStats.averageRating.toFixed(1)}</span>
                <span className="text-rating" aria-hidden="true">★</span> avg rating
              </>
            )}
          </p>
        )}
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
          <SearchIcon className={`w-5 h-5 transition-transform duration-200 ${showSearchFilters ? 'rotate-180' : ''}`} />
          <span>
            {showSearchFilters ? 'Hide search' : 'Find a teacher'}
            {!showSearchFilters && activeFilterCount > 0 && (
              <span className="opacity-90"> · {activeFilterCount} {activeFilterCount === 1 ? 'filter' : 'filters'}</span>
            )}
          </span>
          <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${showSearchFilters ? 'rotate-180' : ''}`} />
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
            {/* Search — controlled, so Clear All actually empties the box */}
            <SearchInput
              value={searchText}
              onChange={setSearchText}
              onClear={() => {
                lastPushedSearch.current = '';
                updateParams({ search: '', page: '1' }, { replace: true });
              }}
              aria-label="Search teachers"
              placeholder="Search teachers or institutes..."
            />

            {/* Filters row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Select
                value={sort}
                onChange={handleSortChange}
                aria-label="Sort by"
                className="flex-1"
                options={[
                  { value: 'rating_desc', label: 'Top Rated' },
                  { value: 'rating_asc', label: 'Rising Stars' },
                  { value: 'name_az', label: 'Name A–Z' },
                  { value: 'institute_az', label: 'Institute A–Z' },
                ]}
              />

              <Select
                value={selectedInstitute}
                onChange={handleInstituteChange}
                aria-label="Filter by institute"
                className="flex-1"
                options={[
                  { value: 'all', label: 'All Institutes' },
                  ...(institutes?.map(ins => ({ value: ins, label: ins })) ?? []),
                ]}
              />

              {/* Department & City appear once an institute is chosen (progressive disclosure) */}
              {selectedInstitute !== 'all' && (
                <>
                  <Select
                    value={selectedDepartment}
                    onChange={handleDepartmentChange}
                    aria-label="Filter by department"
                    className="flex-1"
                    options={[
                      { value: 'all', label: `All Departments in ${selectedInstitute}` },
                      ...(departments && departments.length > 0
                        ? departments.map(dept => ({ value: dept, label: dept }))
                        : [{ value: '__none', label: 'No departments found', disabled: true }]),
                    ]}
                  />

                  <Select
                    value={selectedCity}
                    onChange={handleCityChange}
                    aria-label="Filter by city"
                    className="flex-1"
                    options={[
                      { value: 'all', label: `All Cities in ${selectedInstitute}` },
                      ...(cities && cities.length > 0
                        ? cities.map(city => ({ value: city, label: city }))
                        : [{ value: '__none', label: 'No cities found', disabled: true }]),
                    ]}
                  />
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
                  <RefreshIcon className="w-5 h-5" />
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

                  {/* One quiet results line — the pager already carries page X of Y */}
                  <p className="text-sm text-base-content/70">
                    Showing <span className="font-semibold text-base-content">{data.data.length}</span> of{' '}
                    <span className="font-semibold text-base-content">{data.total}</span>{' '}
                    {data.total === 1 ? 'teacher' : 'teachers'}
                  </p>

                  {/* Active Filters Summary */}
                  <ActiveFilterChips
                    filters={[
                      ...(search
                        ? [{ key: 'search', label: `"${search}"`, icon: <SearchIcon className="w-3 h-3" />, tone: 'info' } as FilterChip]
                        : []),
                      ...(selectedInstitute !== 'all'
                        ? [{ key: 'institute', label: selectedInstitute, icon: <BuildingIcon className="w-3 h-3" />, tone: 'primary' } as FilterChip]
                        : []),
                      ...(selectedDepartment !== 'all'
                        ? [{ key: 'dept', label: selectedDepartment, icon: <DocumentIcon className="w-3 h-3" />, tone: 'success' } as FilterChip]
                        : []),
                      ...(selectedCity !== 'all'
                        ? [{ key: 'city', label: selectedCity, icon: <MapPinIcon className="w-3 h-3" />, tone: 'warning' } as FilterChip]
                        : []),
                    ]}
                    onClearAll={clearAllFilters}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-error/10 border border-error/30 rounded-lg p-6 text-center">
          <p className="text-error font-medium">We couldn&rsquo;t load teachers right now.</p>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="mt-4"
          >
            Try again
          </Button>
        </div>
      )}

      {/* Loading State */}
      {(isLoading || isRefreshing) && <TeacherListSkeleton count={12} />}


      {/* Teacher Cards Grid */}
      <SectionErrorBoundary
        resetKey={`${search}|${selectedInstitute}|${selectedDepartment}|${selectedCity}|${sort}|${page}`}
        title="We couldn't show these teachers"
        message="This list ran into a problem. Try again — your filters are still applied."
      >
      {!isLoading && !isRefreshing && data && (
        <>
          <ul className="card-grid stagger-enter">
            {rankedTeachers.map((teacher) => (
              <li key={teacher.id} className="h-full">
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
              <li className="col-span-full animate-fadeIn">
                {search.trim() ? (
                  <EmptyState
                    title="No teachers found"
                    description={<>We don&rsquo;t have a match for &ldquo;{search.trim()}&rdquo; yet.</>}
                    action={
                      <Button
                        variant="primary"
                        onClick={() =>
                          handleNavigate(`/feedback?tab=request&name=${encodeURIComponent(search.trim())}`)
                        }
                      >
                        Request &ldquo;{search.trim().length > 32 ? `${search.trim().slice(0, 32)}…` : search.trim()}&rdquo;
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    title="No teachers found"
                    description="Try adjusting your filters."
                    action={
                      <div className="flex flex-col items-center gap-3">
                        <Button variant="secondary" onClick={clearAllFilters}>
                          Clear all filters
                        </Button>
                        <Link
                          to="/feedback?tab=request"
                          className="text-sm text-primary hover:text-primary-focus underline"
                        >
                          Can&rsquo;t find them? Request a teacher
                        </Link>
                      </div>
                    }
                  />
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
            teacher={liveSelectedTeacher}
            isOpen={isModalOpen}
            onClose={closeTeacherModal}
            autoRate={rateIntent}
          />
        </>
      )}
      </SectionErrorBoundary>
    </div>
  );
}