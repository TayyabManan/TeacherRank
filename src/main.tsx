import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// ReactQueryDevtools removed for production optimization
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { initSentry } from './lib/sentry'
import { validateEnvironment, isProduction } from './config/env'
import { ThemeProvider } from './contexts/ThemeContext'
import App from './App'
import './styles.css'
import './styles/animations.css'
import './styles/mobile.css'

// Validate environment variables on app start
try {
  validateEnvironment();
} catch (error) {
  console.error('Environment validation failed:', error);
  // In production, we should still try to run but log the error
  if (isProduction()) {
    console.error('Running with potentially invalid configuration');
  }
}

// Initialize monitoring in production. Exactly two pipelines: Vercel Speed
// Insights (vitals) + Sentry (errors/traces) — the old custom vitals collector
// only wrote to a buffer nothing read.
if (import.meta.env.PROD) {
  // Sentry is heavy; defer it off the critical path so it doesn't compete with
  // first paint. initSentry() dynamically imports @sentry/react, so the ~70 kB
  // gzip SDK is fetched here rather than preloaded with the entry chunk — the
  // deferral is only real because the import inside is dynamic (see lib/sentry).
  // Errors before it resolves are caught by the ErrorBoundary and queued by
  // captureException, then flushed on init.
  const startSentry = () => {
    initSentry().catch(() => {
      // Monitoring is best-effort: a blocked or failed SDK fetch must never
      // surface as an unhandled rejection in the app it's meant to observe.
    })
  }
  if ('requestIdleCallback' in window) {
    requestIdleCallback(startSentry, { timeout: 3000 })
  } else {
    setTimeout(startSentry, 1)
  }
}

// Service worker retired (2026-07): the network-first SW only duplicated CDN
// caching and caused the June stale-shell incident. Actively unregister any
// previously installed worker and purge its caches so returning visitors get
// fresh deploys. Keep this killswitch until ~2026-08, then delete it.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations()
      .then(registrations => registrations.forEach(registration => registration.unregister()))
      .catch(() => {})
    if ('caches' in window) {
      caches.keys()
        .then(keys => keys.forEach(key => caches.delete(key)))
        .catch(() => {})
    }
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <ThemeProvider>
          <App />
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </BrowserRouter>
      {/* ReactQueryDevtools removed for production */}
    </QueryClientProvider>
  </React.StrictMode>
)