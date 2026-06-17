import React, { useState, useEffect } from 'react';

interface AvatarImageProps {
  src?: string;
  name: string;
  size?: number;
  className?: string;
  designation?: string;
  institute?: string;
  /** 'eager' for above-the-fold avatars (e.g. the profile header); defaults to 'lazy'. */
  loading?: 'lazy' | 'eager';
}

export const AvatarImage = React.memo<AvatarImageProps>(({ 
  src, 
  name, 
  size = 64, 
  className = '',
  designation,
  institute,
  loading = 'lazy'
}) => {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Generate placeholder URL
  const placeholder = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=${size * 2}&bold=true`;
  
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

  useEffect(() => {
    if (!src) {
      setImgSrc(placeholder);
      setIsLoading(false);
      return;
    }

    // Check if it's an external university image
    const isExternalImage = src.includes('.edu.pk');

    if (isExternalImage) {
      // Use proxy for external images in production (Vercel deployment)
      const isProduction = window.location.hostname === 'teacherrank.vercel.app' ||
                          window.location.hostname.includes('vercel.app');

      if (isProduction) {
        const proxiedUrl = `/api/image-proxy?url=${encodeURIComponent(src)}`;
        setImgSrc(proxiedUrl);
      } else {
        // In development or other environments, try direct URL
        setImgSrc(src);
      }
    } else {
      // For other URLs (like ui-avatars), use directly
      setImgSrc(src);
    }
    
    setIsLoading(false);
  }, [src, placeholder]);

  if (isLoading) {
    return (
      <div 
        className={`rounded-full bg-gradient-to-br from-base-200 to-base-300 animate-pulse ${className}`}
        style={{ width: size, height: size }}
        aria-label={altText}
      />
    );
  }

  return (
    <div className={`relative rounded-full overflow-hidden ${className}`} style={{ width: size, height: size }}>
      {/* Always render placeholder as background */}
      <img
        src={placeholder}
        alt=""
        width={size}
        height={size}
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover"
        aria-hidden="true"
      />
      
      {/* Render actual image on top */}
      {imgSrc && (
        <img
          src={imgSrc}
          alt={altText}
          width={size}
          height={size}
          decoding="async"
          loading={loading}
          className="relative z-content w-full h-full object-cover rounded-full transition-opacity duration-300"
          style={{ opacity: 1 }}
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            // Hide the broken image, placeholder will show through
            img.style.opacity = '0';
            console.warn(`Failed to load avatar: ${imgSrc}`);
          }}
          onLoad={(e) => {
            const img = e.target as HTMLImageElement;
            // Make sure image is visible when loaded
            img.style.opacity = '1';
          }}
        />
      )}
    </div>
  );
});

AvatarImage.displayName = 'AvatarImage';