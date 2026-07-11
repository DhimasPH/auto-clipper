import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-bg-secondary w-full max-w-md rounded-card shadow-dropdown border border-border overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex justify-between items-start p-6 border-b border-border">
          <div className="flex items-center gap-3">
            {isDestructive && (
              <div className="p-2 bg-error/10 rounded-full text-error">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}
            <h2 className="text-section-title text-text-primary">{title}</h2>
          </div>
          <button
            onClick={onCancel}
            className="text-text-secondary hover:text-text-primary transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-body text-text-secondary">{message}</p>
        </div>
        <div className="flex justify-end gap-3 p-6 bg-bg-surface border-t border-border">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button 
            variant={isDestructive ? 'danger' : 'primary'} 
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
