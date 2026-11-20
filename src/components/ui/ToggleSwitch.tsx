import React from 'react';

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  className = ''
}) => {
  return (
    <label className={`inline-flex min-h-[44px] items-center gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          aria-checked={checked}
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <span
          aria-hidden="true"
          className={`block w-11 h-6 rounded-full border transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg-primary ${
            checked ? 'bg-accent border-accent' : 'bg-bg-surface border-border-active'
          }`}
        />
        <span
          aria-hidden="true"
          className={`absolute left-1 top-1 w-4 h-4 rounded-full transition-transform duration-150 ${
            checked ? 'translate-x-5 bg-on-accent' : 'bg-text-secondary'
          }`}
        />
      </span>
      {label && <span className="text-body text-text-primary">{label}</span>}
    </label>
  );
};
