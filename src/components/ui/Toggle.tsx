import React, { useId } from 'react';

export interface ToggleProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
}

export const Toggle = React.forwardRef<HTMLInputElement, ToggleProps>(
  ({ className, label, id, disabled, ...props }, ref) => {
    const generatedId = useId();
    const toggleId = id || generatedId;

    return (
      <label htmlFor={toggleId} className={["inline-flex items-center gap-3 cursor-pointer", disabled && "cursor-not-allowed opacity-50", className].filter(Boolean).join(" ")}>
        <div className="relative flex items-center">
          <input
            type="checkbox"
            id={toggleId}
            ref={ref}
            disabled={disabled}
            className="peer sr-only"
            {...props}
          />
          <div className="block h-6 w-11 rounded-full bg-bg-surface border border-border peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg-primary peer-checked:bg-accent peer-checked:border-accent transition-colors"></div>
          <div className="absolute left-1 h-4 w-4 rounded-full bg-text-secondary peer-checked:bg-bg-primary peer-checked:translate-x-5 transition-transform"></div>
        </div>
        {label && <span className="t-body text-text-primary select-none">{label}</span>}
      </label>
    );
  }
);

Toggle.displayName = "Toggle";
