import React from 'react';

export interface TrackProps extends React.HTMLAttributes<HTMLDivElement> {
  progress: number;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export const Track = React.forwardRef<HTMLDivElement, TrackProps>(
  ({ progress, size = 'md', className = '', ...props }, ref) => {
    // clamp progress between 0 and 100
    const clampedProgress = Math.min(100, Math.max(0, progress));

    return (
      <div
        ref={ref}
        className={`w-full overflow-hidden rounded-full bg-bg-secondary ${sizes[size]} ${className}`.trim()}
        {...props}
      >
        <div
          className="h-full bg-accent-solid transition-all duration-300 ease-in-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    );
  }
);

Track.displayName = 'Track';
