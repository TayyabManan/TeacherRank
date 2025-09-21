import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTeachersOptimized, usePrefetchTeacher, useInstitutes } from '../hooks/useTeachersOptimized';
import { Pagination } from './Pagination';
import { TeacherListSkeleton } from './Skeleton';
import { TeacherModal } from './TeacherModal';
import { RatingStars } from './RatingStars';
import { AvatarImage } from './OptimizedImage';
import type { TeacherWithStats } from '../types';

const clamp = (v: number, min = 0, max = 5) => Math.max(min, Math.min(max, v));

// Memoized ranking badge component
const RankingBadge = React.memo<{ position: number; className?: string }>(({ position, className = '' }) => {
  const getBadgeProps = useCallback((pos: number) => {
    switch (pos) {
      case 1:
        return {
          emoji: '🏆',
          color: 'bg-gradient-to-br from-yellow-400 to-yellow-600',
          text: 'text-white',
          shadow: 'shadow-yellow-500/50',
          glow: 'animate-pulse'
        };
      case 2:
        return {
          emoji: '🥈',
          color: 'bg-gradient-to-br from-gray-300 to-gray-500',
          text: 'text-white',
          shadow: 'shadow-gray-500/50',
          glow: ''
        };
      case 3:
        return {
          emoji: '🥉',
          color: 'bg-gradient-to-br from-orange-400 to-orange-600',
          text: 'text-white',
          shadow: 'shadow-orange-500/50',
          glow: ''
        };
      default:
        return {
          emoji: '⭐',
          color: 'bg-gradient-to-br from-purple-500 to-pink-500',
          text: 'text-white',
          shadow: 'shadow-purple-500/50',
          glow: ''
        };
    }
  }, []);

  const { emoji, color, text, shadow, glow } = getBadgeProps(position);

  return (
    <div className={`absolute -top-2 -right-2 ${color} ${text} ${shadow} ${glow} rounded-full w-10 h-10 flex items-center justify-center text-lg font-bold shadow-lg border-2 border-white ${className}`}>
      <span className="text-sm">{position <= 3 ? emoji : `#${position}`}</span>
    </div>
  );
});

RankingBadge.displayName = 'RankingBadge';

