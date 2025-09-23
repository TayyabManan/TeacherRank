/**
 * Comprehensive performance monitoring and optimization system
 */

import { onCLS, onFCP, onLCP, onTTFB, onINP, onFID, Metric } from 'web-vitals';

interface PerformanceMetrics {
  lcp?: number;
  fcp?: number;
  cls?: number;
  inp?: number;
  ttfb?: number;
  fid?: number;
  memory?: {
    used: number;
    total: number;
    limit: number;
  };
  resources?: {
    count: number;
    size: number;
    slowest: Array<{ name: string; duration: number }>;
  };
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {};
  private observers: Map<string, PerformanceObserver> = new Map();
  private reportCallbacks: Array<(metrics: PerformanceMetrics) => void> = [];

  constructor() {
    this.initWebVitals();
    this.initResourceMonitoring();
    this.initMemoryMonitoring();
    this.initLongTaskMonitoring();
  }

  /**
   * Initialize Core Web Vitals monitoring
   */
  private initWebVitals() {
    // Largest Contentful Paint
    onLCP((metric) => {
      this.metrics.lcp = metric.value;
      this.reportMetric('LCP', metric);
    });

    // First Contentful Paint
    onFCP((metric) => {
      this.metrics.fcp = metric.value;
      this.reportMetric('FCP', metric);
    });

    // Cumulative Layout Shift
    onCLS((metric) => {
      this.metrics.cls = metric.value;
      this.reportMetric('CLS', metric);
    });

    // Interaction to Next Paint
    onINP((metric) => {
      this.metrics.inp = metric.value;
      this.reportMetric('INP', metric);
    });

    // Time to First Byte
    onTTFB((metric) => {
      this.metrics.ttfb = metric.value;
      this.reportMetric('TTFB', metric);
    });

    // First Input Delay
    onFID((metric) => {
      this.metrics.fid = metric.value;
      this.reportMetric('FID', metric);
    });
  }

  /**
   * Monitor resource loading performance
   */
  private initResourceMonitoring() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const resources = entries.filter(e => e.entryType === 'resource') as PerformanceResourceTiming[];

        if (resources.length > 0) {
          const totalSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
          const slowest = resources
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 5)
            .map(r => ({ name: r.name, duration: r.duration }));

          this.metrics.resources = {
            count: resources.length,
            size: totalSize,
            slowest
          };

