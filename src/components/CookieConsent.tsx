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

  // Deliberately compact: this is the first thing a new visitor sees, and it
  // should read as a quiet footnote, not a modal-weight interruption. One line
  // of copy, both choices equally available, details behind a disclosure.
  return (
    <div className="fixed bottom-0 left-0 right-0 z-modal px-4 py-3 bg-base-100 border-t border-base-300 shadow-lg animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="max-w-page mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <p className="flex-1 text-sm text-base-content/80 m-0">
            We use essential cookies to keep you signed in, and optional analytics to improve the site.{' '}
            <Link to="/privacy" className="text-primary underline">
              Privacy policy
            </Link>
          </p>

          <div className="flex items-center gap-2 flex-shrink-0">
            <details className="relative">
              <summary className="cursor-pointer list-none text-sm font-medium text-base-content/70 hover:text-primary px-2 py-1.5 select-none">
                Customize
              </summary>
              {/* Opens upward from the bar so it never pushes the page around.
                  Anchored LEFT on mobile: the stacked layout puts "Customize" at
                  the row's left edge, so a right-anchored 288px panel would hang
                  off-screen and make the consent checkboxes untappable. */}
              <div className="absolute bottom-full left-0 sm:left-auto sm:right-0 mb-2 w-72 space-y-3 p-4 bg-base-100 border border-base-300 rounded-lg shadow-lg">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.essential}
                    disabled
                    className="checkbox checkbox-sm mt-0.5"
                  />
                  <span className="text-sm text-base-content/80">
                    <strong>Essential</strong>: sign-in, security, and basic functionality (required)
                  </span>
                </label>

                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.performance}
                    onChange={(e) => setPreferences({ ...preferences, performance: e.target.checked })}
                    className="checkbox checkbox-sm mt-0.5"
                  />
                  <span className="text-sm text-base-content/80">
                    <strong>Performance</strong>: page speed and load-time measurement
                  </span>
                </label>

                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={preferences.analytics}
                    onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                    className="checkbox checkbox-sm mt-0.5"
                  />
                  <span className="text-sm text-base-content/80">
                    <strong>Analytics</strong>: how visitors use the site
                  </span>
                </label>

                <Button variant="outline" size="sm" block onClick={savePreferences}>
                  Save preferences
                </Button>
              </div>
            </details>

            <Button variant="outline" size="sm" onClick={acceptEssential}>
              Essential only
            </Button>
            <Button variant="primary" size="sm" onClick={acceptAll}>
              Accept all
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
