import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTeachers } from '../hooks/useTeachers';
import { RatingStars } from '../components/RatingStars';
import { AvatarImage } from '../components/AvatarImage';
import { TeacherModal } from '../components/TeacherModal';
import { Pagination } from '../components/Pagination';
import { Button, buttonClasses } from '../components/Button';
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
  
  // Use the useTeachers hook with institute filter and debounced search
  const { data: teachersResponse, isLoading, error } = useTeachers({
    institute: instituteName,
    search: debouncedSearchQuery,
    department: selectedDepartment !== 'all' ? selectedDepartment : undefined,
    city: selectedCity !== 'all' ? selectedCity : undefined,
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
  
  // Extract unique departments from all teachers
  const departments = useMemo(() => {
    if (!allTeachersResponse?.data) return [];
    const deptSet = new Set<string>();
    allTeachersResponse.data.forEach(teacher => {
      if (teacher.department) {
        deptSet.add(teacher.department);
      }
    });
    return Array.from(deptSet).sort();
  }, [allTeachersResponse]);

  // Extract unique cities from all teachers
  const cities = useMemo(() => {
    if (!allTeachersResponse?.data) return [];
    const citySet = new Set<string>();
    allTeachersResponse.data.forEach(teacher => {
      if (teacher.city) {
        citySet.add(teacher.city);
      }
    });
    return Array.from(citySet).sort();
  }, [allTeachersResponse]);

  const instituteStats = useMemo(() => {
    if (!allTeachersResponse?.data) return null;

    const allTeachers = allTeachersResponse.data;
    const totalTeachers = allTeachers.length;
    const teachersWithRatings = allTeachers.filter(t => t.average_rating && t.average_rating > 0);
    const totalRatings = allTeachers.reduce((sum, t) => sum + (t.ratings_count || 0), 0);
    // Review-weighted mean (each review counts equally), not an average of averages.
    const ratingWeight = teachersWithRatings.reduce((sum, t) => sum + (t.ratings_count || 0), 0);
    const avgInstitute = ratingWeight > 0
      ? teachersWithRatings.reduce((sum, t) => sum + (t.average_rating || 0) * (t.ratings_count || 0), 0) / ratingWeight
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
        <div className="alert alert-error">
          <span>Failed to load teachers. Please try again later.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-wide mx-auto space-y-6">
      <Helmet>
        <title>{instituteName} - Teacher Rank</title>
        <meta name="description" content={`Browse and rate teachers at ${instituteName}. Find the best educators through student reviews.`} />
      </Helmet>

      {/* Institute Header */}
      <div className="relative overflow-hidden bg-primary text-primary-content rounded-lg shadow-sm">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative p-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h1 className="text-4xl font-bold mb-4 flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-12 h-12 bg-white/20 rounded-lg backdrop-blur-sm">
                  <svg className="w-6 h-6 text-primary-content" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"/></svg>
                </span>
                {instituteName}
              </h1>
              
              <p className="text-primary-content/90 text-lg mb-4">
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
                  <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-md text-sm font-medium">
                     {instituteStats.totalTeachers} Teachers
                  </div>
                  <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-md text-sm font-medium">
                     {instituteStats.totalRatings} Reviews
                  </div>
                  {instituteStats.avgInstitute > 0 && (
                    <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-md text-sm font-medium">
                       {instituteStats.avgInstitute.toFixed(1)} Avg Rating
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
                ← Back to All Teachers
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
                  className="bg-primary-content text-primary hover:bg-base-200 px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                >
                  View {instituteName} Teachers ({instituteStats.totalTeachers})
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Institute Statistics */}
      {instituteStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-base-100 rounded-lg p-6 text-center shadow-sm border border-base-300">
            <div className="text-3xl font-bold text-info mb-2">
              {instituteStats.totalTeachers}
            </div>
            <div className="text-sm text-base-content/70">
              Total Teachers
            </div>
          </div>
          
          <div className="bg-base-100 rounded-lg p-6 text-center shadow-sm border border-base-300">
            <div className="text-3xl font-bold text-primary mb-2">
              {instituteStats.totalRatings}
            </div>
            <div className="text-sm text-base-content/70">
              Total Reviews
            </div>
          </div>
          
          <div className="bg-base-100 rounded-lg p-6 text-center shadow-sm border border-base-300">
            <div className="text-3xl font-bold text-warning mb-2">
              {instituteStats.avgInstitute > 0 ? instituteStats.avgInstitute.toFixed(1) : '—'}
            </div>
            <div className="text-sm text-base-content/70">
              Avg Rating
            </div>
          </div>
          
          <div className="bg-base-100 rounded-lg p-6 text-center shadow-sm border border-base-300">
            <div className="text-3xl font-bold text-success mb-2">
              {instituteStats.topRated}
            </div>
            <div className="text-sm text-base-content/70">
              Top Rated (4.5+)
            </div>
          </div>
        </div>
      )}
      
      {/* Search and Filter Section */}
      {(allTeachersResponse?.total || 0) > 0 && (
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
                <h3 className="text-lg font-semibold text-base-content">Filter Teachers</h3>
                <p className="text-sm text-base-content/70">Search and filter teachers by name, department, or city</p>
              </div>
            </div>

            {/* Filter Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Search Input */}
              <div className="lg:col-span-1">
                <label className="block text-sm font-medium text-base-content/80 mb-2">
                  Search Teachers
                </label>
                <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name, bio, or designation..."
                  value={searchQuery}
                  onChange={handleSearchChange}
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
                    onClick={clearSearch}
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

              {/* Department Filter */}
              {departments.length > 0 && (
                <div className="lg:col-span-1">
                  <label className="block text-sm font-medium text-base-content/80 mb-2">
                    Department
                  </label>
                  <div className="relative">
                    <select
                      value={selectedDepartment}
                      onChange={(e) => {
                        setSelectedDepartment(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full px-4 py-3 bg-base-100 text-base-content border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none"
                    >
                      <option value="all">All Departments</option>
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                    <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              )}

              {/* City Filter */}
              {cities.length > 0 && (
                <div className="lg:col-span-1">
                  <label className="block text-sm font-medium text-base-content/80 mb-2">
                    City
                  </label>
                  <div className="relative">
                    <select
                      value={selectedCity}
                      onChange={(e) => {
                        setSelectedCity(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full px-4 py-3 bg-base-100 text-base-content border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none"
                    >
                      <option value="all">All Cities</option>
                      {cities.map(city => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                    <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-base-content/40 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
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
              {(searchQuery || selectedDepartment !== 'all' || selectedCity !== 'all') && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-base-content/70">Active filters:</span>
                  {searchQuery && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-info/10 text-info rounded-md text-xs">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Search: "{searchQuery}"
                    </span>
                  )}
                  {selectedDepartment !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-success/10 text-success rounded-md text-xs">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      Dept: {selectedDepartment}
                    </span>
                  )}
                  {selectedCity !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-warning/10 text-warning rounded-md text-xs">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      City: {selectedCity}
                    </span>
                  )}
                  <button
                    onClick={clearAllFilters}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-error/10 text-error hover:bg-error/20 rounded-md text-xs font-medium transition-colors duration-200"
                    aria-label="Clear all filters"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear All
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Teachers Grid */}
      <div id="institute-teachers">
      {isLoading && !teachersResponse ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="loading loading-spinner loading-lg text-primary"></div>
            <p className="mt-4 text-base-content/70">Loading teachers...</p>
          </div>
        </div>
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
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="bg-base-100 rounded-lg shadow-sm border border-base-300 p-12">
          <div className="text-center">
            <h3 className="text-xl font-bold text-base-content/70 mb-2">
              No Teachers Found
            </h3>
            <p className="text-base-content/70">
              Try adjusting your search filters or check back later!
            </p>
            {(searchQuery || selectedDepartment !== 'all' || selectedCity !== 'all') && (
              <Button
                variant="primary"
                onClick={clearAllFilters}
                className="mt-4"
              >
                Clear All Filters
              </Button>
            )}
          </div>
        </div>
      )}
      </div>

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