          // Warn about slow resources
          resources.forEach(resource => {
            if (resource.duration > 1000) {
              console.warn(`Slow resource: ${resource.name} took ${resource.duration.toFixed(0)}ms`);
            }
          });
        }
      });

      observer.observe({ entryTypes: ['resource'] });
      this.observers.set('resource', observer);
    } catch (error) {
      console.error('Failed to initialize resource monitoring:', error);
    }
  }

  /**
   * Monitor memory usage
   */
  private initMemoryMonitoring() {
    if (!('memory' in performance)) return;

    setInterval(() => {
      const memory = (performance as any).memory;
      this.metrics.memory = {
        used: memory.usedJSHeapSize / 1048576, // MB
        total: memory.totalJSHeapSize / 1048576, // MB
        limit: memory.jsHeapSizeLimit / 1048576, // MB
      };

      // Warn about high memory usage
      const percentUsed = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
      if (percentUsed > 80) {
        console.warn(`High memory usage: ${percentUsed.toFixed(1)}%`);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Monitor long tasks that block the main thread
   */
  private initLongTaskMonitoring() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            console.warn(`Long task detected: ${entry.duration.toFixed(0)}ms`, {
              name: entry.name,
              startTime: entry.startTime,
            });

            // Report to analytics
            this.reportLongTask(entry);
          }
        }
      });

      observer.observe({ entryTypes: ['longtask'] });
      this.observers.set('longtask', observer);
    } catch (error) {
      // Long task API might not be available
    }
  }

  /**
   * Report metric to analytics
   */
  private reportMetric(name: string, metric: Metric) {
    const rating = this.getRating(name, metric.value);

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${name}] ${metric.value.toFixed(0)}ms (${rating})`);
    }

    // Send to analytics
    if (typeof window.gtag !== 'undefined') {
      window.gtag('event', 'web_vitals', {
        event_category: 'Performance',
        event_label: name,
        value: Math.round(metric.value),
        metric_rating: rating,
        non_interaction: true,
      });
    }

    // Call registered callbacks
    this.reportCallbacks.forEach(callback => callback(this.metrics));
  }

  /**
   * Report long task
   */
  private reportLongTask(entry: PerformanceEntry) {
    if (typeof window.gtag !== 'undefined') {
      window.gtag('event', 'long_task', {
        event_category: 'Performance',
        event_label: 'Long Task',
        value: Math.round(entry.duration),
        non_interaction: true,
      });
    }
  }

  /**
   * Get rating for metric value
   */
  private getRating(metric: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds: Record<string, { good: number; poor: number }> = {
      LCP: { good: 2500, poor: 4000 },
      FCP: { good: 1800, poor: 3000 },
      CLS: { good: 0.1, poor: 0.25 },
      INP: { good: 200, poor: 500 },
      TTFB: { good: 800, poor: 1800 },
      FID: { good: 100, poor: 300 },
    };

    const threshold = thresholds[metric];
    if (!threshold) return 'good';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Register callback for metric updates
   */
  onMetricsUpdate(callback: (metrics: PerformanceMetrics) => void) {
    this.reportCallbacks.push(callback);
  }

  /**
   * Clean up observers
   */
  destroy() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.reportCallbacks = [];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Performance optimization utilities
 */
export const performanceUtils = {
  /**
   * Measure component render time
   */
  measureRender(componentName: string) {
    const startMark = `${componentName}-render-start`;
    const endMark = `${componentName}-render-end`;
    const measureName = `${componentName}-render`;

    return {
      start: () => performance.mark(startMark),
      end: () => {
        performance.mark(endMark);
        performance.measure(measureName, startMark, endMark);
        const measure = performance.getEntriesByName(measureName).pop();
        if (measure) {
          if (measure.duration > 16) {
            console.warn(`Slow render: ${componentName} took ${measure.duration.toFixed(2)}ms`);
          }
          // Clean up marks
          performance.clearMarks(startMark);
          performance.clearMarks(endMark);
          performance.clearMeasures(measureName);
        }
      }
    };
  },

  /**
   * Defer non-critical work
   */
  defer(callback: () => void) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(callback, { timeout: 2000 });
    } else {
      setTimeout(callback, 0);
    }
  },

  /**
   * Schedule work in chunks to avoid blocking
   */
  async chunk<T>(items: T[], processor: (item: T) => void, chunkSize = 10) {
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      chunk.forEach(processor);

      // Yield to main thread
      await new Promise(resolve => {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => resolve(undefined));
        } else {
          setTimeout(resolve, 0);
        }
      });
    }
  },

  /**
   * Debounce function calls
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  /**
   * Throttle function calls
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Memoize expensive computations
   */
  memoize<T extends (...args: any[]) => any>(
    func: T,
    getKey?: (...args: Parameters<T>) => string
  ): T {
    const cache = new Map();
    return ((...args: Parameters<T>) => {
      const key = getKey ? getKey(...args) : JSON.stringify(args);
      if (cache.has(key)) {
        return cache.get(key);
      }
      const result = func(...args);
      cache.set(key, result);
      return result;
    }) as T;
  }
};

/**
 * React performance hook
 */
export function usePerformanceMetrics() {
  const [metrics, setMetrics] = React.useState<PerformanceMetrics>({});

  React.useEffect(() => {
    const updateMetrics = (newMetrics: PerformanceMetrics) => {
      setMetrics(newMetrics);
    };

    performanceMonitor.onMetricsUpdate(updateMetrics);

    return () => {
      // Cleanup would go here if we had a way to unregister
    };
  }, []);

  return metrics;
}