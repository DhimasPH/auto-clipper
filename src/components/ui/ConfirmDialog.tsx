import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useTranslation } from 'react-i18next';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  consequences?: string[];
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  intent?: 'primary' | 'danger';
  isLoading?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  hideCancel?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  consequences,
  onConfirm,
  confirmLabel,
  cancelLabel,
  intent = 'primary',
  isLoading,
  maxWidth = 'sm',
  hideCancel = false,
}) => {
  const { t } = useTranslation();

  const finalConfirmLabel = confirmLabel || t('common.confirm', 'Confirm');
  const finalCancelLabel = cancelLabel || t('common.cancel', 'Cancel');

  return (
    <Modal
      isOpen={isOpen}
      onClose={isLoading ? () => {} : onClose}
      title={title}
      description={description}
      maxWidth={maxWidth}
    >
      {consequences && consequences.length > 0 && (
        <ul className={`list-disc pl-5 mb-4 text-sm space-y-1 ${intent === 'danger' ? 'text-error' : 'text-text-secondary'}`}>
          {consequences.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      )}
      {children}
      <div className="flex items-center justify-end gap-3 pt-4 mt-2 border-t border-border/50">
        {!hideCancel && (
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            {finalCancelLabel}
          </Button>
        )}
        <Button
          variant={intent === 'danger' ? 'danger' : 'primary'}
          onClick={onConfirm}
          loading={isLoading}
        >
          {finalConfirmLabel}
        </Button>
      </div>
    </Modal>
  );
};
