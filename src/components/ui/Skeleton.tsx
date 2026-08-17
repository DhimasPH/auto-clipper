import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className = '', width, height, borderRadius, style, ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={`animate-pulse bg-bg-surface rounded-md ${className}`.trim()}
        style={{
          width,
          height,
          borderRadius,
          ...style
        }}
        {...props}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';
