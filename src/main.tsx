import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// ReactQueryDevtools removed for production optimization
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { initSentry } from './lib/sentry'
import { initPerformanceMonitoring } from './lib/performance'
import { validateEnvironment, isProduction } from './config/env'
import { ThemeProvider } from './contexts/ThemeContext'
import App from './App'
import './styles.css'
import './styles/animations.css'
import './styles/mobile.css'
import './styles/landing.css'

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

// Initialize monitoring in production
if (import.meta.env.PROD) {
  initSentry()
  initPerformanceMonitoring()
}

// Register service worker for offline support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered:', registration.scope)
      })
      .catch(error => {
        console.log('SW registration failed:', error)
      })
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
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