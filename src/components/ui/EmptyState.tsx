import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon: Icon, title, description, action, className = '', ...props }, ref) => {
    return (
      <div 
        ref={ref}
        className={`flex flex-col items-center justify-center p-8 text-center ${className}`.trim()}
        {...props}
      >
        {Icon && (
          <div className="mb-4 text-text-muted">
            <Icon className="w-12 h-12" />
          </div>
        )}
        <h3 className="t-h4 text-text-primary mb-2">{title}</h3>
        {description && (
          <div className="t-body text-text-secondary max-w-md mx-auto mb-6">
            {description}
          </div>
        )}
        {action && (
          <div>
            {action}
          </div>
        )}
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';
