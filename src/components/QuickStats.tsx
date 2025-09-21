import React, { useCallback } from 'react'
import { usePlatformStats } from '../hooks/useStats'
import { useToast } from '../hooks/useToast'

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  trend?: number
  color: string
  isLoading?: boolean
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, trend, color, isLoading }) => {
  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
        </div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
      </div>
    )
  }

  return (
    <div className="group">
      <div className="flex items-center gap-2 mb-1">
        <div className={`${color} transition-transform group-hover:scale-110`}>
          {icon}
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
        {trend !== undefined && trend !== 0 && (
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
            trend > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
    </div>
  )
}

interface QuickStatsProps {
  isCollapsed: boolean
}

export const QuickStats: React.FC<QuickStatsProps> = ({ isCollapsed }) => {
  const { data: stats, isLoading, error, isError, refetch, isFetching } = usePlatformStats()
  const { showToast } = useToast()
  
  const handleRefresh = useCallback(async () => {
    try {
      await refetch()
      showToast('Stats refreshed successfully', 'success')
    } catch (error) {
      showToast('Failed to refresh stats', 'error')
    }
  }, [refetch, showToast])

  const statItems = [
    {
      label: 'Teachers',
      value: stats?.totalTeachers || 0,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      color: 'text-purple-500'
    },
    {
      label: 'Reviews',
      value: stats?.totalRatings || 0,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ),
      color: 'text-yellow-500'
    },
    {
      label: 'Students',
      value: stats?.totalStudents || 0,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
            d="M12 14l9-5-9-5-9 5 9 5z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
            d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
        </svg>
      ),
      color: 'text-blue-500'
    },
    {
      label: 'Avg Rating',
      value: stats?.averageRating ? `${stats.averageRating}★` : '0★',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ),
      color: 'text-green-500'
    }
  ]

  // Full view
  if (!isCollapsed) {
    // Handle error state
    if (isError) {
      return (
        <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50">
          <div className="text-center py-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">Unable to load stats</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 text-xs text-purple-600 dark:text-purple-400 hover:underline"
            >
              Refresh
            </button>
          </div>
        </div>
      )
    }
    
    return (
      <div className="p-4 border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Platform Overview
          </h3>
          <button
            onClick={handleRefresh}
            disabled={isFetching}
            className={`p-1.5 rounded-lg transition-all duration-200 ${
              isFetching 
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 cursor-not-allowed' 
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-purple-600 dark:hover:text-purple-400'
            }`}
            title="Refresh stats"
          >
            <svg 
              className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {statItems.map((stat, index) => (
            <StatCard
              key={index}
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              color={stat.color}
              isLoading={isLoading}
            />
          ))}
        </div>
        
        {stats?.todayRatings !== undefined && (
          <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Today's Activity</span>
              <span className="text-sm font-bold text-purple-700 dark:text-purple-300">
                {stats.todayRatings} new reviews
              </span>
            </div>
            {stats.weeklyGrowth !== 0 && (
              <div className="mt-1 text-xs text-purple-500 dark:text-purple-400">
                Weekly growth: 
                <span className={`ml-1 font-medium ${
                  stats.weeklyGrowth > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stats.weeklyGrowth > 0 ? '+' : ''}{stats.weeklyGrowth}%
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Collapsed view - show mini stats with refresh button
  return (
    <div className="p-2 border-b border-gray-200/50 dark:border-gray-700/50">
      <div className="flex justify-center mb-2">
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className={`p-1.5 rounded-lg transition-all duration-200 ${
            isFetching 
              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 cursor-not-allowed' 
              : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-purple-600 dark:hover:text-purple-400'
          }`}
          title="Refresh stats"
        >
          <svg 
            className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
            />
          </svg>
        </button>
      </div>
      <div className="space-y-3">
        {statItems.slice(0, 3).map((stat, index) => (
          <div 
            key={index} 
            className="group relative flex justify-center"
            title={`${stat.label}: ${stat.value}`}
          >
            <div className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${stat.color}`}>
              {stat.icon}
            </div>
            
            {/* Tooltip */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-50 whitespace-nowrap">
              <span className="text-gray-300">{stat.label}:</span> <span className="font-bold">{stat.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default QuickStats