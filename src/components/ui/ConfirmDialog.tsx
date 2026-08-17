import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useTranslation } from 'react-i18next';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  intent?: 'primary' | 'danger';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  title,
  description,
  onConfirm,
  confirmLabel,
  cancelLabel,
  intent = 'primary',
}) => {
  const { t } = useTranslation();

  const finalConfirmLabel = confirmLabel || t('common.confirm', 'Confirm');
  const finalCancelLabel = cancelLabel || t('common.cancel', 'Cancel');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      maxWidth="sm"
    >
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="secondary" onClick={onClose}>
          {finalCancelLabel}
        </Button>
        <Button
          variant={intent === 'danger' ? 'danger' : 'primary'}
          onClick={onConfirm}
        >
          {finalConfirmLabel}
        </Button>
      </div>
    </Modal>
  );
};
