import React, { ReactNode, useEffect, useState, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useUser, useProfile, useAuthStateChange } from '../hooks/useAuth'
import { isAdmin } from '../lib/auth'
import { Footer } from './Footer'
import { CookieConsent } from './CookieConsent'
import { Breadcrumbs } from './Breadcrumbs'
import { useTheme } from '../contexts/ThemeContext'
import { useSignOut } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { usePlatformStats } from '../hooks/useStats'
import { useMobileDetection, useHaptic, useSwipeGesture } from '../lib/mobile'

interface LayoutProps {
  children: ReactNode
}

// Theme toggle dropdown component - moved outside to avoid hooks error
const ThemeIcon = ({ name, className = 'w-4 h-4' }: { name: string; className?: string }) => {
  const paths: Record<string, string> = {
    light: 'M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z',
    dark: 'M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z',
    system: 'M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25',
  }
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[name] || paths.system} />
    </svg>
  )
}

const ThemeToggleButton = React.memo(() => {
  const { theme, setTheme } = useTheme()
  const [isOpen, setIsOpen] = React.useState(false)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)

  const themes = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' }
  ]

  // Move focus into the menu when it opens
  React.useEffect(() => {
    if (isOpen) menuRef.current?.querySelector('button')?.focus()
  }, [isOpen])

  const close = (returnFocus = true) => {
    setIsOpen(false)
    if (returnFocus) buttonRef.current?.focus()
  }

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button') || [])
    const idx = items.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(idx + 1) % items.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus() }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !isOpen) { e.preventDefault(); setIsOpen(true) } }}
        className="flex items-center gap-2 px-3 py-2 text-base-content/70 hover:text-base-content hover:bg-base-200 rounded-lg transition-colors"
        aria-label="Theme settings"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <ThemeIcon name={theme} className="w-4 h-4" />
        <svg aria-hidden="true" className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-overlay md:hidden" onClick={() => close(false)} />
          <div
            ref={menuRef}
            role="menu"
            aria-label="Theme"
            onKeyDown={onMenuKeyDown}
            className="absolute right-0 mt-2 w-48 rounded-lg shadow-md border border-solid border-base-300 bg-base-100 py-1 z-dropdown"
          >
            <div className="px-3 py-2 border-b border-solid border-base-300 bg-base-100">
              <p className="text-xs font-semibold text-base-content/70 uppercase">Theme</p>
            </div>
            {themes.map((t) => (
              <button
                key={t.value}
                role="menuitem"
                onClick={() => {
                  setTheme(t.value as any)
                  close()
                }}
                className={`w-full px-3 py-2 text-left flex items-center gap-3 transition-colors text-base-content ${
                  theme === t.value ? 'bg-primary/10' : 'hover:bg-base-200'
                }`}
              >
                <ThemeIcon name={t.value} className="w-4 h-4" />
                <span className="flex-1 text-sm font-medium">{t.label}</span>
                {theme === t.value && (
                  <svg aria-hidden="true" className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
})

export function Layout({ children }: LayoutProps) {
  // All hooks must be at the top level, before any conditions or effects
  const { data: user } = useUser()
  const { data: profile } = useProfile(user?.id)
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats, isFetching: statsFetching } = usePlatformStats()
  const location = useLocation()
  const sidebarRef = useRef<HTMLElement>(null)
  const { mobile, touchDevice } = useMobileDetection()
  const haptic = useHaptic()
  const navigate = useNavigate()
  const signOutMutation = useSignOut()
  const [showManageTeachers, setShowManageTeachers] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
  const [isCollapsed, setIsCollapsed] = React.useState(() => {
    // Get collapsed state from localStorage, default to false on mobile, user preference on desktop
    const stored = localStorage.getItem('teachrank-sidebar-collapsed')
    return mobile ? false : (stored ? JSON.parse(stored) : false)
  })
  
  // Handle OAuth authentication state changes
  useAuthStateChange()
  
  // Debug logging
  React.useEffect(() => {
    console.log('Stats data:', stats);
    console.log('Stats loading:', statsLoading);
    console.log('Stats error:', statsError);
  }, [stats, statsLoading, statsError]);

  // Swipe gesture support for mobile sidebar
  // Set up swipe gestures for mobile sidebar
  useSwipeGesture(sidebarRef, mobile ? {
    onSwipeRight: () => {
      if (!isMobileMenuOpen) {
        haptic.swipe()
        setIsMobileMenuOpen(true)
      }
    },
    onSwipeLeft: () => {
      if (isMobileMenuOpen) {
        haptic.swipe()
        setIsMobileMenuOpen(false)
      }
    }
  } : undefined)

  // Close mobile menu when route changes
  useEffect(() => {
    if (mobile && isMobileMenuOpen) {
      setIsMobileMenuOpen(false)
    }
  }, [location.pathname, mobile])

  // Handle escape key for mobile menu
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false)
      }
    }

    if (isMobileMenuOpen) {
      document.addEventListener('keydown', handleEscapeKey)
      return () => document.removeEventListener('keydown', handleEscapeKey)
    }
  }, [isMobileMenuOpen])

  const handleSignOut = async () => {
    haptic.medium() // Haptic feedback for important action
    try {
      await signOutMutation.mutateAsync()
      navigate('/auth')
    } catch (error) {
      console.error('Sign out failed:', error)
      haptic.error() // Error feedback
    }
  }

  // Check admin status
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        if (user) {
          const adminStatus = await isAdmin()
          setShowManageTeachers(adminStatus)
        } else {
          setShowManageTeachers(false)
        }
      } catch (error) {
        console.error('Error checking admin status:', error)
        setShowManageTeachers(false)
      }
    }
    checkAdminStatus()
  }, [user])

  // Save collapsed state to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('teachrank-sidebar-collapsed', JSON.stringify(isCollapsed))
  }, [isCollapsed])

  const toggleSidebar = () => {
    haptic.light() // Light feedback for UI toggle
    setIsCollapsed(!isCollapsed)
  }

  const toggleMobileMenu = () => {
    haptic.light() // Light feedback for menu toggle
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const navigationItems = [
    {
      path: '/teachers',
      label: 'Teachers',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      )
    },
    {
      path: '/institutes',
      label: 'Institutes',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 7l6 3v11H6V10l6-3z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 7V2" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M2 21h20" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 21v-7h3M21 21v-7h-3" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 21v-4h4v4" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 2h4v3h-4V2z" />
          <circle cx="12" cy="13" r="1.5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      )
    },
    {
      path: '/dashboard',
      label: 'Dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="9" rx="1" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          <rect x="14" y="3" width="7" height="5" rx="1" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          <rect x="14" y="12" width="7" height="9" rx="1" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          <rect x="3" y="16" width="7" height="5" rx="1" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      ),
      requiresAuth: true
    },
    {
      path: '/faq',
      label: 'FAQ',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      path: '/feedback',
      label: 'Feedback',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      )
    },
    ...(showManageTeachers ? [
      {
        path: '/manage-teachers',
        label: 'Manage',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )
      },
      {
        path: '/admin',
        label: 'Admin',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        )
      }
    ] : [])
  ]

  const isActive = (path: string) => {
    return location.pathname === path
  }

  return (
    <div className="min-h-dvh relative overflow-hidden bg-base-200">
      {/* Skip link — first focusable element, visible only on keyboard focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-skiplink focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-primary-content focus:shadow-md"
      >
        Skip to main content
      </a>
      {/* Page background — off-white so cards/headers (base-100) gain subtle separation */}
      <div className="fixed inset-0 bg-base-200 z-behind" />
      
      {/* Content wrapper */}
      <div className="relative z-content">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-base-100 border-b border-base-300 z-header">
        <div className="flex flex-col">
          {/* Top bar with logo and actions */}
          <div className="flex items-center justify-between h-16 px-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-primary-content" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path d="M9.664 1.319a.75.75 0 0 1 .672 0 41.059 41.059 0 0 1 8.198 5.424.75.75 0 0 1-.254 1.285 31.372 31.372 0 0 0-7.86 3.83.75.75 0 0 1-.84 0 31.508 31.508 0 0 0-2.08-1.287V9.394c0-.244.116-.463.302-.592a35.504 35.504 0 0 1 3.305-2.033.75.75 0 0 0-.714-1.319 37 37 0 0 0-3.446 2.12A2.216 2.216 0 0 0 6 9.393v.38a31.293 31.293 0 0 0-4.28-1.746.75.75 0 0 1-.254-1.285 41.059 41.059 0 0 1 8.198-5.424ZM6 11.459a29.848 29.848 0 0 0-2.455-1.158 41.029 41.029 0 0 0-.39 3.114.75.75 0 0 0 .419.74c.528.256 1.046.53 1.554.82-.21.324-.455.63-.739.914a.75.75 0 1 0 1.06 1.06c.37-.369.69-.77.96-1.193a26.61 26.61 0 0 1 3.095 2.348.75.75 0 0 0 .992 0 26.547 26.547 0 0 1 5.93-3.95.75.75 0 0 0 .42-.739 41.053 41.053 0 0 0-.39-3.114 29.925 29.925 0 0 0-5.199 2.801 2.25 2.25 0 0 1-2.514 0c-.41-.275-.826-.541-1.25-.797Z"/></svg>
              </div>
              <span className="text-lg font-bold text-base-content">TeacherRank</span>
            </Link>
          <div className="flex items-center gap-2">
            <ThemeToggleButton />
            {user && (
              <button
                onClick={handleSignOut}
                className="p-2 touch-target flex items-center justify-center text-base-content/70 hover:text-error hover:bg-error/10 rounded-lg transition-all duration-200 touch-manipulation"
                aria-label="Sign out"
                title="Sign out"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
              </button>
            )}
            <button
              onClick={toggleMobileMenu}
              className="p-2 touch-target flex items-center justify-center text-base-content/70 hover:text-base-content hover:bg-base-200 rounded-lg transition-all duration-200 touch-manipulation"
              aria-label="Toggle mobile menu"
              aria-expanded={isMobileMenuOpen}
              aria-controls="sidebar-nav"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                )}
              </svg>
            </button>
          </div>
          </div>
          {/* Breadcrumbs */}
          <div className="flex items-center justify-center px-4 py-3 border-t border-base-300 bg-base-200">
            <Breadcrumbs />
          </div>
        </div>
      </header>

      {/* Desktop Header with Collapse Button */}
      <header className={`hidden lg:block fixed top-0 right-0 bg-base-100 border-b border-base-300 z-header ${isCollapsed ? 'left-20' : 'left-64'}`}>
        <div className="flex items-center h-16 px-6">
          {/* Left section - Collapse button */}
          <div className="flex-1 flex items-center">
            <button
              onClick={toggleSidebar}
              className="p-2 text-base-content/70 hover:text-base-content transition-all duration-200 hover:bg-base-200 rounded-lg"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!isCollapsed}
              aria-controls="sidebar-nav"
            >
              <svg className={`w-5 h-5 transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          </div>
          
          {/* Center section - Breadcrumbs */}
          <div className="flex-none">
            <Breadcrumbs />
          </div>
          
          {/* Right section - Theme toggle and sign out */}
          <div className="flex-1 flex items-center justify-end gap-3">
            <ThemeToggleButton />
            {user && (
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 text-base-content/70 hover:text-error hover:bg-error/10 rounded-lg transition-all duration-200"
                aria-label="Sign out"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                <span className="hidden xl:inline text-sm font-medium">Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        id="sidebar-nav"
        aria-label="Sidebar"
        className={`fixed left-0 top-0 h-dvh bg-base-100 border-r border-base-300 z-sidebar transition-all duration-300 ${
          mobile ? 'shadow-md' : ''
        } ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        } w-64 overflow-hidden`}>
        <div className="flex flex-col h-full">
          {/* Logo - Fixed height */}
          <div className={`flex-shrink-0 p-4 border-b border-base-300/50 ${isCollapsed ? 'lg:px-3' : ''}`}>
            <Link
              to="/"
              className="flex items-center gap-3 group"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center group-transition-transform duration-200 flex-shrink-0">
                <svg className="w-5 h-5 text-primary-content" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path d="M9.664 1.319a.75.75 0 0 1 .672 0 41.059 41.059 0 0 1 8.198 5.424.75.75 0 0 1-.254 1.285 31.372 31.372 0 0 0-7.86 3.83.75.75 0 0 1-.84 0 31.508 31.508 0 0 0-2.08-1.287V9.394c0-.244.116-.463.302-.592a35.504 35.504 0 0 1 3.305-2.033.75.75 0 0 0-.714-1.319 37 37 0 0 0-3.446 2.12A2.216 2.216 0 0 0 6 9.393v.38a31.293 31.293 0 0 0-4.28-1.746.75.75 0 0 1-.254-1.285 41.059 41.059 0 0 1 8.198-5.424ZM6 11.459a29.848 29.848 0 0 0-2.455-1.158 41.029 41.029 0 0 0-.39 3.114.75.75 0 0 0 .419.74c.528.256 1.046.53 1.554.82-.21.324-.455.63-.739.914a.75.75 0 1 0 1.06 1.06c.37-.369.69-.77.96-1.193a26.61 26.61 0 0 1 3.095 2.348.75.75 0 0 0 .992 0 26.547 26.547 0 0 1 5.93-3.95.75.75 0 0 0 .42-.739 41.053 41.053 0 0 0-.39-3.114 29.925 29.925 0 0 0-5.199 2.801 2.25 2.25 0 0 1-2.514 0c-.41-.275-.826-.541-1.25-.797Z"/></svg>
              </div>
              <div className={`transition-all duration-300 ${isCollapsed ? 'lg:hidden' : 'lg:block'}`}>
                <span className="text-lg font-bold text-base-content">
                  TeacherRank
                </span>
              </div>
            </Link>
          </div>

          {/* Middle section with flex-1 to take available space */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* Navigation - Scrollable if needed but compact */}
            <nav aria-label="Main" className={`flex-shrink-0 p-3 ${isCollapsed ? 'lg:px-2' : ''}`}>
              <ul className="space-y-1">
                {navigationItems.map((item) => {
                  if (item.requiresAuth && !user) return null
                  
                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        aria-current={isActive(item.path) ? 'page' : undefined}
                        onClick={() => {
                          haptic.light() // Light feedback for navigation
                          setIsMobileMenuOpen(false)
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 group relative ${
                          mobile ? 'touch-target-tall touch-manipulation' : ''
                        } ${
                          isActive(item.path)
                            ? 'bg-primary text-primary-content shadow-lg'
                            : 'text-base-content hover:bg-base-200'
                        } ${isCollapsed ? 'lg:justify-center lg:px-2' : ''}`}
                        title={isCollapsed ? item.label : undefined}
                      >
                        <div aria-hidden="true" className={`${isActive(item.path) ? 'text-primary-content' : 'text-base-content/70 group-hover:text-primary'} transition-colors duration-200 flex-shrink-0 [&>svg]:w-4 [&>svg]:h-4`}>
                          {item.icon}
                        </div>
                        <span className={`text-sm font-medium transition-all duration-300 ${isCollapsed ? 'lg:hidden' : 'lg:block'}`}>{item.label}</span>
                        
                        {/* Tooltip for collapsed state */}
                        {isCollapsed && (
                          <div className="hidden lg:block absolute left-full ml-2 px-2 py-1 bg-neutral text-neutral-content text-xs rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-dropdown whitespace-nowrap">
                            {item.label}
                          </div>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>

            {/* Quick Stats - Compact version */}
            <div className={`flex-shrink-0 px-3 py-2 border-y border-base-300/50 ${isCollapsed ? 'lg:px-2' : ''}`}>
              {(!isCollapsed || mobile) ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-semibold text-base-content/70 uppercase flex items-center gap-1">
                      Quick Stats
                    </h3>
                    <button
                      onClick={() => {
                        haptic.light()
                        refetchStats()
                      }}
                      disabled={statsFetching}
                      aria-label="Refresh statistics"
                      className={`p-1 rounded-md transition-all duration-200 ${
                        statsFetching
                          ? 'bg-primary/10 text-primary cursor-not-allowed'
                          : 'text-base-content/70 hover:bg-base-200 hover:text-primary'
                      }`}
                      title="Refresh stats"
                    >
                      <svg 
                        className={`w-3.5 h-3.5 ${statsFetching ? 'animate-spin' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth="1.5" 
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-base-200 rounded-lg p-2">
                      <p className="text-xs text-base-content/70">Teachers</p>
                      <p className="text-sm font-bold text-base-content">
                        {statsLoading ? (
                          <span className="inline-block h-4 w-8 bg-base-300 rounded animate-pulse"></span>
                        ) : (
                          stats?.totalTeachers ?? 'N/A'
                        )}
                      </p>
                    </div>
                    <div className="bg-base-200 rounded-lg p-2">
                      <p className="text-xs text-base-content/70">Reviews</p>
                      <p className="text-sm font-bold text-base-content">
                        {statsLoading ? (
                          <span className="inline-block h-4 w-8 bg-base-300 rounded animate-pulse"></span>
                        ) : (
                          (stats?.totalRatings || 0) > 999 
                            ? `${((stats?.totalRatings || 0) / 1000).toFixed(1)}k`
                            : stats?.totalRatings ?? 'N/A'
                        )}
                      </p>
                    </div>
                    <div className="bg-base-200 rounded-lg p-2">
                      <p className="text-xs text-base-content/70">Students</p>
                      <p className="text-sm font-bold text-base-content">
                        {statsLoading ? (
                          <span className="inline-block h-4 w-8 bg-base-300 rounded animate-pulse"></span>
                        ) : (
                          stats?.totalStudents ?? 'N/A'
                        )}
                      </p>
                    </div>
                    <div className="bg-base-200 rounded-lg p-2">
                      <p className="text-xs text-base-content/70">Avg Rating</p>
                      <p className="text-sm font-bold text-base-content">
                        {statsLoading ? (
                          <span className="inline-block h-4 w-8 bg-base-300 rounded animate-pulse"></span>
                        ) : (
                          <span className="flex items-center gap-0.5">
                            {stats?.averageRating?.toFixed(1) ?? 'N/A'}
                            {stats?.averageRating && (
                              <svg className="w-3 h-3 text-rating" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            )}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  {stats?.todayRatings !== undefined && !statsLoading && (
                    <div className="bg-primary/10 rounded-lg p-2">
                      <p className="text-xs text-primary">
                        <span className="font-semibold">{stats.todayRatings}</span> review(s) today
                        {stats.weeklyGrowth !== 0 && (
                          <span className={`ml-1 ${stats.weeklyGrowth > 0 ? 'text-success' : 'text-error'}`}>
                            ({stats.weeklyGrowth > 0 ? '+' : ''}{stats.weeklyGrowth}%)
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2 py-1 group relative">
                  <div className="text-primary relative" title="Platform Stats">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="3" y="12" width="3" height="9" rx="0.5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                      <rect x="8" y="7" width="3" height="14" rx="0.5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                      <rect x="13" y="9" width="3" height="12" rx="0.5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                      <rect x="18" y="5" width="3" height="16" rx="0.5" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
                    </svg>
                    {statsLoading && (
                      <span className="absolute -top-1 -right-1 loading loading-spinner loading-xs text-primary"></span>
                    )}
                  </div>
                  {/* Tooltip with stats for collapsed state */}
                  <div className="hidden lg:block absolute left-full ml-2 px-3 py-2 bg-neutral text-neutral-content text-xs rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-dropdown whitespace-nowrap">
                    <p className="font-semibold mb-1">Platform Stats</p>
                    <div className="space-y-1 text-neutral-content/60">
                      <p>Teachers: {stats?.totalTeachers || 0}</p>
                      <p>Reviews: {stats?.totalRatings || 0}</p>
                      <p>Students: {stats?.totalStudents || 0}</p>
                      <p>Avg Rating: {stats?.averageRating?.toFixed(1) || '0.0'}★</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Spacer to push user section to bottom */}
            <div className="flex-1 min-h-0"></div>
          </div>

          {/* User Section - Fixed at bottom */}
          <div className={`flex-shrink-0 p-3 border-t border-base-300/50 ${isCollapsed ? 'lg:px-2' : ''}`}>
            {user ? (
              <div className={`flex items-center gap-2 p-2 bg-base-200 rounded-lg group relative ${isCollapsed ? 'lg:justify-center' : ''}`}>
                <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-primary-content text-xs font-medium">
                    {profile?.full_name?.charAt(0) || user.email?.charAt(0) || '?'}
                  </span>
                </div>
                <div className={`flex-1 min-w-0 transition-all duration-300 ${isCollapsed ? 'lg:hidden' : 'lg:block'}`}>
                  <p className="text-xs font-medium text-base-content truncate">
                    {profile?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-base-content/70 truncate">
                    {user.email}
                  </p>
                </div>
                
                {/* User info tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="hidden lg:block absolute left-full ml-2 px-2 py-1 bg-neutral text-neutral-content text-xs rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-dropdown whitespace-nowrap">
                    <p className="font-medium">{profile?.full_name || 'User'}</p>
                    <p className="text-xs text-neutral-content/60">{user.email}</p>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/auth"
                onClick={() => {
                  haptic.light()
                  setIsMobileMenuOpen(false)
                }}
                className={`flex items-center gap-2 p-2 bg-primary text-primary-content rounded-lg hover:bg-primary-focus transition-colors duration-200 group relative ${
                  mobile ? 'touch-target-tall touch-manipulation' : ''
                } ${isCollapsed ? 'lg:justify-center' : ''}`}
                title={isCollapsed ? "Sign In" : undefined}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
                <span className={`text-sm font-medium transition-all duration-300 ${isCollapsed ? 'lg:hidden' : 'lg:block'}`}>Sign In</span>
                
                {/* Sign in tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="hidden lg:block absolute left-full ml-2 px-2 py-1 bg-neutral text-neutral-content text-xs rounded-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-dropdown whitespace-nowrap">
                    Sign In
                  </div>
                )}
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`min-h-dvh transition-all duration-300 flex flex-col relative z-content ${isCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <main id="main-content" tabIndex={-1} className="flex-1 w-full max-w-page mx-auto p-4 lg:px-6 lg:pb-6 relative z-content pt-header-mobile lg:pt-header">
          {children}
        </main>
        <Footer />
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-neutral/50 z-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      {/* Cookie Consent Banner */}
      <CookieConsent />
      </div>{/* End of content wrapper */}
    </div>
  )
}