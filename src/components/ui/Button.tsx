import React from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading = false,
  fullWidth = false,
  className = '',
  disabled,
  ...props
}, ref) => {
  const baseClasses =
    'inline-flex items-center justify-center gap-2 rounded-button text-label transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-accent hover:bg-accent-hover text-on-accent font-semibold',
    outline: 'border border-border-active bg-bg-secondary hover:bg-bg-surface text-text-primary',
    ghost: 'hover:bg-bg-surface text-text-primary',
    danger: 'border border-error text-error bg-bg-secondary hover:bg-bg-surface',
  };

  // Every size keeps a 44 px touch target (spec 4.6); icon-only buttons are 44 x 44.
  const sizes = {
    sm: 'min-h-[44px] px-3',
    md: 'min-h-[44px] px-4',
    lg: 'min-h-[52px] px-6 text-body font-semibold',
  };
  const iconOnly = !children ? 'min-w-[44px] !px-0' : '';
  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      ref={ref}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${iconOnly} ${widthClass} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
      ) : Icon ? (
        <Icon className="w-5 h-5" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
});

Button.displayName = 'Button';
