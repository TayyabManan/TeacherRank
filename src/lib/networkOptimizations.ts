/**
 * Network optimization utilities
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Request deduplication and batching
 */
class RequestBatcher {
  private pending = new Map<string, Promise<any>>();
  private batch: Array<{ key: string; resolver: Function }> = [];
  private batchTimer: NodeJS.Timeout | null = null;

  /**
   * Deduplicate identical requests
   */
  async dedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    // If request is already pending, return the same promise
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    // Create new request
    const promise = fetcher()
      .finally(() => {
        // Clean up after request completes
        this.pending.delete(key);
      });

    this.pending.set(key, promise);
    return promise;
  }

  /**
   * Batch multiple requests into a single network call
   */
  batch<T>(key: string, resolver: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.batch.push({ key, resolver: resolve });

      // Clear existing timer
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }

      // Process batch after 10ms or when batch size reaches 10
      if (this.batch.length >= 10) {
        this.processBatch();
      } else {
        this.batchTimer = setTimeout(() => this.processBatch(), 10);
      }
    });
  }

  private processBatch() {
    const currentBatch = [...this.batch];
    this.batch = [];
    this.batchTimer = null;

    // Process all batched requests
    currentBatch.forEach(({ resolver }) => {
      resolver();
    });
  }
}

export const requestBatcher = new RequestBatcher();

/**
 * Optimized fetch with retry and timeout
 */
export async function optimizedFetch(
  url: string,
  options: RequestInit & {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
  } = {}
): Promise<Response> {
  const {
    timeout = 10000,
    retries = 2,
    retryDelay = 1000,
    ...fetchOptions
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok && attempt < retries) {
        // Retry on server errors
        if (response.status >= 500) {
          throw new Error(`Server error: ${response.status}`);
        }
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      // Don't retry on client errors or abort
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${timeout}ms`);
        }
        if (error.message.includes('4')) {
          throw error; // Don't retry 4xx errors
        }
      }

      // Wait before retry
      if (attempt < retries) {
        await new Promise(resolve =>
          setTimeout(resolve, retryDelay * Math.pow(2, attempt))
        );
      }
    }
  }

  throw lastError || new Error('Request failed');
}

/**
 * Prefetch strategy for React Query
 */
export function setupPrefetchingStrategy(queryClient: QueryClient) {
  // Prefetch on hover with delay
  let hoverTimer: NodeJS.Timeout;

  document.addEventListener('mouseover', (e) => {
    const link = (e.target as HTMLElement).closest('a[data-prefetch]');
    if (!link) return;

    const href = (link as HTMLAnchorElement).href;
    const teacherId = href.match(/teacher\/([^/]+)/)?.[1];

    if (teacherId) {
      hoverTimer = setTimeout(() => {
        queryClient.prefetchQuery({
          queryKey: ['teacher', teacherId],
          queryFn: async () => {
            // Fetch teacher data
            const response = await optimizedFetch(`/api/teachers/${teacherId}`);
            return response.json();
          },
          staleTime: 5 * 60 * 1000, // 5 minutes
        });
      }, 200); // 200ms delay to avoid accidental hovers
    }
  });

  document.addEventListener('mouseout', (e) => {
    const link = (e.target as HTMLElement).closest('a[data-prefetch]');
    if (link && hoverTimer) {
      clearTimeout(hoverTimer);
    }
  });

  // Prefetch visible links using Intersection Observer
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const link = entry.target as HTMLAnchorElement;
          const href = link.href;
          const teacherId = href.match(/teacher\/([^/]+)/)?.[1];

          if (teacherId) {
            // Prefetch with low priority
            requestIdleCallback(() => {
              queryClient.prefetchQuery({
                queryKey: ['teacher', teacherId],
                queryFn: async () => {
                  const response = await optimizedFetch(`/api/teachers/${teacherId}`);
                  return response.json();
                },
                staleTime: 10 * 60 * 1000, // 10 minutes
              });
            });
          }
        }
      });
    },
    {
      rootMargin: '50px',
      threshold: 0.01,
    }
  );

  // Observe all prefetchable links
  document.querySelectorAll('a[data-prefetch]').forEach((link) => {
    observer.observe(link);
  });

  return observer;
}

/**
 * HTTP/2 Server Push hints generator
 * Add these headers to your server response
 */
export function generateServerPushHeaders(route: string): string[] {
  const headers: string[] = [];

  // Push critical CSS
  headers.push('Link: </assets/css/main.css>; rel=preload; as=style');

  // Push critical fonts
  headers.push('Link: </assets/fonts/inter.woff2>; rel=preload; as=font; crossorigin');

  // Route-specific pushes
  if (route === '/') {
    // Push teacher listing bundle
    headers.push('Link: </assets/js/teacher-listing.js>; rel=preload; as=script');
  } else if (route.startsWith('/teacher/')) {
    // Push teacher profile bundle
    headers.push('Link: </assets/js/teacher-profile.js>; rel=preload; as=script');
  }

  return headers;
}

/**
 * Service Worker for offline caching
 */
export const serviceWorkerCode = `
// Service Worker with optimized caching strategies
const CACHE_NAME = 'teacher-rank-v1';
const STATIC_CACHE = 'static-v1';
const DYNAMIC_CACHE = 'dynamic-v1';

// Static assets to cache
const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/favicon.svg',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API calls - network first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached response on network failure
          return caches.match(request);
        })
    );
    return;
  }

  // Static assets - cache first
  if (request.url.match(/\\.(js|css|woff2?|png|jpg|svg)$/)) {
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).then((fetchResponse) => {
          return caches.open(STATIC_CACHE).then((cache) => {
            cache.put(request, fetchResponse.clone());
            return fetchResponse;
          });
        });
      })
    );
    return;
  }

  // HTML pages - network first
  event.respondWith(
    fetch(request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(request).then((response) => {
          return response || caches.match('/offline.html');
        });
      })
  );
});
`;