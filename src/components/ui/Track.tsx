import React from 'react';

export interface TrackProps extends React.HTMLAttributes<HTMLDivElement> {
  progress?: number;
  size?: 'sm' | 'md' | 'lg';
  indeterminate?: boolean;
}

const sizes = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export const Track = React.forwardRef<HTMLDivElement, TrackProps>(
  ({ progress = 0, size = 'md', indeterminate = false, className = '', ...props }, ref) => {
    // clamp progress between 0 and 100, handle NaN
    const clampedProgress = Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0;

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : clampedProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        className={`w-full overflow-hidden rounded-full bg-border ${sizes[size]} ${className}`.trim()}
        {...props}
      >
        <div
          className={`h-full bg-accent-solid ${
            indeterminate 
              ? 'w-full animate-pulse' 
              : 'transition-all duration-300 ease-in-out'
          }`}
          style={indeterminate ? undefined : { width: `${clampedProgress}%` }}
        />
      </div>
    );
  }
);

Track.displayName = 'Track';
