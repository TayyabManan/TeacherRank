/**
 * Memory optimization hooks and utilities
 */

import { useEffect, useRef, useCallback, useState, DependencyList } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Cleanup hook to prevent memory leaks
 */
export function useCleanup(cleanup: () => void, deps: DependencyList = []) {
  const cleanupRef = useRef(cleanup);
  cleanupRef.current = cleanup;

  useEffect(() => {
    return () => {
      cleanupRef.current();
    };
  }, deps);
}

/**
 * Abort controller hook for cancellable requests
 */
export function useAbortController() {
  const abortControllerRef = useRef<AbortController>();

  useEffect(() => {
    abortControllerRef.current = new AbortController();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const getSignal = useCallback(() => {
    if (!abortControllerRef.current) {
      abortControllerRef.current = new AbortController();
    }
    return abortControllerRef.current.signal;
  }, []);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
  }, []);

  return { getSignal, abort };
}

/**
 * Memory monitoring hook
 */
export function useMemoryMonitor(threshold = 50) {
  useEffect(() => {
    if (!('memory' in performance)) return;

    const checkMemory = () => {
      const memory = (performance as any).memory;
      const usedMB = memory.usedJSHeapSize / 1048576;
      const totalMB = memory.totalJSHeapSize / 1048576;
      const percentUsed = (usedMB / totalMB) * 100;

      if (percentUsed > threshold) {
        console.warn(`High memory usage: ${usedMB.toFixed(2)}MB (${percentUsed.toFixed(1)}%)`);

        // Trigger garbage collection if available (Chrome DevTools)
        if ('gc' in window) {
          (window as any).gc();
        }
      }
    };

    const interval = setInterval(checkMemory, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [threshold]);
}

/**
 * WeakMap cache for component-specific data
 */
const componentCache = new WeakMap();

export function useWeakCache<T>(key: object, initialValue: T): [T, (value: T) => void] {
  const getValue = useCallback(() => {
    return componentCache.has(key) ? componentCache.get(key) : initialValue;
  }, [key, initialValue]);

  const setValue = useCallback((value: T) => {
    componentCache.set(key, value);
  }, [key]);

  return [getValue(), setValue];
}

/**
 * Optimized event listener hook that prevents memory leaks
 */
export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  element: Window | HTMLElement | null = window,
  options?: AddEventListenerOptions
) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!element || !element.addEventListener) return;

    const eventListener = (event: Event) => {
      savedHandler.current(event as WindowEventMap[K]);
    };

    element.addEventListener(eventName, eventListener, options);

    return () => {
      element.removeEventListener(eventName, eventListener, options);
    };
  }, [eventName, element, options]);
}

/**
 * Intersection Observer hook with cleanup
 */
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options: IntersectionObserverInit = {},
  callback: (entry: IntersectionObserverEntry) => void
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => callbackRef.current(entry));
      },
      options
    );

    observer.observe(ref.current);

    return () => {
      observer.disconnect();
    };
  }, [ref, options.root, options.rootMargin, options.threshold]);
}

/**
 * Query cache garbage collection
 */
export function useQueryGarbageCollection(queryClient: ReturnType<typeof useQueryClient>) {
  useEffect(() => {
    // Run garbage collection every 5 minutes
    const interval = setInterval(() => {
      // Remove stale queries
      queryClient.removeQueries({
        predicate: (query) => {
          const isStale = query.state.dataUpdateCount === 0 &&
                         query.state.fetchStatus === 'idle' &&
                         Date.now() - query.state.dataUpdatedAt > 10 * 60 * 1000; // 10 minutes
          return isStale;
        },
      });

      // Clear unused mutation cache
      queryClient.getMutationCache().clear();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [queryClient]);
}

/**
 * Prevent re-renders with stable callbacks
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback(
    (...args: Parameters<T>) => callbackRef.current(...args),
    []
  ) as T;
}

/**
 * Detect and log unnecessary re-renders (development only)
 */
export function useWhyDidYouUpdate(name: string, props: Record<string, any>) {
  if (process.env.NODE_ENV === 'production') return;

  const previousProps = useRef<Record<string, any>>();

  useEffect(() => {
    if (previousProps.current) {
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      const changedProps: Record<string, any> = {};

      allKeys.forEach(key => {
        if (previousProps.current![key] !== props[key]) {
          changedProps[key] = {
            from: previousProps.current![key],
            to: props[key]
          };
        }
      });

      if (Object.keys(changedProps).length) {
        console.log('[why-did-you-update]', name, changedProps);
      }
    }

    previousProps.current = props;
  });
}

/**
 * Virtual scrolling configuration for large lists
 */
export const virtualScrollConfig = {
  // Estimated item size for better scrollbar accuracy
  estimateSize: () => 100,
  // Overscan to render items outside viewport
  overscan: 5,
  // Scroll margin for smoother scrolling
  scrollMargin: 0,
  // Measure element for dynamic sizing
  measureElement: (el: HTMLElement) => el.getBoundingClientRect().height,
};

/**
 * Memory-efficient image loading
 */
export function useLazyImageLoader(imageUrls: string[], batchSize = 5) {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const loadingRef = useRef(false);

  const loadBatch = useCallback(async (urls: string[]) => {
    const promises = urls.map(url => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          setLoadedImages((prev: Set<string>) => new Set([...prev, url]));
          resolve();
        };
        img.onerror = () => resolve();
        img.src = url;
      });
    });

    await Promise.all(promises);
  }, []);

  useEffect(() => {
    if (loadingRef.current) return;

    const unloadedImages = imageUrls.filter(url => !loadedImages.has(url));
    if (unloadedImages.length === 0) return;

    loadingRef.current = true;

    const loadImages = async () => {
      for (let i = 0; i < unloadedImages.length; i += batchSize) {
        const batch = unloadedImages.slice(i, i + batchSize);
        await loadBatch(batch);
        // Add delay between batches to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      loadingRef.current = false;
    };

    loadImages();
  }, [imageUrls, loadedImages, batchSize, loadBatch]);

  return loadedImages;
}