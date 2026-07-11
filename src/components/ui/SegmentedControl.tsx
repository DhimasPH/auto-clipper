import React from 'react';

export interface SegmentedControlOption {
  label: string;
  value: string;
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
  disabled = false,
  className = ''
}) => {
  return (
    <div className={`inline-flex p-1 bg-bg-surface rounded-input border border-border ${disabled ? 'opacity-50 pointer-events-none' : ''} ${className}`}>
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={`flex-1 px-3 py-1.5 text-label rounded-md transition-all duration-200 ${
              isActive 
                ? 'bg-bg-elevated text-text-primary shadow-sm border border-border-active' 
                : 'text-text-secondary hover:text-text-primary border border-transparent'
            }`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};
