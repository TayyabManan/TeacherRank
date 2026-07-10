import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTeachersOptimized, useInstituteFacets } from '../hooks/useTeachersOptimized';
import { RatingStars } from '../components/RatingStars';
import { AvatarImage } from '../components/AvatarImage';
import { TeacherModal } from '../components/TeacherModal';
import { Pagination } from '../components/Pagination';
import { Button, buttonClasses } from '../components/Button';
import { PageHero } from '../components/PageHero';
import { SearchInput } from '../components/SearchInput';
import { Select } from '../components/Select';
import { StatTile } from '../components/StatTile';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { SectionErrorBoundary } from '../components/SectionErrorBoundary';
import { SectionHeading } from '../components/SectionHeading';
import { ActiveFilterChips, FilterChip } from '../components/ActiveFilterChips';
import { TeacherListSkeleton } from '../components/Skeleton';
import { BuildingIcon, ChevronLeftIcon, SearchIcon, DocumentIcon, MapPinIcon } from '../components/icons';
import type { TeacherWithStats } from '../types';

export default function InstitutePage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const instituteName = decodeURIComponent(name || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherWithStats | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  
  // Debounce search query to prevent excessive API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      if (searchQuery !== debouncedSearchQuery) {
        setCurrentPage(1); // Reset to first page only when search actually changes
      }
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Listing via the server-side RPC (filter + sort + paginate in one request)
  const { data: teachersResponse, isLoading, error, refetch } = useTeachersOptimized({
    institute: instituteName,
    search: debouncedSearchQuery,
    department: selectedDepartment,
    city: selectedCity,
    page: currentPage,
    pageSize: 12
  });

  const instituteTeachers = teachersResponse?.data || [];
  const totalPages = teachersResponse?.totalPages || 1;

  // Teachers are already filtered and paginated by the hook
  const paginatedTeachers = instituteTeachers;

  // Filter options + stats header from one narrow facets query (replaces the
  // old pageSize-1000 full-row second fetch)
  const { data: facets } = useInstituteFacets(instituteName);

  const departments = facets?.departments || [];
  const cities = facets?.cities || [];

  const instituteStats = useMemo(() => {
    if (!facets) return null;
    return {
      totalTeachers: facets.totalTeachers,
      totalRatings: facets.totalRatings,
      avgInstitute: facets.avgRating,
      topRated: facets.topRatedCount,
      teachersWithRatings: facets.ratedTeachersCount
    };
  }, [facets]);

  // Same page-change scroll the home listing uses — new page starts at the top.
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setCurrentPage(1);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setSelectedDepartment('all');
    setSelectedCity('all');
    setCurrentPage(1);
  }, []);

  if (error) {
    return (
      <div className="max-w-wide mx-auto py-8">
        <ErrorState
          title="Couldn't load teachers"
          message="Something went wrong on our end. Try again in a moment."
          onRetry={() => refetch()}
          secondaryAction={
            <Link to="/teachers" className={buttonClasses({ variant: 'neutral' })}>
              Browse all teachers
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-wide mx-auto space-y-6">
      <Helmet>
        <title>{instituteName}</title>
        <meta name="description" content={`Browse and rate teachers at ${instituteName}. Find the best educators through student reviews.`} />
      </Helmet>

      {/* Institute Header */}
      <PageHero
        icon={<BuildingIcon className="w-6 h-6 text-primary-content" />}
        title={instituteName}
        description={
          isLoading ? (
            <span className="opacity-70">Loading institute information...</span>
          ) : instituteStats ? (
            <>
              Explore {instituteStats.totalTeachers} exceptional educators at {instituteName}.
              {instituteStats.teachersWithRatings > 0 && (
                <> With an average rating of {instituteStats.avgInstitute.toFixed(1)} stars.</>
              )}
            </>
          ) : (
            <span className="opacity-70">No teachers found at this institute.</span>
          )
        }
        stats={
          instituteStats
            ? [
                { value: instituteStats.totalTeachers, label: 'Teachers' },
                { value: instituteStats.totalRatings, label: 'Reviews' },
                ...(instituteStats.avgInstitute > 0
                  ? [{ value: instituteStats.avgInstitute.toFixed(1), label: 'Avg Rating' }]
                  : []),
              ]
            : undefined
        }
        actions={
          <>
            <Link
              to="/teachers"
              className="inline-flex items-center gap-1.5 bg-primary-content/15 backdrop-blur-sm text-primary-content hover:bg-primary-content/25 px-4 py-2 rounded-lg font-medium transition-all duration-200 border border-primary-content/30"
            >
              <ChevronLeftIcon className="w-4 h-4" />
              Back to All Teachers
            </Link>
            {instituteStats && instituteStats.totalTeachers > 0 && (
              <button
                onClick={() => {
                  const teachersSection = document.getElementById('institute-teachers');
                  if (teachersSection) {
                    const yOffset = -100; // Offset to account for fixed header
                    const y = teachersSection.getBoundingClientRect().top + window.pageYOffset + yOffset;
                    window.scrollTo({ top: y, behavior: 'smooth' });
                  }
                }}
                className={buttonClasses({
                  variant: 'default',
                  className:
                    'bg-primary-content text-primary hover:bg-base-200 border-transparent hover:border-transparent',
                })}
              >
                View {instituteName} Teachers ({instituteStats.totalTeachers})
              </button>
            )}
          </>
        }
      />

      {/* Institute Statistics */}
      {instituteStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile value={instituteStats.totalTeachers} label="Total Teachers" tone="info" />
          <StatTile value={instituteStats.totalRatings} label="Total Reviews" tone="primary" />
          <StatTile
            value={instituteStats.avgInstitute > 0 ? instituteStats.avgInstitute.toFixed(1) : '—'}
            label="Avg Rating"
            tone="warning"
          />
          <StatTile value={instituteStats.topRated} label="Top Rated (4.5+)" tone="success" />
        </div>
      )}
      
      {/* Search and Filter Section */}
      {(facets?.totalTeachers || 0) > 0 && (
        <div className="bg-base-100 rounded-lg p-6 shadow-sm border border-base-300">
          <div className="space-y-6">
            {/* Filter Header */}
            <SectionHeading as="h2">Filter Teachers</SectionHeading>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                onClear={clearSearch}
                label="Search Teachers"
                aria-label="Search teachers"
                placeholder="Search by name, bio, or designation..."
                className="lg:col-span-1"
              />

              {departments.length > 0 && (
                <Select
                  value={selectedDepartment}
                  onChange={(value) => {
                    setSelectedDepartment(value);
                    setCurrentPage(1);
                  }}
                  label="Department"
                  aria-label="Filter by department"
                  options={[
                    { value: 'all', label: 'All Departments' },
                    ...departments.map((dept) => ({ value: dept, label: dept })),
                  ]}
                  className="lg:col-span-1"
                />
              )}

              {cities.length > 0 && (
                <Select
                  value={selectedCity}
                  onChange={(value) => {
                    setSelectedCity(value);
                    setCurrentPage(1);
                  }}
                  label="City"
                  aria-label="Filter by city"
                  options={[
                    { value: 'all', label: 'All Cities' },
                    ...cities.map((city) => ({ value: city, label: city })),
                  ]}
                  className="lg:col-span-1"
                />
              )}
            </div>

            {/* Results Summary and Active Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-base-300">
              <div className="flex items-center gap-2 text-sm text-base-content/70">
                <span>Showing</span>
                <span className="px-2 py-1 bg-primary/10 text-primary rounded-md font-semibold">
                  {paginatedTeachers.length}
                </span>
                <span>of</span>
                <span className="px-2 py-1 bg-base-200 text-base-content/80 rounded-md font-semibold">
                  {teachersResponse?.total || 0}
                </span>
                <span>teachers</span>
              </div>

              {/* Active Filters */}
              <ActiveFilterChips
                filters={[
                  ...(searchQuery
                    ? [{ key: 'search', label: `Search: "${searchQuery}"`, icon: <SearchIcon className="w-3 h-3" />, tone: 'info' } as FilterChip]
                    : []),
                  ...(selectedDepartment !== 'all'
                    ? [{ key: 'dept', label: `Dept: ${selectedDepartment}`, icon: <DocumentIcon className="w-3 h-3" />, tone: 'success' } as FilterChip]
                    : []),
                  ...(selectedCity !== 'all'
                    ? [{ key: 'city', label: `City: ${selectedCity}`, icon: <MapPinIcon className="w-3 h-3" />, tone: 'warning' } as FilterChip]
                    : []),
                ]}
                onClearAll={clearAllFilters}
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Teachers Grid */}
      <SectionErrorBoundary
        resetKey={`${searchQuery}|${selectedDepartment}|${selectedCity}|${currentPage}`}
        title="We couldn't show these teachers"
        message="The institute details above are fine. Try loading the list again."
      >
      <div id="institute-teachers">
      {isLoading && !teachersResponse ? (
        <TeacherListSkeleton count={8} />
      ) : paginatedTeachers.length > 0 ? (
        <div className="space-y-6">
          <ul className="card-grid">
            {paginatedTeachers.map((teacher) => (
              <li key={teacher.id}>
              <div
                role="button"
                tabIndex={0}
                aria-label={`Open ${teacher.name}`}
                className="bg-base-100 rounded-lg shadow-sm border border-base-300 hover:shadow-md transition-all duration-200 cursor-pointer group"
                onClick={() => setSelectedTeacher(teacher)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedTeacher(teacher); } }}
              >
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="relative flex-shrink-0">
                      <AvatarImage
                        src={teacher.avatar_url || undefined}
                        name={teacher.name}
                        size={56}
                        className="border-2 border-base-300"
                      />
                      {(teacher as any).is_verified && (
                        <div className="absolute -bottom-1 -right-1 bg-info text-info-content rounded-full p-0.5">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base text-base-content truncate">
                        {teacher.name}
                      </h3>
                      {teacher.designation && (
                        <p className="text-xs text-base-content/70 truncate">
                          {teacher.designation}
                        </p>
                      )}
                      {(teacher as any).department && (
                        <p className="text-xs text-base-content/70 truncate">
                          {(teacher as any).department}
                        </p>
                      )}
                      
                      <div className="mt-2 flex items-center gap-2">
                        <RatingStars rating={teacher.average_rating || 0} size={14} />
                        <span className="text-sm font-medium text-base-content/80">
                          {teacher.average_rating ? teacher.average_rating.toFixed(1) : 'N/A'}
                        </span>
                        {teacher.ratings_count && teacher.ratings_count > 0 && (
                          <span className="text-xs text-base-content/70">
                            ({teacher.ratings_count})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-3 mt-4">
                    <Link 
                      to={`/teacher/${teacher.id}`}
                      className="flex-1 px-4 py-2 bg-base-200 text-base-content/80 text-center rounded-lg font-medium hover:bg-base-300 transition-colors duration-200 text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View Profile
                    </Link>
                    <Link
                      to={`/teacher/${teacher.id}#rate`}
                      className={buttonClasses({ variant: 'primary', size: 'sm', className: 'flex-1' })}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Rate Teacher
                    </Link>
                  </div>
                </div>
              </div>
              </li>
            ))}
          </ul>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="bg-base-100 rounded-lg shadow-sm border border-base-300">
          <EmptyState
            title="No teachers found"
            description="Try adjusting your search filters or check back later."
            action={
              (searchQuery || selectedDepartment !== 'all' || selectedCity !== 'all') ? (
                <Button variant="primary" onClick={clearAllFilters}>
                  Clear all filters
                </Button>
              ) : undefined
            }
          />
        </div>
      )}
      </div>
      </SectionErrorBoundary>

      {/* Teacher Modal */}
      {selectedTeacher && (
        <TeacherModal
          teacher={selectedTeacher}
          isOpen={!!selectedTeacher}
          onClose={() => setSelectedTeacher(null)}
        />
      )}
    </div>
  );
}