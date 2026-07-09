import * as Sentry from '@sentry/react'

/**
 * Initialize Sentry error monitoring
 * Free tier: 5k errors/month, 10k performance units/month
 */

export function initSentry() {
  // Only initialize in production
  if (import.meta.env.PROD) {
    Sentry.init({
      // Get your free DSN from https://sentry.io (sign up for free account)
      dsn: import.meta.env.VITE_SENTRY_DSN,
      
      // No replayIntegration: it shipped unmasked user text with no sample
      // rate (PII + quota + bundle weight). Errors + traces are enough here.
      integrations: [
        Sentry.browserTracingIntegration({
          // Capture interactions (clicks, navigation)
          enableInp: true,
          enableLongTask: true,
        }),
      ],

      // Performance Monitoring — 5% keeps the free tier comfortable at 10k views/day
      tracesSampleRate: 0.05,
      
      // Release tracking
      release: import.meta.env.VITE_APP_VERSION || '1.0.0',
      
      // Environment
      environment: import.meta.env.MODE,
      
      
      // Only send errors in production
      beforeSend(event, hint) {
        // Filter out non-critical errors to save quota
        const error = hint.originalException as any
        
        // Don't send network errors (usually user connection issues)
        if (error && error.message && error.message.includes('NetworkError')) {
          return null
        }
        
        // Don't send cancelled requests
        if (error && error.name === 'AbortError') {
          return null
        }
        
        // Filter out errors from browser extensions
        if (event.exception?.values?.[0]?.stacktrace?.frames?.some(
          frame => frame.filename && (
            frame.filename.includes('extension://') ||
            frame.filename.includes('chrome-extension://')
          )
        )) {
          return null
        }
        
        return event
      },
      
      // Ignore common non-critical errors
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        'Non-Error promise rejection captured',
        'Network request failed',
        'Load failed',
      ],
    })
  }
}

// User context helper
export function setSentryUser(user: { id: string; email?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
  })
}

// Clear user on logout
export function clearSentryUser() {
  Sentry.setUser(null)
}

// Custom error boundary with Sentry
export const SentryErrorBoundary = Sentry.ErrorBoundary

// Performance monitoring helpers
export function measurePerformance(name: string, fn: () => void | Promise<void>) {
  return Sentry.startSpan({ name, op: 'custom' }, () => {
    return fn()
  })
}

// Log custom breadcrumbs for better debugging
export function logBreadcrumb(
  message: string,
  category: string,
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, any>
) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  })
}

// Capture custom events
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info'
) {
  if (import.meta.env.PROD) {
    Sentry.captureMessage(message, level)
  } else {
    console.log(`[${level}]`, message)
  }
}

// Capture exceptions with context
export function captureException(
  error: Error,
  context?: Record<string, any>
) {
  if (import.meta.env.PROD) {
    Sentry.withScope(scope => {
      if (context) {
        scope.setContext('additional', context)
      }
      Sentry.captureException(error)
    })
  } else {
    console.error(error, context)
  }
}