// Memoized achievement badges component
const AchievementBadges = React.memo<{ teacher: TeacherWithStats }>(({ teacher }) => {
  const badges = useMemo(() => {
    const result = [];
    
    if ((teacher.average_rating ?? 0) >= 4.5) {
      result.push({ emoji: '💎', tooltip: 'Diamond Rating' });
    }
    if ((teacher.ratings_count ?? 0) >= 50) {
      result.push({ emoji: '🔥', tooltip: 'Popular Teacher' });
    }
    if ((teacher.average_rating ?? 0) >= 4.0) {
      result.push({ emoji: '👑', tooltip: 'Highly Rated' });
    }
    if ((teacher.ratings_count ?? 0) >= 100) {
      result.push({ emoji: '💯', tooltip: 'Century Club' });
    }
    
    return result;
  }, [teacher.average_rating, teacher.ratings_count]);

  if (badges.length === 0) return null;

  return (
    <div className="flex gap-1 mt-2">
      {badges.map((badge, index) => (
        <div
          key={index}
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
});

AchievementBadges.displayName = 'AchievementBadges';

// Memoized teacher card component
const TeacherCard = React.memo<{
  teacher: TeacherWithStats & { rank: number };
  onModalOpen: (teacher: TeacherWithStats) => void;
  onPrefetch: (id: string) => void;
  onNavigate: (path: string) => void;
}>(({ teacher, onModalOpen, onPrefetch, onNavigate }) => {
  const handleViewProfile = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate(`/teacher/${teacher.id}`);
  }, [teacher.id, onNavigate]);

  const handleRateNow = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate(`/teacher/${teacher.id}#rate`);
  }, [teacher.id, onNavigate]);

  return (
    <article
      className="group relative bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-purple-500/10 transition-all duration-200 cursor-pointer"
      onClick={() => onModalOpen(teacher)}
      onMouseEnter={() => onPrefetch(teacher.id)}
    >
      {/* Ranking Badge */}
      <RankingBadge position={teacher.rank} />

      {/* Teacher Avatar and Info */}
      <div className="flex items-start gap-4 mb-4">
        <div className="relative">
          <AvatarImage
            src={teacher.avatar_url || undefined}
            name={teacher.name}
            size={64}
            className="border-2 border-gray-200 dark:border-gray-700"
          />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1 truncate">
            {teacher.name}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
            {teacher.institute}
          </p>
          
          {/* Rating Section */}
          <div className="flex items-center gap-3 mb-2">
            <RatingStars rating={clamp(teacher.average_rating ?? 0)} size={16} />
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {teacher.average_rating ? teacher.average_rating.toFixed(1) : 'NEW'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {(teacher.ratings_count ?? 0) > 0 ? `${teacher.ratings_count} reviews` : 'No reviews yet'}
            </div>
          </div>

          {/* Achievement Badges */}
          <AchievementBadges teacher={teacher} />
        </div>
      </div>

      {/* Bio Preview */}
      <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 line-clamp-2 leading-relaxed">
        {teacher.bio || 'This teacher hasn\'t added a bio yet. Be the first to rate them!'}
      </p>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
          onClick={handleViewProfile}
          aria-label={`View ${teacher.name}'s profile`}
        >
          View Profile
        </button>
        <button
          className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors duration-200"
          onClick={handleRateNow}
          aria-label={`Rate ${teacher.name}`}
        >
          Rate Now
        </button>
      </div>
    </article>
  );
});

TeacherCard.displayName = 'TeacherCard';

export default function TeacherListing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'rating_desc' | 'rating_asc' | 'institute_az' | 'name_az'>('rating_desc');
  const [selectedInstitute, setSelectedInstitute] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherWithStats | null>(null);
  
  // Read sort parameter from URL on mount
  useEffect(() => {
    const sortParam = searchParams.get('sort');
    if (sortParam === 'rating' || sortParam === 'rating_desc') {
      setSort('rating_desc');
    } else if (sortParam === 'rating_asc') {
      setSort('rating_asc');
    } else if (sortParam === 'name') {
      setSort('name_az');
    } else if (sortParam === 'institute') {
      setSort('institute_az');
    }
  }, [searchParams]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const navigate = useNavigate();
  const prefetchTeacher = usePrefetchTeacher();
  
  const { data, isLoading, error } = useTeachersOptimized({
    search,
    institute: selectedInstitute,
    sortBy: sort,
    page,
    pageSize: 12,
  });

  const { data: institutes } = useInstitutes();

  const rankedTeachers = useMemo(() => {
    if (!data?.data || data.data.length === 0) return [];
    const sorted = [...data.data].sort((a, b) => 
      (b.average_rating ?? 0) - (a.average_rating ?? 0) || 
      (b.ratings_count ?? 0) - (a.ratings_count ?? 0) || 
      a.name.localeCompare(b.name)
    );
    return sorted.map((teacher, index) => ({
      ...teacher,
      rank: index + 1
    }));
  }, [data]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleInstituteChange = useCallback((value: string) => {
    setSelectedInstitute(value);
    setPage(1);
  }, []);

  const handleSortChange = useCallback((value: 'rating_desc' | 'rating_asc' | 'institute_az' | 'name_az') => {
    setSort(value);
    setPage(1);
  }, []);

  const openTeacherModal = useCallback((teacher: TeacherWithStats) => {
    setSelectedTeacher(teacher);
    setIsModalOpen(true);
  }, []);

  const closeTeacherModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedTeacher(null);
  }, []);

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Teacher Rankings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Discover and rate teachers based on student reviews and feedback.
        </p>
      </div>

      {/* Search and Filter Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row gap-4 items-center">
          {/* Search */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search teachers or institutes..."
              className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              aria-label="Search teachers"
            />
          </div>
          
          {/* Sort */}
          <select
            className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 text-gray-900 dark:text-white"
            value={sort}
            onChange={e => handleSortChange(e.target.value as any)}
            aria-label="Sort by"
          >
            <option value="rating_desc">Top Rated</option>
            <option value="rating_asc">Rising Stars</option>
            <option value="name_az">Name A–Z</option>
            <option value="institute_az">Institute A–Z</option>
          </select>
          
          {/* Institute Filter */}
          <select
            className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 text-gray-900 dark:text-white"
            value={selectedInstitute}
            onChange={e => handleInstituteChange(e.target.value)}
            aria-label="Filter by institute"
          >
            <option value="all">All Institutes</option>
            {institutes?.map(ins => (
              <option key={ins} value={ins}>{ins}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <p className="text-red-700 dark:text-red-400 font-medium">Failed to load teachers. Please try again later.</p>
          {import.meta.env.DEV && (
            <p className="text-red-600 dark:text-red-500 text-sm mt-2">Error: {error.message}</p>
          )}
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Refresh Page
          </button>
        </div>
      )}

      {isLoading && <TeacherListSkeleton count={12} />}

      {!isLoading && data && (
        <>
          {/* Teacher Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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

          {/* Teacher Modal */}
          {selectedTeacher && (
            <TeacherModal
              teacher={selectedTeacher}
              isOpen={isModalOpen}
              onClose={closeTeacherModal}
            />
          )}
        </>
      )}
    </div>
  );
}