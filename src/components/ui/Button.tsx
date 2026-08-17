import React from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  leftIcon?: LucideIcon | React.ComponentType<{ className?: string }>;
  rightIcon?: LucideIcon | React.ComponentType<{ className?: string }>;
  iconOnly?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

const baseClasses =
  'inline-flex items-center justify-center font-medium rounded-button transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none select-none active:scale-[0.98]';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-accent-solid hover:bg-accent-hover text-white shadow-sm border border-transparent',
  secondary: 'bg-bg-surface hover:bg-bg-surface/80 text-text-primary border border-border shadow-sm',
  outline: 'bg-transparent hover:bg-bg-surface/50 text-text-primary border border-border hover:border-border-active shadow-sm',
  ghost: 'bg-transparent hover:bg-bg-surface text-text-secondary hover:text-text-primary border border-transparent',
  danger: 'bg-error/10 hover:bg-error/20 text-error border border-error/20',
};

const getSizes = (isIconOnly: boolean): Record<ButtonSize, string> => ({
  sm: isIconOnly ? 'p-1.5 w-8 h-8' : 't-caption px-2.5 py-1.5 gap-1.5 h-8',
  md: isIconOnly ? 'p-2 w-9 h-9' : 't-label px-3.5 py-2 gap-2 h-9',
  lg: isIconOnly ? 'p-2.5 w-11 h-11' : 't-body font-medium px-5 py-2.5 gap-2.5 h-11',
});

const iconSizes: Record<ButtonSize, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      icon,
      leftIcon,
      rightIcon,
      iconOnly = false,
      loading = false,
      fullWidth = false,
      className = '',
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isIconOnly = iconOnly || (!children && Boolean(icon || leftIcon || rightIcon));
    const LeadingIcon = leftIcon || icon;
    const TrailingIcon = rightIcon;

    if (isIconOnly && !props['aria-label'] && !props['aria-labelledby'] && !props.title) {
      console.warn('Button: icon-only buttons should have an aria-label or title for accessibility.');
    }

    const sizes = getSizes(isIconOnly);
    const widthClass = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        type={type}
        className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${widthClass} ${className}`}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <Loader2 className={`${iconSizes[size]} animate-spin shrink-0`} />
        ) : LeadingIcon ? (
          <LeadingIcon className={`${iconSizes[size]} shrink-0`} />
        ) : null}

        {!isIconOnly && children}

        {!isIconOnly && !loading && TrailingIcon && (
          <TrailingIcon className={`${iconSizes[size]} shrink-0`} />
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
