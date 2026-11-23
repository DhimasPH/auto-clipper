import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { CookiesPanel } from "./CookiesPanel";

interface CookiesModalProps {
  onClose: () => void;
  /** Runs the failed step again. Offered once a usable file has been uploaded. */
  onRetry?: () => void;
}

/** The cookies upload, opened from the "Unggah cookies.txt" button of an error. */
export const CookiesModal: React.FC<CookiesModalProps> = ({ onClose, onRetry }) => {
  const { t } = useTranslation();
  const [canRetry, setCanRetry] = useState(false);

  return (
    <Dialog
      title={t("cookies.title")}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cookies.close")}
          </Button>
          {onRetry && canRetry && (
            <Button
              type="button"
              variant="primary"
              icon={RefreshCw}
              onClick={() => {
                onClose();
                onRetry();
              }}
            >
              {t("cookies.retry_now")}
            </Button>
          )}
        </>
      }
    >
      <CookiesPanel onUploaded={(status) => setCanRetry(status.valid)} />
    </Dialog>
  );
};

export default CookiesModal;
