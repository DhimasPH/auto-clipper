import React, { ReactNode, useId } from 'react';
import { LucideIcon } from 'lucide-react';

export interface InputGroupProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: LucideIcon;
  helperText?: ReactNode;
  error?: boolean;
}

export const InputGroup: React.FC<InputGroupProps> = ({
  label,
  icon: Icon,
  helperText,
  error,
  className = '',
  id,
  ...props
}) => {
  const autoId = useId();
  const inputId = id || autoId;
  const helpId = `${inputId}-help`;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-label text-text-primary">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="pointer-events-none absolute left-3 text-text-secondary">
            <Icon className="w-5 h-5" aria-hidden="true" />
          </div>
        )}
        <input
          id={inputId}
          aria-invalid={error || undefined}
          aria-describedby={helperText ? helpId : undefined}
          className={`w-full min-h-[44px] bg-bg-secondary border ${
            error ? 'border-error focus:ring-error' : 'border-border-active focus:border-accent focus:ring-accent'
          } rounded-input py-2 ${Icon ? 'pl-10' : 'pl-3'} pr-3 text-body text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-1 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed`}
          {...props}
        />
      </div>
      {helperText && (
        <p id={helpId} className={`text-caption ${error ? 'text-error' : 'text-text-secondary'}`}>
          {helperText}
        </p>
      )}
    </div>
  );
};
