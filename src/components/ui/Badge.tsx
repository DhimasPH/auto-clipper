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
  // Opaque background: a translucent tint drops status text below 4.5:1 on the light page.
  const variants = {
    success: 'bg-bg-secondary text-success border border-success',
    error: 'bg-bg-secondary text-error border border-error',
    warning: 'bg-bg-secondary text-warning border border-warning',
    info: 'bg-bg-secondary text-info border border-info',
    neutral: 'bg-bg-surface text-text-secondary border border-border',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-badge text-caption font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};
