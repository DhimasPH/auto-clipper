import React, { useId } from 'react';

export interface SegmentedOption {
  label: React.ReactNode;
  value: string;
}

export interface SegmentedProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  options: SegmentedOption[];
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  name?: string;
}

export const Segmented = React.forwardRef<HTMLDivElement, SegmentedProps>(
  ({ className, options, value, onChange, disabled, id, name, ...props }, ref) => {
    const generatedName = useId();
    const groupName = name || generatedName;

    return (
      <div 
        ref={ref}
        id={id}
        className={["inline-flex p-1 bg-bg-surface border border-border rounded-input", className].filter(Boolean).join(" ")}
        {...props}
      >
        {options.map((option) => {
          const isChecked = value === option.value;
          return (
            <label
              key={option.value}
              className={[
                "relative flex items-center justify-center px-3 py-1.5 cursor-pointer rounded-sm t-body transition-colors",
                disabled && "cursor-not-allowed opacity-50",
                isChecked ? "bg-bg-primary text-text-primary shadow-sm" : "text-text-secondary hover:text-text-primary"
              ].filter(Boolean).join(" ")}
            >
              <input
                type="radio"
                name={groupName}
                value={option.value}
                checked={isChecked}
                onChange={() => !disabled && onChange?.(option.value)}
                disabled={disabled}
                className="sr-only peer"
              />
              <span className="relative z-10">{option.label}</span>
              <div className="absolute inset-0 rounded-sm peer-focus-visible:ring-2 peer-focus-visible:ring-accent pointer-events-none"></div>
            </label>
          );
        })}
      </div>
    );
  }
);

Segmented.displayName = "Segmented";
