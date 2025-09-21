// Performance optimization utilities for better Core Web Vitals

// Preload critical resources
export function preloadCriticalResources() {
  // Preload fonts
  const fontUrls = [
    'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap'
  ];
  
  fontUrls.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = 'style';
    document.head.appendChild(link);
  });
  
  // Preconnect to external domains
  const domains = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://ui-avatars.com' // Avatar service
  ];
  
  domains.forEach(domain => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = domain;
    document.head.appendChild(link);
  });
}

// Lazy load images with native browser support
export function setupLazyLoading() {
  if ('loading' in HTMLImageElement.prototype) {
    // Native lazy loading is supported
    const images = document.querySelectorAll('img[data-src]');
    images.forEach(img => {
      const imgElement = img as HTMLImageElement;
      imgElement.src = imgElement.dataset.src || '';
      imgElement.loading = 'lazy';
    });
  } else {
    // Fallback to Intersection Observer
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          img.src = img.dataset.src || '';
          imageObserver.unobserve(img);
        }
      });
    });
    
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }
}

// Optimize First Contentful Paint (FCP)
export function optimizeFCP() {
  // Inline critical CSS
  const criticalCSS = `
    /* Critical CSS for above-the-fold content */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
    .loading { display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .loading-spinner { width: 40px; height: 40px; border: 3px solid #f3f4f6; border-top-color: #7c3aed; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;
  
  const style = document.createElement('style');
  style.textContent = criticalCSS;
  document.head.appendChild(style);
}

// Optimize Largest Contentful Paint (LCP)
export function optimizeLCP() {
  // Preload hero images
  const heroImage = document.querySelector('[data-hero-image]') as HTMLImageElement;
  if (heroImage?.src) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = heroImage.src;
    document.head.appendChild(link);
  }
}

// Reduce Cumulative Layout Shift (CLS)
export function reduceCLS() {
  // Set explicit dimensions for images
  document.querySelectorAll('img:not([width])').forEach(img => {
    const imgElement = img as HTMLImageElement;
    if (imgElement.naturalWidth && imgElement.naturalHeight) {
      imgElement.width = imgElement.naturalWidth;
      imgElement.height = imgElement.naturalHeight;
    }
  });
  
  // Reserve space for dynamic content
  const placeholders = document.querySelectorAll('[data-placeholder-height]');
  placeholders.forEach(element => {
    const el = element as HTMLElement;
    el.style.minHeight = el.dataset.placeholderHeight || '0';
  });
}

// Optimize First Input Delay (FID)
export function optimizeFID() {
  // Break up long tasks
  const breakLongTask = (callback: Function) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => callback());
    } else {
      setTimeout(() => callback(), 0);
    }
  };
  
  // Defer non-critical JavaScript
  document.querySelectorAll('script[data-defer]').forEach(script => {
    breakLongTask(() => {
      const newScript = document.createElement('script');
      newScript.src = (script as HTMLScriptElement).src;
      document.body.appendChild(newScript);
    });
  });
}

// Resource hints for faster navigation
export function setupResourceHints() {
  // Prefetch likely next pages
  const prefetchLinks = document.querySelectorAll('a[data-prefetch]');
  prefetchLinks.forEach(link => {
    const linkElement = link as HTMLAnchorElement;
    const prefetchLink = document.createElement('link');
    prefetchLink.rel = 'prefetch';
    prefetchLink.href = linkElement.href;
    document.head.appendChild(prefetchLink);
  });
  
  // DNS prefetch for external resources
  const dnsPrefetchDomains = [
    'https://fonts.googleapis.com',
    'https://www.google-analytics.com',
    'https://vitals.vercel-insights.com'
  ];
  
  dnsPrefetchDomains.forEach(domain => {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = domain;
    document.head.appendChild(link);
  });
}

// Web Vitals monitoring
export function monitorWebVitals() {
  if ('PerformanceObserver' in window) {
    // Monitor LCP
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        console.log('LCP:', entry.startTime);
        // Send to analytics
      }
    }).observe({ entryTypes: ['largest-contentful-paint'] });
    
    // Monitor FID
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const fidEntry = entry as any;
        console.log('FID:', fidEntry.processingStart - fidEntry.startTime);
        // Send to analytics
      }
    }).observe({ entryTypes: ['first-input'] });
    
    // Monitor CLS
    let clsValue = 0;
    new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const layoutShift = entry as any;
        if (!layoutShift.hadRecentInput) {
          clsValue += layoutShift.value;
          console.log('CLS:', clsValue);
          // Send to analytics
        }
      }
    }).observe({ entryTypes: ['layout-shift'] });
  }
}

// Initialize all optimizations
export function initializePerformanceOptimizations() {
  // Run immediately
  preloadCriticalResources();
  optimizeFCP();
  
  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupLazyLoading();
      optimizeLCP();
      reduceCLS();
      setupResourceHints();
    });
  } else {
    setupLazyLoading();
    optimizeLCP();
    reduceCLS();
    setupResourceHints();
  }
  
  // Run after page load
  window.addEventListener('load', () => {
    optimizeFID();
    monitorWebVitals();
  });
}