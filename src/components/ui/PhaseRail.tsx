import React from 'react';
import { Check } from 'lucide-react';

export interface PhaseRailProps extends React.HTMLAttributes<HTMLDivElement> {
  steps: string[];
  currentStep: number;
}

export const PhaseRail = React.forwardRef<HTMLDivElement, PhaseRailProps>(
  ({ steps, currentStep, className = '', ...props }, ref) => {
    return (
      <div ref={ref} className={`flex w-full items-center justify-between ${className}`.trim()} {...props}>
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const isPending = index > currentStep;
          
          return (
            <React.Fragment key={step}>
              {/* Node and Label */}
              <div className="relative flex flex-col items-center">
                <div 
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 z-10 transition-colors duration-300 ${
                    isCompleted 
                      ? 'bg-accent-solid border-accent-solid text-white' 
                      : isActive 
                        ? 'bg-bg-surface border-accent-solid text-accent-solid'
                        : 'bg-bg-surface border-border text-text-secondary'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="t-caption font-medium">{index + 1}</span>
                  )}
                </div>
                
                {/* Label */}
                <div 
                  className={`absolute top-10 whitespace-nowrap t-caption transition-colors duration-300 ${
                    isPending ? 'text-text-secondary' : 'text-text-primary font-medium'
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
            </React.Fragment>
          );
        })}
      </div>
    );
  }
);

PhaseRail.displayName = 'PhaseRail';
