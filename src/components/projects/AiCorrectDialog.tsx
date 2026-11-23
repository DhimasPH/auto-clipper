import React, { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "../ui/Button";
import { useEscape } from "./useEscape";

interface AiCorrectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (extraPrompt: string) => void;
}

/** Re-pick highlights using an extra instruction for API-key users (Plan Spec gap 14). */
export const AiCorrectDialog: React.FC<AiCorrectDialogProps> = (props) =>
  // Mounted only while open, so every opening starts with an empty instruction.
  props.isOpen ? <AiCorrectBody {...props} /> : null;

const AiCorrectBody: React.FC<AiCorrectDialogProps> = ({ onClose, onConfirm }) => {
  const { t } = useTranslation();
  const titleId = useId();
  const inputId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [extra, setExtra] = useState("");

  useEffect(() => cancelRef.current?.focus(), []);
  useEscape(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-scrim p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-card border border-border bg-bg-secondary shadow-dropdown"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <h2 id={titleId} className="text-section-title text-text-primary">{t("projects.ai_title")}</h2>
          <Button variant="ghost" icon={X} aria-label={t("common.close")} onClick={onClose} />
        </div>
        <div className="flex flex-col gap-3 p-5">
          <label htmlFor={inputId} className="text-body text-text-primary">{t("projects.ai_desc")}</label>
          <textarea
            id={inputId}
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            placeholder={t("projects.ai_placeholder")}
            rows={4}
            className="w-full rounded-input border border-border-active bg-bg-primary p-3 text-body text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-border p-5 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => onConfirm(extra.trim())}>{t("projects.ai_start")}</Button>
        </div>
      </div>
    </div>
  );
};
