import { onCLS, onFCP, onLCP, onTTFB, onINP, Metric } from 'web-vitals'
import { captureMessage } from './sentry'

/**
 * Free performance monitoring using Web Vitals
 * Tracks Core Web Vitals and sends to analytics endpoint
 */

interface PerformanceData {
  metric: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  timestamp: number
  url: string
  userAgent: string
  connection?: string
}

// Thresholds for Core Web Vitals
const thresholds = {
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
  CLS: { good: 0.1, poor: 0.25 },  // Cumulative Layout Shift
  INP: { good: 200, poor: 500 },   // Interaction to Next Paint
  TTFB: { good: 800, poor: 1800 }, // Time to First Byte
}

// Get rating based on threshold
function getRating(metric: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = thresholds[metric as keyof typeof thresholds]
  if (!threshold) return 'good'
  
  if (value <= threshold.good) return 'good'
  if (value <= threshold.poor) return 'needs-improvement'
  return 'poor'
}

// Get connection type
function getConnectionType(): string {
  const nav = navigator as any
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection
  
  if (!connection) return 'unknown'
  
  return connection.effectiveType || connection.type || 'unknown'
}

// Send metrics to analytics endpoint
async function sendToAnalytics(data: PerformanceData) {
  // Option 1: Send to your own analytics endpoint
  if (import.meta.env.VITE_ANALYTICS_ENDPOINT) {
    try {
      await fetch(import.meta.env.VITE_ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } catch (error) {
      console.error('Failed to send metrics:', error)
    }
  }
  
  // Option 2: Send to Google Analytics (free)
  if (typeof window.gtag !== 'undefined' && import.meta.env.VITE_GA_ID) {
    window.gtag('event', 'web_vitals', {
      event_category: 'Performance',
      event_label: data.metric,
      value: Math.round(data.value),
      metric_rating: data.rating,
      non_interaction: true,
    })
  }
  
  // Option 3: Log to console in development
  if (import.meta.env.DEV) {
    console.log(`[Web Vitals] ${data.metric}:`, {
      value: data.value,
      rating: data.rating,
    })
  }
  
  // Option 4: Send to Sentry as custom event
  if (data.rating === 'poor') {
    captureMessage(`Poor ${data.metric}: ${data.value}`, 'warning')
  }
}

// Handle metric reporting
function handleMetric(metric: Metric) {
  const data: PerformanceData = {
    metric: metric.name,
    value: metric.value,
    rating: getRating(metric.name, metric.value),
    timestamp: Date.now(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    connection: getConnectionType(),
  }
  
  // Batch metrics to reduce requests
  batchMetrics(data)
}

// Batch metrics to send together
let metricsBuffer: PerformanceData[] = []
let flushTimeout: NodeJS.Timeout | null = null

function batchMetrics(data: PerformanceData) {
  metricsBuffer.push(data)
  
  // Clear existing timeout
  if (flushTimeout) {
    clearTimeout(flushTimeout)
  }
  
  // Flush after 5 seconds or when buffer reaches 10 items
  if (metricsBuffer.length >= 10) {
    flushMetrics()
  } else {
    flushTimeout = setTimeout(flushMetrics, 5000)
  }
}

function flushMetrics() {
  if (metricsBuffer.length === 0) return
  
  // Send all buffered metrics
  metricsBuffer.forEach(sendToAnalytics)
  
  // Clear buffer
  metricsBuffer = []
  flushTimeout = null
}

// Initialize Web Vitals monitoring
export function initPerformanceMonitoring() {
  // Core Web Vitals
  onLCP(handleMetric)  // Largest Contentful Paint
  onFCP(handleMetric)  // First Contentful Paint
  onCLS(handleMetric)  // Cumulative Layout Shift
  onINP(handleMetric)  // Interaction to Next Paint
  onTTFB(handleMetric) // Time to First Byte
  
  // Flush metrics on page unload
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushMetrics()
    }
  })
  
  // Additional custom metrics
  measureCustomMetrics()
}

// Custom performance metrics
function measureCustomMetrics() {
  // Time to Interactive
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'measure') {
            handleMetric({
              name: ('custom-' + entry.name) as any,
              value: entry.duration,
              delta: entry.duration,
              id: entry.name,
              entries: [],
              rating: getRating('custom', entry.duration) as any,
              navigationType: 'navigate',
            })
          }
        }
      })
      
      observer.observe({ entryTypes: ['measure'] })
    } catch (error) {
      console.error('PerformanceObserver error:', error)
    }
  }
  
  // Resource timing
  if (performance.getEntriesByType) {
    const resources = performance.getEntriesByType('resource')
    const slowResources = resources
      .filter(r => r.duration > 1000)
      .slice(0, 5) // Top 5 slowest
    
    slowResources.forEach(resource => {
      console.warn(`Slow resource: ${resource.name} (${Math.round(resource.duration)}ms)`)
    })
  }
}

// Performance marks for custom measurements
export function markStart(name: string) {
  if ('performance' in window) {
    performance.mark(`${name}-start`)
  }
}

export function markEnd(name: string) {
  if ('performance' in window) {
    performance.mark(`${name}-end`)
    try {
      performance.measure(name, `${name}-start`, `${name}-end`)
    } catch (error) {
      console.error(`Failed to measure ${name}:`, error)
    }
  }
}

// React component render tracking
export function measureComponentRender(componentName: string) {
  return {
    start: () => markStart(`render-${componentName}`),
    end: () => markEnd(`render-${componentName}`),
  }
}

// API call performance tracking
export function measureApiCall(endpoint: string) {
  const start = performance.now()
  
  return {
    end: () => {
      const duration = performance.now() - start
      handleMetric({
        name: 'api-call' as any,
        value: duration,
        delta: duration,
        id: endpoint,
        entries: [],
        rating: getRating('api', duration) as any,
        navigationType: 'navigate',
      })
    }
  }
}

// Export performance report
export function getPerformanceReport() {
  const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
  
  return {
    // Navigation timing
    dns: navTiming.domainLookupEnd - navTiming.domainLookupStart,
    tcp: navTiming.connectEnd - navTiming.connectStart,
    ttfb: navTiming.responseStart - navTiming.requestStart,
    download: navTiming.responseEnd - navTiming.responseStart,
    domParse: navTiming.domInteractive - navTiming.responseEnd,
    domContentLoaded: navTiming.domContentLoadedEventEnd - navTiming.domContentLoadedEventStart,
    load: navTiming.loadEventEnd - navTiming.loadEventStart,
    
    // Memory usage (if available)
    memory: (performance as any).memory ? {
      used: (performance as any).memory.usedJSHeapSize / 1048576, // MB
      total: (performance as any).memory.totalJSHeapSize / 1048576, // MB
      limit: (performance as any).memory.jsHeapSizeLimit / 1048576, // MB
    } : null,
    
    // Connection info
    connection: getConnectionType(),
  }
}