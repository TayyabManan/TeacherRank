import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button } from './Button'

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
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-modal p-4 bg-base-100 border-t border-base-300 shadow-lg animate-slide-up">
      <div className="max-w-page mx-auto">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2 text-base-content">Cookie Preferences</h3>
            <p className="text-sm text-base-content/70 mb-3">
              We use cookies to enhance your experience, analyze site traffic, and improve our services. 
              By clicking "Accept All", you consent to our use of cookies. Read our{' '}
              <Link to="/privacy" className="text-primary underline">
                Privacy Policy
              </Link>{' '}
              for more information.
            </p>
            
            {/* Cookie Categories */}
            <details className="mb-3">
              <summary className="cursor-pointer text-sm font-medium text-base-content/80 hover:text-primary">
                Customize Preferences
              </summary>
              <div className="mt-3 space-y-2 p-3 bg-base-200 rounded-lg">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.essential}
                    disabled
                    className="checkbox checkbox-sm"
                  />
                  <span className="text-sm text-base-content/80">
                    <strong>Essential Cookies</strong> (Required)
                    <p className="text-xs text-base-content/70">
                      Required for authentication, security, and basic functionality
                    </p>
                  </span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.performance}
                    onChange={(e) => setPreferences({ ...preferences, performance: e.target.checked })}
                    className="checkbox checkbox-sm"
                  />
                  <span className="text-sm text-base-content/80">
                    <strong>Performance Cookies</strong>
                    <p className="text-xs text-base-content/70">
                      Help us understand site performance and load times
                    </p>
                  </span>
                </label>
                
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.analytics}
                    onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                    className="checkbox checkbox-sm"
                  />
                  <span className="text-sm text-base-content/80">
                    <strong>Analytics Cookies</strong>
                    <p className="text-xs text-base-content/70">
                      Help us understand how visitors interact with our site
                    </p>
                  </span>
                </label>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={savePreferences}
                  className="mt-2"
                >
                  Save Preferences
                </Button>
              </div>
            </details>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={acceptEssential}
            >
              Essential Only
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={acceptAll}
            >
              Accept All
            </Button>
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