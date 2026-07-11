import React, { ReactNode } from 'react';
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
  const generatedId = id || Math.random().toString(36).substr(2, 9);
  
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={generatedId} className="text-label text-text-primary">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3 text-text-secondary">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <input
          id={generatedId}
          className={`w-full bg-bg-surface border ${
            error ? 'border-error' : 'border-border focus:border-accent'
          } rounded-input py-2 ${Icon ? 'pl-10' : 'pl-3'} pr-3 text-body text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 ${
            error ? 'focus:ring-error' : 'focus:ring-accent'
          } transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
          {...props}
        />
      </div>
      {helperText && (
        <p className={`text-caption ${error ? 'text-error' : 'text-text-secondary'}`}>
          {helperText}
        </p>
      )}
    </div>
  );
};
