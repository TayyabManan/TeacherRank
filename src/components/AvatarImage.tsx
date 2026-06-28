import React, { useState, useEffect } from 'react';
import { InitialsAvatar } from './InitialsAvatar';

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
  const [errored, setErrored] = useState(false);

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
    setErrored(false);

    if (!src) {
      setImgSrc('');
      return;
    }

    // Check if it's an external university image
    const isExternalImage = src.includes('.edu.pk');

    if (isExternalImage) {
      // Use proxy for external images in production (Vercel deployment)
      const isProduction = window.location.hostname === 'teacherrank.vercel.app' ||
                          window.location.hostname.includes('vercel.app');

      setImgSrc(isProduction ? `/api/image-proxy?url=${encodeURIComponent(src)}` : src);
    } else {
      // For other URLs, use directly
      setImgSrc(src);
    }
  }, [src]);

  const showInitials = !src || errored || !imgSrc;

  return (
    <div
      className={`relative rounded-full overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      {...(showInitials ? { role: 'img', 'aria-label': altText } : {})}
    >
      {/* Initials fallback sits underneath, so there's never a blank flash and a
          broken/slow photo degrades to it gracefully. No network request. */}
      <InitialsAvatar name={name} size={size} className="absolute inset-0" />

      {!showInitials && (
        <img
          src={imgSrc}
          alt={altText}
          width={size}
          height={size}
          decoding="async"
          loading={loading}
          className="relative z-content w-full h-full object-cover rounded-full transition-opacity duration-300"
          onError={() => {
            console.warn(`Failed to load avatar: ${imgSrc}`);
            setErrored(true);
          }}
        />
      )}
    </div>
  );
});

AvatarImage.displayName = 'AvatarImage';
