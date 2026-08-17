import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', interactive = false, ...props }, ref) => {
    const baseClasses = 'bg-bg-surface border border-border rounded-card';
    const interactiveClasses = interactive 
      ? 'hover:border-border-active hover:bg-bg-surface/80 transition-colors cursor-pointer' 
      : '';

    return (
      <div 
        ref={ref}
        className={`${baseClasses} ${interactiveClasses} ${className}`.trim()}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';
