import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useInstitutesOptimized } from '../hooks/useInstitutesOptimized';
import { RatingStars } from '../components/RatingStars';
import { Button, buttonClasses } from '../components/Button';
import { PageHero } from '../components/PageHero';
import { SearchInput } from '../components/SearchInput';
import { Select } from '../components/Select';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { SectionHeading } from '../components/SectionHeading';
import { InstituteListSkeleton } from '../components/Skeleton';
import { BuildingIcon, StarIcon, ArrowRightIcon } from '../components/icons';

export default function InstitutesPageOptimized() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'teachers_desc' | 'rating_desc' | 'name_asc'>('teachers_desc');

  const { data: institutes, isLoading, error, refetch } = useInstitutesOptimized();

  // Filter and sort institutes
  const filteredAndSortedInstitutes = useMemo(() => {
    if (!institutes) return [];

    // Filter by search query
    let filtered = institutes.filter(institute =>
      institute.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort based on selected option
    switch (sortBy) {
      case 'teachers_desc':
        filtered.sort((a, b) => b.total_teachers - a.total_teachers);
        break;
      case 'rating_desc':
        filtered.sort((a, b) => b.avg_rating - a.avg_rating);
        break;
      case 'name_asc':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return filtered;
  }, [institutes, searchQuery, sortBy]);

  // Calculate overall statistics
  const overallStats = useMemo(() => {
    if (!institutes || institutes.length === 0) return null;

    const totalInstitutes = institutes.length;
    const totalTeachers = institutes.reduce((sum, inst) => sum + inst.total_teachers, 0);
    const totalRatings = institutes.reduce((sum, inst) => sum + inst.total_ratings, 0);
    const institutesWithRatings = institutes.filter(inst => inst.avg_rating > 0);
    const avgRating = institutesWithRatings.length > 0
      ? institutesWithRatings.reduce((sum, inst) => sum + inst.avg_rating, 0) / institutesWithRatings.length
      : 0;

    return {
      totalInstitutes,
      totalTeachers,
      totalRatings,
      avgRating,
    };
  }, [institutes]);

  if (error) {
    return (
      <div className="min-h-dvh p-6 flex items-center justify-center">
        <div className="max-w-md w-full">
          <ErrorState
            title="Couldn't load institutes"
            message="Something went wrong on our end. Try again in a moment."
            onRetry={() => refetch()}
            secondaryAction={
              <Link to="/teachers" className={buttonClasses({ variant: 'neutral' })}>
                Browse Teachers
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-wide mx-auto space-y-6">
      <Helmet>
        <title>All Institutes</title>
        <meta name="description" content="Explore all educational institutes and discover the best teachers across various universities and colleges." />
      </Helmet>

      {/* Header */}
      <PageHero
        icon={<BuildingIcon className="w-6 h-6 text-primary-content" />}
        title="All Institutes"
        description={
          isLoading ? (
            <span className="opacity-70">Loading institutes...</span>
          ) : overallStats ? (
            <>
              Discover {overallStats.totalTeachers} teachers across {overallStats.totalInstitutes} institutes.
              {overallStats.avgRating > 0 && (
                <> Average rating of {overallStats.avgRating.toFixed(1)} stars.</>
              )}
            </>
          ) : (
            <span className="opacity-70">No institutes found.</span>
          )
        }
        stats={
          overallStats
            ? [
                { value: overallStats.totalInstitutes, label: 'Institutes' },
                { value: overallStats.totalTeachers, label: 'Teachers' },
                { value: overallStats.totalRatings, label: 'Reviews' },
                ...(overallStats.avgRating > 0
                  ? [{ value: overallStats.avgRating.toFixed(1), label: 'Avg Rating' }]
                  : []),
              ]
            : undefined
        }
        actions={
          <Link
            to="/teachers"
            className="bg-primary-content/15 backdrop-blur-sm text-primary-content hover:bg-primary-content/25 px-4 py-2 rounded-lg font-medium transition-all duration-200 border border-primary-content/30"
          >
            Browse All Teachers
          </Link>
        }
      />

      {/* Search and Filter Section */}
      {institutes && institutes.length > 0 && (
        <div className="bg-base-100 rounded-lg p-6 shadow-sm border border-base-300">
          <div className="space-y-6">
            {/* Filter Header */}
            <SectionHeading as="h2">Search &amp; Sort Institutes</SectionHeading>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                label="Search Institutes"
                aria-label="Search institutes"
                placeholder="Search institute names..."
              />

              <Select
                value={sortBy}
                onChange={(value) => setSortBy(value as typeof sortBy)}
                label="Sort By"
                aria-label="Sort institutes"
                options={[
                  { value: 'teachers_desc', label: 'Most Teachers' },
                  { value: 'rating_desc', label: 'Highest Rated' },
                  { value: 'name_asc', label: 'Name (A-Z)' },
                ]}
              />
            </div>

            {/* Results Summary */}
            <div className="flex items-center gap-2 pt-4 border-t border-base-300 text-sm text-base-content/70">
              <span>Showing</span>
              <span className="px-2 py-1 bg-primary/10 text-primary rounded-md font-semibold">
                {filteredAndSortedInstitutes.length}
              </span>
              <span>of</span>
              <span className="px-2 py-1 bg-base-200 text-base-content/80 rounded-md font-semibold">
                {institutes?.length || 0}
              </span>
              <span>institutes</span>
            </div>
          </div>
        </div>
      )}

      {/* Institutes Grid */}
      {isLoading ? (
        <InstituteListSkeleton count={8} />
      ) : filteredAndSortedInstitutes.length > 0 ? (
        <ul className="card-grid">
          {filteredAndSortedInstitutes.map((institute) => (
            <li key={institute.name}>
            <Link
              to={`/institute/${encodeURIComponent(institute.name)}`}
              className="block bg-base-100 rounded-lg shadow-sm border border-base-300 hover:shadow-lg hover:border-primary/30 transition-all duration-200 group"
            >
              <div className="p-6">
                {/* Institute Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-primary-content font-bold text-lg">
                    {institute.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg text-base-content group-hover:text-primary transition-colors line-clamp-2">
                      {institute.name}
                    </h3>
                    <div className="mt-2 flex items-center gap-2">
                      {institute.avg_rating > 0 ? (
                        <>
                          <RatingStars rating={institute.avg_rating} size={14} />
                          <span className="text-sm font-medium text-base-content/80">
                            {institute.avg_rating.toFixed(1)}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-base-content/70">No ratings yet</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="text-center p-3 bg-base-200 rounded-lg">
                    <div className="text-xl font-bold text-primary">
                      {institute.total_teachers}
                    </div>
                    <div className="text-xs text-base-content/70">Teachers</div>
                  </div>
                  <div className="text-center p-3 bg-base-200 rounded-lg">
                    <div className="text-xl font-bold text-primary">
                      {institute.total_ratings}
                    </div>
                    <div className="text-xs text-base-content/70">Reviews</div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-base-content/70">
                    <StarIcon className="w-4 h-4" />
                    <span>{institute.top_rated_count} top rated</span>
                  </div>
                  <div className="inline-flex items-center gap-1 text-primary font-medium">
                    View Details
                    <ArrowRightIcon className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </div>
                </div>
              </div>
            </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="bg-base-100 rounded-lg shadow-sm border border-base-300">
          <EmptyState
            icon={<BuildingIcon className="w-8 h-8" />}
            title="No institutes found"
            description={
              searchQuery ? 'Try adjusting your search terms.' : 'No institutes are available at the moment.'
            }
            action={
              searchQuery ? (
                <Button variant="primary" onClick={() => setSearchQuery('')}>
                  Clear search
                </Button>
              ) : undefined
            }
          />
        </div>
      )}
    </div>
  );
}