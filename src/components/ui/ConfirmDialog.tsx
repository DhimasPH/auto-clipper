import React, { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
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
  cancelLabel,
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (isOpen) cancelRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancelRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-scrim p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-bg-secondary w-full max-w-md rounded-card border border-border shadow-dropdown"
      >
        <div className="flex justify-between items-start gap-3 p-5 border-b border-border">
          <h2 id={titleId} className="text-section-title text-text-primary">{title}</h2>
          <Button variant="ghost" icon={X} aria-label={t('common.close', 'Tutup')} onClick={onCancel} />
        </div>
        <p className="p-5 text-body text-text-primary">{message}</p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 p-5 border-t border-border">
          <Button ref={cancelRef} variant="outline" onClick={onCancel}>
            {cancelLabel ?? t('common.cancel', 'Batal')}
          </Button>
          <Button variant={isDestructive ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
