import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTeachers } from '../hooks/useTeachers';
import { RatingStars } from '../components/RatingStars';
import { AvatarImage } from '../components/AvatarImage';
import { TeacherModal } from '../components/TeacherModal';
import { Pagination } from '../components/Pagination';
import type { TeacherWithStats } from '../types';

export default function InstitutePage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const instituteName = decodeURIComponent(name || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherWithStats | null>(null);
  
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
  
  // Use the useTeachers hook with institute filter and debounced search
  const { data: teachersResponse, isLoading, error } = useTeachers({
    institute: instituteName,
    search: debouncedSearchQuery,
    page: currentPage,
    pageSize: 12
  });
  
  const instituteTeachers = teachersResponse?.data || [];
  const totalPages = teachersResponse?.totalPages || 1;
  
  // Teachers are already filtered and paginated by the hook
  const paginatedTeachers = instituteTeachers;
  
  // Calculate institute statistics - using all teachers (not filtered by search)
  const { data: allTeachersResponse } = useTeachers({
    institute: instituteName,
    search: '', // Get all teachers for stats
    page: 1,
    pageSize: 1000 // Get all for stats
  });
  
  const instituteStats = useMemo(() => {
    if (!allTeachersResponse?.data) return null;
    
    const allTeachers = allTeachersResponse.data;
    const totalTeachers = allTeachers.length;
    const teachersWithRatings = allTeachers.filter(t => t.average_rating && t.average_rating > 0);
    const totalRatings = allTeachers.reduce((sum, t) => sum + (t.ratings_count || 0), 0);
    const avgInstitute = teachersWithRatings.length > 0 
      ? teachersWithRatings.reduce((sum, t) => sum + (t.average_rating || 0), 0) / teachersWithRatings.length
      : 0;
    const topRated = allTeachers.filter(t => (t.average_rating || 0) >= 4.5).length;
    
    return {
      totalTeachers,
      totalRatings,
      avgInstitute,
      topRated,
      teachersWithRatings: teachersWithRatings.length
    };
  }, [allTeachersResponse]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setCurrentPage(1);
  }, []);

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="alert alert-error dark:bg-red-900 dark:border-red-700 dark:text-red-100">
          <span>Failed to load teachers. Please try again later.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <Helmet>
        <title>{instituteName} - Teacher Rank</title>
        <meta name="description" content={`Browse and rate teachers at ${instituteName}. Find the best educators through student reviews.`} />
      </Helmet>

      {/* Institute Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl shadow-xl">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative p-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h1 className="text-4xl font-bold mb-4 flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-12 h-12 bg-white/20 rounded-xl backdrop-blur-sm">
                  🏫
                </span>
                {instituteName}
              </h1>
              
              <p className="text-white/90 text-lg mb-4">
                {isLoading ? (
                  <span className="opacity-70">Loading institute information...</span>
                ) : (
                  instituteStats ? (
                    <>
                      Explore {instituteStats.totalTeachers} exceptional educators at {instituteName}.
                      {instituteStats.teachersWithRatings > 0 && (
                        <> With an average rating of {instituteStats.avgInstitute.toFixed(1)} stars.</>
                      )}
                    </>
                  ) : (
                    <span className="opacity-70">No teachers found at this institute.</span>
                  )
                )}
              </p>
              
              {/* Stats Pills */}
              {instituteStats && (
                <div className="flex flex-wrap gap-3">
                  <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
                    📚 {instituteStats.totalTeachers} Teachers
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
                    ⭐ {instituteStats.totalRatings} Reviews
                  </div>
                  {instituteStats.avgInstitute > 0 && (
                    <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
                      ✨ {instituteStats.avgInstitute.toFixed(1)} Avg Rating
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
                ← All Teachers
              </Link>
              {instituteStats && instituteStats.totalTeachers > 0 && (
                <button 
                  onClick={() => navigate(`/teachers?institute=${encodeURIComponent(instituteName)}`))
                  className="bg-white text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                >
                  View All Teachers
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Institute Statistics */}
      {instituteStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
              {instituteStats.totalTeachers}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Teachers
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
              {instituteStats.totalRatings}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Reviews
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">
              {instituteStats.avgInstitute > 0 ? instituteStats.avgInstitute.toFixed(1) : '—'}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Avg Rating
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
              {instituteStats.topRated}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Top Rated (4.5+)
            </div>
          </div>
        </div>
      )}
      
      {/* Search and Filter Section */}
      {(allTeachersResponse?.total || 0) > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex-1 w-full sm:max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search teachers at this institute..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="w-full px-4 py-3 pl-12 pr-10 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:text-white"
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
                    onClick={clearSearch}
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
            
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <span>Showing</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {paginatedTeachers.length}
                </span>
                <span>of</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {teachersResponse?.total || 0}
                </span>
                <span>teachers</span>
                {searchQuery && (
                  <span className="text-purple-600 dark:text-purple-400">
                    (filtered)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Teachers Grid */}
      {isLoading && !teachersResponse ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="loading loading-spinner loading-lg text-purple-600"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading teachers...</p>
          </div>
        </div>
      ) : paginatedTeachers.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedTeachers.map((teacher) => (
              <div 
                key={teacher.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 cursor-pointer group"
                onClick={() => setSelectedTeacher(teacher)}
              >
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="relative flex-shrink-0">
                      <AvatarImage
                        src={teacher.avatar_url || undefined}
                        name={teacher.name}
                        size={56}
                        className="border-2 border-gray-200 dark:border-gray-700"
                      />
                      {(teacher as any).is_verified && (
                        <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white rounded-full p-0.5">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base text-gray-900 dark:text-white truncate">
                        {teacher.name}
                      </h3>
                      {teacher.designation && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                          {teacher.designation}
                        </p>
                      )}
                      {(teacher as any).department && (
                        <p className="text-xs text-gray-500 dark:text-gray-500 truncate">
                          {(teacher as any).department}
                        </p>
                      )}
                      
                      <div className="mt-2 flex items-center gap-2">
                        <RatingStars rating={teacher.average_rating || 0} size={14} />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {teacher.average_rating ? teacher.average_rating.toFixed(1) : 'N/A'}
                        </span>
                        {teacher.ratings_count && teacher.ratings_count > 0 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
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
                      className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-center rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View Profile
                    </Link>
                    <Link 
                      to={`/teacher/${teacher.id}#rate`}
                      className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-center rounded-lg font-medium transition-colors duration-200 text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Rate Teacher
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              {searchQuery ? 'No teachers found' : 'No teachers at this institute'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {searchQuery 
                ? `No teachers match your search "${searchQuery}"`
                : `We couldn't find any teachers at ${instituteName}.`}
            </p>
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors duration-200"
              >
                Clear Search
              </button>
            )}
          </div>
        </div>
      )}

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