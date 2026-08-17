import React from 'react';
import { Check, X } from 'lucide-react';

export interface PhaseRailProps extends React.HTMLAttributes<HTMLOListElement> {
  steps: string[];
  currentStep: number;
  isError?: boolean;
}

export const PhaseRail = React.forwardRef<HTMLOListElement, PhaseRailProps>(
  ({ steps, currentStep, isError = false, className = '', ...props }, ref) => {
    return (
      <ol ref={ref} className={`flex w-full items-center justify-between pb-8 ${className}`.trim()} {...props}>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const isPending = index > currentStep;
          const isFailed = isActive && isError;
          
          return (
            <li key={`${index}-${step}`} className="flex items-center flex-1 last:flex-none" aria-current={isActive ? 'step' : undefined}>
              {/* Node and Label */}
              <div className="relative flex flex-col items-center flex-none">
                <div 
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 z-10 transition-colors duration-300 ${
                    isCompleted 
                      ? 'bg-accent-solid border-accent-solid text-white' 
                      : isFailed
                        ? 'bg-error/10 border-error text-error'
                        : isActive 
                          ? 'bg-bg-surface border-accent-solid text-accent-solid'
                          : 'bg-bg-surface border-border text-text-secondary'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : isFailed ? (
                    <X className="w-4 h-4" />
                  ) : (
                    <span className="t-caption font-medium">{index + 1}</span>
                  )}
                </div>
                
                {/* Label */}
                <div 
                  className={`absolute top-10 whitespace-nowrap t-caption transition-colors duration-300 ${
                    isPending ? 'text-text-secondary' : isFailed ? 'text-error font-medium' : 'text-text-primary font-medium'
                  }`}
                >
                  {step}
                </div>
              </div>

              {/* Connecting Line */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 bg-border relative">
                  <div 
                    className="absolute top-0 left-0 h-full bg-accent-solid transition-all duration-300"
                    style={{ width: isCompleted ? '100%' : '0%' }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    );
  }
);

PhaseRail.displayName = 'PhaseRail';
