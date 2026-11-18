import React, { useEffect, useRef, useState } from "react";
import { Cookie, RotateCcw, XCircle } from "lucide-react";
import { CookiesPanel } from "./CookiesPanel";
import { useLang } from "../lib/lang";
import { BTN_PRIMARY, BTN_SECONDARY } from "../lib/ui";

interface CookiesModalProps {
  onClose: () => void;
  /** Runs the failed step again. Offered once a usable file has been uploaded. */
  onRetry?: () => void;
}

/** The cookies upload, opened from the "Unggah cookies.txt" button of an error. */
export const CookiesModal: React.FC<CookiesModalProps> = ({ onClose, onRetry }) => {
  const { t } = useLang();
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn"
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
        className="w-full max-w-2xl bg-white border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] focus:outline-none"
      >
        <div className="flex items-center justify-between p-5 border-b border-border bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <Cookie className="w-5 h-5 text-purple-600" aria-hidden="true" />
            <h3 id="cookies-modal-title" className="font-semibold text-text-primary text-base">
              {t("cookies.title")}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("cookies.close")}
            className="p-1.5 text-text-tertiary hover:text-text-primary rounded-xl hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <XCircle className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <CookiesPanel onUploaded={(status) => setCanRetry(status.valid)} />
        </div>

        <div className="p-4 sm:p-5 border-t border-border flex justify-end gap-2 bg-slate-50/70 shrink-0">
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>
            {t("cookies.close")}
          </button>
          {onRetry && canRetry && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onRetry();
              }}
              className={BTN_PRIMARY}
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              {t("cookies.retry_now")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CookiesModal;
