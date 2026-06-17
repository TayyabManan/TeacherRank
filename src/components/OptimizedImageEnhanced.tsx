import React, { useState, useEffect, useRef, useMemo } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  priority?: boolean;
  quality?: number;
  srcSet?: string;
  sizes?: string;
  placeholder?: 'blur' | 'empty' | 'custom';
  blurDataUrl?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Enhanced optimized image component with advanced features
 */
export const OptimizedImageEnhanced = React.memo<OptimizedImageProps>(({
  src,
  alt,
  className = '',
  width,
  height,
  loading = 'lazy',
  priority = false,
  quality = 75,
  placeholder = 'blur',
  blurDataUrl,
  srcSet,
  sizes,
  onLoad,
  onError
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Generate placeholder based on type
  const placeholderSrc = useMemo(() => {
    if (placeholder === 'custom' && blurDataUrl) {
      return blurDataUrl;
    }
    if (placeholder === 'blur') {
      // Generate a simple blur placeholder
      return `data:image/svg+xml;base64,${btoa(
        `<svg width="${width || 400}" height="${height || 300}" xmlns="http://www.w3.org/2000/svg">
          <filter id="blur">
            <feGaussianBlur stdDeviation="20"/>
          </filter>
          <rect width="100%" height="100%" fill="#f3f4f6" filter="url(#blur)"/>
        </svg>`
      )}`;
    }
    return undefined;
  }, [placeholder, blurDataUrl, width, height]);

  // Generate optimized srcSet if not provided
  const optimizedSrcSet = useMemo(() => {
    if (srcSet) return srcSet;
    if (!src || src.startsWith('data:')) return undefined;

    // Check if it's an external URL that supports transforms
    if (src.includes('supabase') || src.includes('cloudinary')) {
      const widths = [320, 640, 768, 1024, 1280, 1536];
      return widths
        .map(w => {
          const url = new URL(src);
          url.searchParams.set('width', w.toString());
          url.searchParams.set('quality', quality.toString());
          return `${url.toString()} ${w}w`;
        })
        .join(', ');
    }

    return undefined;
  }, [src, srcSet, quality]);

  // Generate sizes attribute if not provided
  const optimizedSizes = useMemo(() => {
    if (sizes) return sizes;
    return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';
  }, [sizes]);

  // Preload priority images
  useEffect(() => {
    if (priority && src) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      if (optimizedSrcSet) {
        link.imageSrcset = optimizedSrcSet;
      }
      if (optimizedSizes) {
        link.imageSizes = optimizedSizes;
      }
      document.head.appendChild(link);

      return () => {
        document.head.removeChild(link);
      };
    }
  }, [priority, src, optimizedSrcSet, optimizedSizes]);

  // Handle native lazy loading
  useEffect(() => {
    if (!imgRef.current || loading === 'eager') return;

    // Check if native lazy loading is supported
    if ('loading' in HTMLImageElement.prototype) {
      return; // Let native lazy loading handle it
    }

    // Fallback to Intersection Observer
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            delete img.dataset.src;
          }
          observer.unobserve(img);
        }
      },
      {
        rootMargin: '50px',
      }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, [loading]);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  };

  // Use picture element for format optimization
  if (!hasError && src) {
    return (
      <picture>
        {/* WebP version for supported browsers */}
        {!src.startsWith('data:') && !src.endsWith('.svg') && (
          <source
            type="image/webp"
            srcSet={optimizedSrcSet?.replace(/\.(jpg|jpeg|png)/g, '.webp')}
            sizes={optimizedSizes}
          />
        )}
        {/* AVIF version for newer browsers */}
        {!src.startsWith('data:') && !src.endsWith('.svg') && (
          <source
            type="image/avif"
            srcSet={optimizedSrcSet?.replace(/\.(jpg|jpeg|png)/g, '.avif')}
            sizes={optimizedSizes}
          />
        )}
        <img
          ref={imgRef}
          src={isLoading && placeholderSrc ? placeholderSrc : src}
          data-src={loading === 'lazy' && !('loading' in HTMLImageElement.prototype) ? src : undefined}
          alt={alt}
          width={width}
          height={height}
          loading={loading}
          decoding={priority ? 'sync' : 'async'}
          srcSet={optimizedSrcSet}
          sizes={optimizedSizes}
          className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
          onLoad={handleLoad}
          onError={handleError}
        />
      </picture>
    );
  }

  // Error state - show placeholder
  return (
    <div
      className={`${className} bg-base-300 flex items-center justify-center`}
      style={{ width, height }}
      role="img"
      aria-label={alt}
    >
      <svg
        className="w-12 h-12 text-base-content/30"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </div>
  );
});

OptimizedImageEnhanced.displayName = 'OptimizedImageEnhanced';

/**
 * Background image optimization component
 */
export const OptimizedBackgroundImage = React.memo<{
  src: string;
  className?: string;
  children?: React.ReactNode;
  overlay?: boolean;
  parallax?: boolean;
}>(({ src, className = '', children, overlay = false, parallax = false }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Preload background image
    const img = new Image();
    img.onload = () => setIsLoaded(true);
    img.src = src;
  }, [src]);

  useEffect(() => {
    if (!parallax || !containerRef.current) return;

    const handleScroll = () => {
      if (!containerRef.current) return;
      const scrolled = window.scrollY;
      const rate = scrolled * -0.5;
      containerRef.current.style.transform = `translateY(${rate}px)`;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [parallax]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{
        backgroundImage: isLoaded ? `url(${src})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: isLoaded ? undefined : '#f3f4f6',
      }}
    >
      {overlay && (
        <div className="absolute inset-0 bg-black bg-opacity-50" />
      )}
      {children && (
        <div className={`relative ${overlay ? 'z-content' : ''}`}>
          {children}
        </div>
      )}
    </div>
  );
});

OptimizedBackgroundImage.displayName = 'OptimizedBackgroundImage';

/**
 * Avatar component with automatic optimization
 */
export const OptimizedAvatar = React.memo<{
  name: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}>(({ name, src, size = 'md', className = '' }) => {
  const sizeMap = {
    xs: 24,
    sm: 32,
    md: 48,
    lg: 64,
    xl: 96,
  };

  const pixelSize = sizeMap[size];

  // Generate initials for fallback
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (src) {
    return (
      <OptimizedImageEnhanced
        src={src}
        alt={`${name} avatar`}
        width={pixelSize}
        height={pixelSize}
        className={`rounded-full object-cover ${className}`}
        priority={size === 'lg' || size === 'xl'}
        quality={80}
      />
    );
  }

  // Fallback to initials
  return (
    <div
      className={`rounded-full flex items-center justify-center font-semibold ${className}`}
      style={{
        width: pixelSize,
        height: pixelSize,
        backgroundColor: `hsl(${name.charCodeAt(0) * 137.5 % 360}, 50%, 50%)`,
        color: 'white',
        fontSize: pixelSize * 0.4,
      }}
      aria-label={`${name} avatar`}
    >
      {initials}
    </div>
  );
});

OptimizedAvatar.displayName = 'OptimizedAvatar';