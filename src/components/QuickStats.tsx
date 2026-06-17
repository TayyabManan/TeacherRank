import React, { useCallback } from 'react'
import { usePlatformStats } from '../hooks/useStats'
import { useToast } from '../hooks/useToast'
import { CountUp } from './CountUp'

interface StatCardProps {
  label: string
  value: number
  decimals?: number
  suffix?: string
  icon: React.ReactNode
  trend?: number
  color: string
  isLoading?: boolean
}

/** Formats a stat the same way <CountUp> renders its final value (for tooltips/titles). */
const formatStat = (value: number, decimals = 0, suffix = '') => `${value.toFixed(decimals)}${suffix}`

const StatCard: React.FC<StatCardProps> = ({ label, value, decimals, suffix, icon, trend, color, isLoading }) => {
  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-4 bg-base-300 rounded"></div>
          <div className="h-3 bg-base-300 rounded w-16"></div>
        </div>
        <div className="h-6 bg-base-300 rounded w-12"></div>
      </div>
    )
  }

  return (
    <div className="group">
      <div className="flex items-center gap-2 mb-1">
        <div className={`${color} transition-transform`}>
          {icon}
        </div>
        <span className="text-xs text-base-content/70">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-lg font-bold text-base-content">
          <CountUp end={value} decimals={decimals} suffix={suffix} />
        </p>
        {trend !== undefined && trend !== 0 && (
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${
            trend > 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
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
      showToast('Stats refreshed', 'success')
    } catch (error) {
      showToast("Couldn't refresh stats. Try again.", 'error')
    }
  }, [refetch, showToast])

  const statItems: Array<{
    label: string
    value: number
    decimals?: number
    suffix?: string
    icon: React.ReactNode
    color: string
  }> = [
    {
      label: 'Teachers',
      value: stats?.totalTeachers || 0,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      color: 'text-primary'
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
      color: 'text-warning'
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
      color: 'text-info'
    },
    {
      label: 'Avg Rating',
      value: stats?.averageRating ?? 0,
      decimals: 1,
      suffix: '★',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ),
      color: 'text-success'
    }
  ]

  // Full view
  if (!isCollapsed) {
    // Handle error state
    if (isError) {
      return (
        <div className="p-4 border-b border-base-300/50">
          <div className="text-center py-2">
            <p className="text-sm text-base-content/70">Unable to load stats</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 text-xs text-primary hover:underline"
            >
              Refresh
            </button>
          </div>
        </div>
      )
    }
    
    return (
      <div className="p-4 border-b border-base-300/50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-base-content/80 flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                ? 'bg-primary/10 text-primary cursor-not-allowed' 
                : 'text-base-content/70 hover:bg-base-200 hover:text-primary'
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
        
        <div className="grid grid-cols-2 gap-4 stagger-enter">
          {statItems.map((stat, index) => (
            <StatCard
              key={index}
              label={stat.label}
              value={stat.value}
              decimals={stat.decimals}
              suffix={stat.suffix}
              icon={stat.icon}
              color={stat.color}
              isLoading={isLoading}
            />
          ))}
        </div>
        
        {stats?.todayRatings !== undefined && (
          <div className="mt-4 p-3 bg-primary/10 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs text-primary font-medium">Today's Activity</span>
              <span className="text-sm font-bold text-primary">
                {stats.todayRatings} new reviews
              </span>
            </div>
            {stats.weeklyGrowth !== 0 && (
              <div className="mt-1 text-xs text-primary">
                Weekly growth: 
                <span className={`ml-1 font-medium ${
                  stats.weeklyGrowth > 0 ? 'text-success' : 'text-error'
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
    <div className="p-2 border-b border-base-300/50">
      <div className="flex justify-center mb-2">
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className={`p-1.5 rounded-lg transition-all duration-200 ${
            isFetching 
              ? 'bg-primary/10 text-primary cursor-not-allowed' 
              : 'text-base-content/70 hover:bg-base-200 hover:text-primary'
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
            title={`${stat.label}: ${formatStat(stat.value, stat.decimals, stat.suffix)}`}
          >
            <div className={`p-2 rounded-lg hover:bg-base-200 transition-colors ${stat.color}`}>
              {stat.icon}
            </div>
            
            {/* Tooltip */}
            <div className="absolute left-full ml-2 px-2 py-1 bg-neutral text-neutral-content text-xs rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-dropdown whitespace-nowrap">
              <span className="text-gray-300">{stat.label}:</span> <span className="font-bold">{formatStat(stat.value, stat.decimals, stat.suffix)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default QuickStats