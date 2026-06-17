import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useInstitutesOptimized } from '../hooks/useInstitutesOptimized';
import { RatingStars } from '../components/RatingStars';
import { Button, buttonClasses } from '../components/Button';
import { logger } from '../lib/logger';

export default function InstitutesPageOptimized() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'teachers_desc' | 'rating_desc' | 'name_asc'>('teachers_desc');

  const { data: institutes, isLoading, error, refetch } = useInstitutesOptimized();

  // Debug logging
  useEffect(() => {
    logger.info('InstitutesPageOptimized mounted', {
      institutes: institutes?.length,
      isLoading,
      hasError: !!error
    });

    if (error) {
      logger.error('Optimized institutes query error', error);
    }
  }, [institutes, isLoading, error]);

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
          <div className="bg-base-100 rounded-lg shadow-sm border border-base-300 p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-error/10 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-base-content mb-2">
              Failed to Load Institutes
            </h3>
            <p className="text-base-content/70 mb-4">
              {error.message || 'There was an error loading the institutes.'}
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="error"
                onClick={() => refetch()}
              >
                Try Again
              </Button>
              <Link
                to="/teachers"
                className={buttonClasses({ variant: 'neutral' })}
              >
                Browse Teachers
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-wide mx-auto space-y-6">
      <Helmet>
        <title>All Institutes - Teacher Rank</title>
        <meta name="description" content="Explore all educational institutes and discover the best teachers across various universities and colleges." />
      </Helmet>

      {/* Header */}
      <div className="relative overflow-hidden bg-primary text-primary-content rounded-lg shadow-sm">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative p-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h1 className="text-4xl font-bold mb-4 flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-12 h-12 bg-white/20 rounded-lg backdrop-blur-sm">
                  <svg className="w-6 h-6 text-primary-content" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/></svg>
                </span>
                All Institutes
              </h1>

              <p className="text-primary-content/90 text-lg mb-4">
                {isLoading ? (
                  <span className="opacity-70">Loading institutes...</span>
                ) : (
                  overallStats ? (
                    <>
                      Discover {overallStats.totalTeachers} teachers across {overallStats.totalInstitutes} institutes.
                      {overallStats.avgRating > 0 && (
                        <> Average rating of {overallStats.avgRating.toFixed(1)} stars.</>
                      )}
                    </>
                  ) : (
                    <span className="opacity-70">No institutes found.</span>
                  )
                )}
              </p>

              {/* Stats Pills */}
              {overallStats && (
                <div className="flex flex-wrap gap-3">
                  <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-md text-sm font-medium">
                     {overallStats.totalInstitutes} Institutes
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-md text-sm font-medium">
                     {overallStats.totalTeachers} Teachers
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-md text-sm font-medium">
                     {overallStats.totalRatings} Reviews
                  </div>
                  {overallStats.avgRating > 0 && (
                    <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-md text-sm font-medium">
                       {overallStats.avgRating.toFixed(1)} Avg Rating
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-3">
              <Link
                to="/teachers"
                className="bg-white/20 backdrop-blur-sm text-primary-content hover:bg-white/30 px-4 py-2 rounded-lg font-medium transition-all duration-200 border border-white/30"
              >
                Browse All Teachers
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Section */}
      {institutes && institutes.length > 0 && (
        <div className="bg-base-100 rounded-lg p-6 shadow-sm border border-base-300">
          <div className="space-y-6">
            {/* Filter Header */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-lg">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-base-content">Search & Sort Institutes</h3>
                <p className="text-sm text-base-content/70">Find institutes by name or sort by various criteria</p>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Search Input */}
              <div>
                <label className="block text-sm font-medium text-base-content/80 mb-2">
                  Search Institutes
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search institute names..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 pl-12 pr-10 bg-base-100 text-base-content border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <svg
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-base-content/40"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-base-300 rounded transition-colors"
                      aria-label="Clear search"
                    >
                      <svg className="w-4 h-4 text-base-content/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Sort Options */}
              <div>
                <label className="block text-sm font-medium text-base-content/80 mb-2">
                  Sort By
                </label>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-4 py-3 bg-base-100 text-base-content border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none"
                  >
                    <option value="teachers_desc">Most Teachers</option>
                    <option value="rating_desc">Highest Rated</option>
                    <option value="name_asc">Name (A-Z)</option>
                  </select>
                  <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
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
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="loading loading-spinner loading-lg text-primary"></div>
            <p className="mt-4 text-base-content/70">Loading institutes...</p>
          </div>
        </div>
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
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    <span>{institute.top_rated_count} top rated</span>
                  </div>
                  <div className="text-primary font-medium group-hover:text-primary transition-colors">
                    View Details →
                  </div>
                </div>
              </div>
            </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="bg-base-100 rounded-lg shadow-sm border border-base-300 p-12">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-base-200 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-base-content/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H7m2 0v-5a2 2 0 012-2h2a2 2 0 012 2v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-base-content/70 mb-2">
              No Institutes Found
            </h3>
            <p className="text-base-content/70">
              {searchQuery ? 'Try adjusting your search terms.' : 'No institutes are available at the moment.'}
            </p>
            {searchQuery && (
              <Button
                variant="primary"
                onClick={() => setSearchQuery('')}
                className="mt-4"
              >
                Clear Search
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}