import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  errorText?: React.ReactNode;
  helperText?: React.ReactNode;
  label?: React.ReactNode;
  options?: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, errorText, helperText, label, options, id, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const helperId = `${selectId}-helper`;
    const errorId = `${selectId}-error`;

    const isError = error || !!errorText;
    const hasErrorText = isError && Boolean(errorText);
    const hasHelperText = !isError && Boolean(helperText);
    const describedBy = hasErrorText ? errorId : hasHelperText ? helperId : undefined;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="block mb-1.5 text-label text-text-primary">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={isError}
            aria-describedby={describedBy}
            className={[
              "flex w-full rounded-input border bg-bg-surface px-3 py-2 pr-10 t-body text-text-primary appearance-none cursor-pointer",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary",
              "disabled:cursor-not-allowed disabled:opacity-50",
              isError ? "border-error" : "border-border",
              className
            ].filter(Boolean).join(" ")}
            {...props}
          >
            {options && options.length > 0 ? options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            )) : children}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-text-secondary">
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>
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

Select.displayName = "Select";
