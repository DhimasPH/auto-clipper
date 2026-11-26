import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { Dialog } from './Dialog';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  /** A verb for what happens (spec 4.6: buttons are verbs), for example "Ya, hapus". */
  confirmLabel: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Yes/no question in the shared Dialog shell; the safe choice has the focus. */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);

  if (!isOpen) return null;

  return (
    <Dialog
      title={title}
      onClose={onCancel}
      initialFocusRef={cancelRef}
      footer={
        <>
          <Button ref={cancelRef} variant="outline" onClick={onCancel}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button variant={isDestructive ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-body text-text-primary whitespace-pre-line">{message}</p>
    </Dialog>
  );
};
