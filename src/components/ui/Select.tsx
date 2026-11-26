import React, { useId } from 'react';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  className = '',
  id,
  ...props
}) => {
  const autoId = useId();
  const selectId = id || autoId;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={selectId} className="text-label text-text-primary">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className="w-full min-h-[44px] bg-bg-secondary border border-border-active rounded-input py-2 pl-3 pr-9 text-body text-text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors duration-150 appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%237A7D84' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
          backgroundPosition: 'right 0.5rem center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '1.5em 1.5em',
        }}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};
