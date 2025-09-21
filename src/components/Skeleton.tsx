import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse'
}) => {
  const baseClasses = 'bg-gray-200 dark:bg-gray-700';
  
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md'
  };
  
  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: ''
  };
  
  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || (variant === 'text' ? '1rem' : '100%')
  };
  
  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
};

export const TeacherCardSkeleton: React.FC = () => (
  <div className="card bg-base-100 dark:bg-gray-800 shadow-md dark:shadow-gray-900/50">
    <div className="card-body p-4">
      <div className="flex items-start gap-4">
        <Skeleton variant="circular" width={64} height={64} />
        <div className="flex-1">
          <Skeleton variant="text" height={24} className="mb-2" />
          <Skeleton variant="text" width="60%" height={16} className="mb-2" />
          <div className="flex items-center gap-2 mt-2">
            <Skeleton variant="rectangular" width={100} height={20} />
            <Skeleton variant="text" width={60} height={16} />
          </div>
        </div>
      </div>
      <Skeleton variant="text" height={48} className="mt-3" />
      <div className="flex gap-2 mt-4">
        <Skeleton variant="rectangular" width={100} height={32} />
        <Skeleton variant="rectangular" width={80} height={32} />
      </div>
    </div>
  </div>
);

export const TeacherListSkeleton: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <TeacherCardSkeleton key={i} />
    ))}
  </div>
);

export const ProfileSkeleton: React.FC = () => (
  <div className="card bg-base-100 dark:bg-gray-800 shadow dark:shadow-gray-900/50">
    <div className="card-body">
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" width={96} height={96} />
        <div className="flex-1">
          <Skeleton variant="text" width="50%" height={32} className="mb-2" />
          <Skeleton variant="text" width="30%" height={20} className="mb-2" />
          <Skeleton variant="text" width="40%" height={20} />
        </div>
      </div>
      <div className="mt-6">
        <Skeleton variant="text" width={100} height={24} className="mb-2" />
        <Skeleton variant="rectangular" height={80} />
      </div>
    </div>
  </div>
);

export const FormSkeleton: React.FC = () => (
  <div className="space-y-4">
    <div>
      <Skeleton variant="text" width={100} height={20} className="mb-2" />
      <Skeleton variant="rectangular" height={40} />
    </div>
    <div>
      <Skeleton variant="text" width={100} height={20} className="mb-2" />
      <Skeleton variant="rectangular" height={40} />
    </div>
    <div className="flex justify-end gap-2">
      <Skeleton variant="rectangular" width={100} height={40} />
      <Skeleton variant="rectangular" width={100} height={40} />
    </div>
  </div>
);