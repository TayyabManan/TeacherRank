import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)
  const [preferences, setPreferences] = useState({
    essential: true, // Always true, can't be disabled
    performance: false,
    analytics: false,
  })

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('cookieConsent')
    if (!consent) {
      // Small delay to avoid layout shift on initial load
      setTimeout(() => setShowBanner(true), 1000)
    }
  }, [])

  const acceptAll = () => {
    const fullConsent = {
      essential: true,
      performance: true,
      analytics: true,
      timestamp: new Date().toISOString(),
    }
    localStorage.setItem('cookieConsent', JSON.stringify(fullConsent))
    setShowBanner(false)
    
    // Initialize analytics and performance monitoring if accepted
    if (fullConsent.analytics) {
      // Initialize Google Analytics if configured
      if (import.meta.env.VITE_GA_ID) {
        console.log('Analytics enabled')
      }
    }
  }

  const acceptEssential = () => {
    const minimalConsent = {
      essential: true,
      performance: false,
      analytics: false,
      timestamp: new Date().toISOString(),
    }
    localStorage.setItem('cookieConsent', JSON.stringify(minimalConsent))
    setShowBanner(false)
  }

  const savePreferences = () => {
    const customConsent = {
      ...preferences,
      timestamp: new Date().toISOString(),
    }
    localStorage.setItem('cookieConsent', JSON.stringify(customConsent))
    setShowBanner(false)
    
    // Initialize based on preferences
    if (customConsent.analytics && import.meta.env.VITE_GA_ID) {
      console.log('Analytics enabled based on preferences')
    }
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-600 shadow-lg animate-slide-up">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2 dark:text-white">🍪 Cookie Preferences</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              We use cookies to enhance your experience, analyze site traffic, and improve our services. 
              By clicking "Accept All", you consent to our use of cookies. Read our{' '}
              <Link to="/privacy" className="text-primary dark:text-blue-400 underline">
                Privacy Policy
              </Link>{' '}
              for more information.
            </p>
            
            {/* Cookie Categories */}
            <details className="mb-3">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-primary dark:hover:text-blue-400">
                Customize Preferences
              </summary>
              <div className="mt-3 space-y-2 p-3 bg-base-100 dark:bg-gray-700 rounded-lg">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.essential}
                    disabled
                    className="checkbox checkbox-sm dark:border-gray-500"
                  />
                  <span className="text-sm dark:text-gray-200">
                    <strong>Essential Cookies</strong> (Required)
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Required for authentication, security, and basic functionality
                    </p>
                  </span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.performance}
                    onChange={(e) => setPreferences({ ...preferences, performance: e.target.checked })}
                    className="checkbox checkbox-sm dark:border-gray-500"
                  />
                  <span className="text-sm dark:text-gray-200">
                    <strong>Performance Cookies</strong>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Help us understand site performance and load times
                    </p>
                  </span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.analytics}
                    onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                    className="checkbox checkbox-sm dark:border-gray-500"
                  />
                  <span className="text-sm dark:text-gray-200">
                    <strong>Analytics Cookies</strong>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Help us understand how visitors interact with our site
                    </p>
                  </span>
                </label>
                
                <button
                  onClick={savePreferences}
                  className="btn btn-sm btn-outline dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600 mt-2"
                >
                  Save Preferences
                </button>
              </div>
            </details>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={acceptEssential}
              className="btn btn-sm btn-outline dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Essential Only
            </button>
            <button
              onClick={acceptAll}
              className="btn btn-sm btn-primary dark:bg-blue-600 dark:hover:bg-blue-700 dark:border-blue-600"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function to check consent status
export function getCookieConsent() {
  const consent = localStorage.getItem('cookieConsent')
  if (!consent) return null
  
  try {
    return JSON.parse(consent)
  } catch {
    return null
  }
}

// Helper function to check if specific cookie type is allowed
export function isCookieTypeAllowed(type: 'essential' | 'performance' | 'analytics'): boolean {
  const consent = getCookieConsent()
  if (!consent) return false
  return consent[type] === true
}