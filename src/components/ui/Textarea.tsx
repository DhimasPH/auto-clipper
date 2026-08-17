import React, { useId } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
  errorText?: React.ReactNode;
  helperText?: React.ReactNode;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, errorText, helperText, id, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id || generatedId;
    const helperId = `${textareaId}-helper`;
    const errorId = `${textareaId}-error`;

    const isError = error || !!errorText;
    const describedBy = isError ? errorId : helperText ? helperId : undefined;

    return (
      <div className="w-full">
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={isError}
          aria-describedby={describedBy}
          className={[
            "flex w-full rounded-input border bg-bg-surface px-3 py-2 t-body text-text-primary min-h-[80px]",
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

Textarea.displayName = "Textarea";
