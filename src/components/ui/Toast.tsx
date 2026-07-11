import React, { useEffect, useState } from 'react';
import { Info, CheckCircle, AlertTriangle, AlertCircle, X } from 'lucide-react';

export type ToastVariant = 'info' | 'success' | 'error' | 'warning';

export interface ToastProps {
  id: string;
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({
  id,
  message,
  variant = 'info',
  duration = 4000,
  onDismiss,
}) => {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (duration === Infinity) return;
    
    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);
    
    return () => clearTimeout(timer);
  }, [duration]);

  const handleDismiss = () => {
    setIsClosing(true);
    setTimeout(() => {
      onDismiss(id);
    }, 300); // Wait for exit animation
  };

  const icons = {
    info: <Info className="w-5 h-5 text-white" />,
    success: <CheckCircle className="w-5 h-5 text-white" />,
    error: <AlertTriangle className="w-5 h-5 text-white" />,
    warning: <AlertCircle className="w-5 h-5 text-warning" />,
  };

  const colors = {
    info: 'bg-[var(--toast-info-bg)] border-border',
    success: 'bg-[var(--toast-success-bg)] border-success/20',
    error: 'bg-[var(--toast-error-bg)] border-error/20',
    warning: 'bg-bg-elevated border-warning/20',
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 w-full max-w-sm rounded-card border shadow-toast backdrop-blur-md pointer-events-auto transition-all duration-300
        ${colors[variant]}
        ${isClosing ? 'opacity-0 translate-x-full' : 'translate-x-0'}`}
    >
      <div className="flex-shrink-0 mt-0.5">{icons[variant]}</div>
      <div className="flex-1 text-body text-white mr-2">{message}</div>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-white/50 hover:text-white transition-colors p-0.5 -mr-1 -mt-1"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
