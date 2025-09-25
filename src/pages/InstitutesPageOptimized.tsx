import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useInstitutesOptimized } from '../hooks/useInstitutesOptimized';
import { RatingStars } from '../components/RatingStars';
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
      <div className="min-h-screen p-6 flex items-center justify-center">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Failed to Load Institutes
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {error.message || 'There was an error loading the institutes.'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors duration-200"
              >
                Try Again
              </button>
              <Link
                to="/teachers"
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors duration-200"
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
    <div className="min-h-screen p-6 space-y-6">
      <Helmet>
        <title>All Institutes - Teacher Rank</title>
        <meta name="description" content="Explore all educational institutes and discover the best teachers across various universities and colleges." />
      </Helmet>

      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl shadow-xl">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative p-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h1 className="text-4xl font-bold mb-4 flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-12 h-12 bg-white/20 rounded-xl backdrop-blur-sm">
                  🏛️
                </span>
                All Institutes
              </h1>

              <p className="text-white/90 text-lg mb-4">
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
                  <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
                     {overallStats.totalInstitutes} Institutes
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
                     {overallStats.totalTeachers} Teachers
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
                     {overallStats.totalRatings} Reviews
                  </div>
                  {overallStats.avgRating > 0 && (
                    <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
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
                className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 px-4 py-2 rounded-lg font-medium transition-all duration-200 border border-white/30"
              >
                Browse All Teachers
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Section */}
      {institutes && institutes.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="space-y-6">
            {/* Filter Header */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Search & Sort Institutes</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Find institutes by name or sort by various criteria</p>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Search Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search Institutes
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search institute names..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 pl-12 pr-10 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white"
                  />
                  <svg
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      aria-label="Clear search"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Sort Options */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sort By
                </label>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:text-white appearance-none"
                  >
                    <option value="teachers_desc">Most Teachers</option>
                    <option value="rating_desc">Highest Rated</option>
                    <option value="name_asc">Name (A-Z)</option>
                  </select>
                  <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Results Summary */}
            <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
              <span>Showing</span>
              <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-md font-semibold">
                {filteredAndSortedInstitutes.length}
              </span>
              <span>of</span>
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md font-semibold">
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
            <div className="loading loading-spinner loading-lg text-indigo-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading institutes...</p>
          </div>
        </div>
      ) : filteredAndSortedInstitutes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedInstitutes.map((institute) => (
            <Link
              key={institute.name}
              to={`/institute/${encodeURIComponent(institute.name)}`}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-700 transition-all duration-200 group"
            >
              <div className="p-6">
                {/* Institute Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                    {institute.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                      {institute.name}
                    </h3>
                    <div className="mt-2 flex items-center gap-2">
                      {institute.avg_rating > 0 ? (
                        <>
                          <RatingStars rating={institute.avg_rating} size={14} />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {institute.avg_rating.toFixed(1)}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">No ratings yet</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
                      {institute.total_teachers}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Teachers</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                      {institute.total_ratings}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Reviews</div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    <span>{institute.top_rated_count} top rated</span>
                  </div>
                  <div className="text-indigo-600 dark:text-indigo-400 font-medium group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                    View Details →
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H7m2 0v-5a2 2 0 012-2h2a2 2 0 012 2v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-600 dark:text-gray-400 mb-2">
              No Institutes Found
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery ? 'Try adjusting your search terms.' : 'No institutes are available at the moment.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors duration-200"
              >
                Clear Search
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}