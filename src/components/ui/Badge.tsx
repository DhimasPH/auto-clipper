import React from 'react';

export interface BadgeProps {
  variant?: 'success' | 'error' | 'warning' | 'neutral' | 'info';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  className = ''
}) => {
  const variants = {
    success: 'bg-success/10 text-success border border-success/20',
    error: 'bg-error/10 text-error border border-error/20',
    warning: 'bg-warning/10 text-warning border border-warning/20',
    info: 'bg-info/10 text-info border border-info/20',
    neutral: 'bg-bg-surface text-text-secondary border border-border',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-badge text-caption font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};
