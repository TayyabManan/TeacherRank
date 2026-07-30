/**
 * Sentry error monitoring.
 *
 * IMPORTANT — there is deliberately NO top-level `import ... from '@sentry/react'`
 * in this file. A static import puts the whole SDK (~205 kB raw / ~70 kB gzip) in
 * the entry chunk, which Vite then emits a `modulepreload` for. `main.tsx` defers
 * the *call* to initSentry() behind requestIdleCallback, but that only delays
 * initialization — it does nothing about the download. The import has to be
 * dynamic for the deferral to mean anything.
 *
 * `logger.ts` and `ErrorBoundary.tsx` import captureException from here and are
 * themselves in the eager graph, so captureException must stay synchronous and
 * must not reach for the SDK statically. It forwards once the SDK is loaded and
 * buffers a bounded queue until then.
 *
 * Free tier: 5k errors/month, 10k performance units/month.
 */

type SentryModule = typeof import('@sentry/react')

/**
 * Only the two functions the reporting path needs. Destructured at the await in
 * initSentry() rather than held as a namespace: a namespace dynamic import is
 * opaque to Rollup, so it has to retain the whole package (measured 379 kB raw
 * / 128 kB gzip vs the tree-shaken build).
 */
type SentryReporter = Pick<SentryModule, 'withScope' | 'captureException'>

let sentry: SentryReporter | null = null

/** Arbitrary structured context attached to a captured error. */
type ErrorContext = Record<string, any>

/** Errors captured before the dynamic import resolves, replayed on init. */
type QueuedError = { error: Error; context?: ErrorContext }
const pending: QueuedError[] = []
const MAX_PENDING = 20

/**
 * Load and initialize Sentry. Called from main.tsx inside requestIdleCallback,
 * so the SDK is fetched off the critical path. No-op outside production and
 * idempotent.
 */
export async function initSentry(): Promise<void> {
  if (!import.meta.env.PROD || sentry) return

  const { init, browserTracingIntegration, withScope, captureException: report } =
    await import('@sentry/react')

  init({
    // Get your free DSN from https://sentry.io (sign up for free account)
    dsn: import.meta.env.VITE_SENTRY_DSN,

    // No replayIntegration: it shipped unmasked user text with no sample
    // rate (PII + quota + bundle weight). Errors + traces are enough here.
    integrations: [
      browserTracingIntegration({
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

  const reporter: SentryReporter = { withScope, captureException: report }
  sentry = reporter

  // Flush anything captured while the SDK was still loading.
  const queued = pending.splice(0, pending.length)
  for (const item of queued) {
    send(reporter, item.error, item.context)
  }
}

/** Forward one error to a loaded SDK. */
function send(
  reporter: SentryReporter,
  error: Error,
  context?: ErrorContext
): void {
  reporter.withScope(scope => {
    if (context) {
      scope.setContext('additional', context)
    }
    reporter.captureException(error)
  })
}

/**
 * Capture an exception with context. Synchronous by contract — `logger.ts` and
 * `ErrorBoundary.tsx` call this from hot paths and ignore the return value.
 * Outside production it logs to the console; in production it forwards to Sentry
 * once loaded, and queues (up to MAX_PENDING) before that so errors thrown
 * during boot aren't silently dropped.
 */
export function captureException(
  error: Error,
  context?: ErrorContext
): void {
  if (!import.meta.env.PROD) {
    console.error(error, context)
    return
  }

  if (sentry) {
    send(sentry, error, context)
    return
  }

  if (pending.length < MAX_PENDING) {
    pending.push({ error, context })
  }
}
