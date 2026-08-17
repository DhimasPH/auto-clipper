import React from 'react';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={`bg-bg-secondary border border-border rounded-card p-4 ${className}`.trim()}
        {...props}
      />
    );
  }
);

Panel.displayName = 'Panel';
