import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Cookie, RefreshCw, X } from "lucide-react";
import { Button } from "./ui/Button";
import { CookiesPanel } from "./CookiesPanel";

interface CookiesModalProps {
  onClose: () => void;
  /** Runs the failed step again. Offered once a usable file has been uploaded. */
  onRetry?: () => void;
}

/** The cookies upload, opened from the "Unggah cookies.txt" button of an error. */
export const CookiesModal: React.FC<CookiesModalProps> = ({ onClose, onRetry }) => {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDivElement>(null);
  const [canRetry, setCanRetry] = useState(false);

  useEffect(() => {
    dialog.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookies-modal-title"
        tabIndex={-1}
        className="bg-bg-secondary w-full max-w-2xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh] focus:outline-none"
      >
        <div className="p-6 border-b border-border flex justify-between items-center gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <Cookie className="w-5 h-5 text-accent" aria-hidden="true" />
            <h2 id="cookies-modal-title" className="text-section-title text-text-primary">
              {t("cookies.title", "Cookies YouTube")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("cookies.close", "Tutup")}
            className="text-text-secondary hover:text-text-primary transition-colors p-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <CookiesPanel onUploaded={(status) => setCanRetry(status.valid)} />
        </div>

        <div className="p-6 border-t border-border flex justify-end gap-3 shrink-0">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cookies.close", "Tutup")}
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
              {t("cookies.retry_now", "Coba lagi sekarang")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CookiesModal;
