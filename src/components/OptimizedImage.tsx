import React, { useState, useEffect, useRef } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  placeholder?: string;
  srcSet?: string;
  sizes?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export const OptimizedImage = React.memo<OptimizedImageProps>(({
  src,
  alt,
  className = '',
  width,
  height,
  loading = 'lazy',
  placeholder,
  srcSet,
  sizes,
  onLoad,
  onError
}) => {
  const [imageSrc, setImageSrc] = useState(placeholder || '');
  const [imageError, setImageError] = useState(false);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Generate placeholder if not provided
  const getPlaceholder = () => {
    if (placeholder) return placeholder;
    // For avatar images, generate UI Avatars placeholder
    if (alt.includes('avatar') || className.includes('avatar')) {
      return `https://ui-avatars.com/api/?name=${encodeURIComponent(alt)}&background=random&size=${width || 128}`;
    }
    // For other images, use a simple SVG placeholder
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width || 400} ${height || 300}'%3E%3Crect fill='%23f3f4f6' width='100%25' height='100%25'/%3E%3C/svg%3E`;
  };

  useEffect(() => {
    if (!src) {
      setImageSrc(getPlaceholder());
      return;
    }

    // For eager loading, load immediately
    if (loading === 'eager') {
      setImageSrc(src);
      return;
    }

    // Set up Intersection Observer for lazy loading
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px', // Start loading 50px before the image enters viewport
        threshold: 0.01
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [src, loading]);

  // Load the actual image when it's in viewport
  useEffect(() => {
    if (isIntersecting && src) {
      const img = new Image();
      
      img.onload = () => {
        setImageSrc(src);
        setImageError(false);
        onLoad?.();
      };
      
      img.onerror = () => {
        console.warn(`Failed to load image: ${src}`);
        setImageError(true);
        setImageSrc(getPlaceholder());
        onError?.();
      };
      
      // Set srcset if provided
      if (srcSet) {
        img.srcset = srcSet;
      }
      
      img.src = src;
    }
  }, [isIntersecting, src, srcSet, onLoad, onError]);

  // Initialize with placeholder
  useEffect(() => {
    if (!imageSrc && !src) {
      setImageSrc(getPlaceholder());
    }
  }, []);

  return (
    <img
      ref={imgRef}
      src={imageSrc || getPlaceholder()}
      alt={alt}
      className={`${className} ${imageError ? 'opacity-50' : ''} transition-opacity duration-300`}
      width={width}
      height={height}
      srcSet={srcSet && imageSrc === src ? srcSet : undefined}
      sizes={sizes}
      loading={loading}
      decoding="async"
      onError={(e) => {
        if (!imageError) {
          console.warn(`Image failed to load in img tag: ${(e.target as HTMLImageElement).src}`);
          setImageError(true);
          setImageSrc(getPlaceholder());
          onError?.();
        }
      }}
    />
  );
});

OptimizedImage.displayName = 'OptimizedImage';

// Helper component for avatar images with common settings
export const AvatarImage = React.memo<{
  src?: string;
  name: string;
  size?: number;
  className?: string;
  designation?: string;
  institute?: string;
}>(({ src, name, size = 64, className = '', designation, institute }) => {
  // Create descriptive alt text
  let altText = `${name}`;
  if (designation && institute) {
    altText = `${name} - ${designation} at ${institute}`;
  } else if (designation) {
    altText = `${name} - ${designation}`;
  } else if (institute) {
    altText = `${name} at ${institute}`;
  }
  altText += ' profile picture';
  
  // PRODUCTION FIX: If we have a database URL, use it directly without any fallback
  // This prevents the refresh issue in production
  if (src) {
    return (
      <img
        src={src}
        alt={altText}
        className={`rounded-full object-cover ${className}`}
        width={size}
        height={size}
        loading="eager"
        // Remove onError handler - let the image fail silently if needed
        // This prevents the placeholder from replacing the actual image
      />
    );
  }
  
  // Only use placeholder when there's no src at all
  const placeholder = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=${size}`;
  return (
    <img
      src={placeholder}
      alt={altText}
      className={`rounded-full object-cover ${className}`}
      width={size}
      height={size}
      loading="eager"
    />
  );
});

AvatarImage.displayName = 'AvatarImage';