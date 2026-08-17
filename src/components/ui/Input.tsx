import React, { useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  errorText?: React.ReactNode;
  helperText?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, errorText, helperText, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const helperId = `${inputId}-helper`;
    const errorId = `${inputId}-error`;

    const isError = error || !!errorText;
    const describedBy = isError ? errorId : helperText ? helperId : undefined;

    return (
      <div className="w-full">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={isError}
          aria-describedby={describedBy}
          className={[
            "flex w-full rounded-input border bg-bg-surface px-3 py-2 t-body text-text-primary",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary",
            "disabled:cursor-not-allowed disabled:opacity-50",
            isError ? "border-error" : "border-border",
            className
          ].filter(Boolean).join(" ")}
          {...props}
        />
        {isError && errorText && (
          <p id={errorId} className="mt-1 t-caption text-error">
            {errorText}
          </p>
        )}
        {!isError && helperText && (
          <p id={helperId} className="mt-1 t-caption text-text-secondary">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
