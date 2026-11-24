import React, { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";

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
  const inputId = useId();
  const [extra, setExtra] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  return (
    <Dialog
      title={t("projects.ai_title")}
      onClose={onClose}
      initialFocusRef={inputRef}
      // Typed instructions are lost on close: ask first.
      dirty={extra.trim() !== ""}
      footer={(requestClose) => (
        <>
          <Button variant="outline" onClick={requestClose}>{t("common.cancel")}</Button>
          <Button onClick={() => onConfirm(extra.trim())}>{t("projects.ai_start")}</Button>
        </>
      )}
    >
      <div className="flex flex-col gap-3">
        <label htmlFor={inputId} className="text-body text-text-primary">{t("projects.ai_desc")}</label>
        <textarea
          ref={inputRef}
          id={inputId}
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder={t("projects.ai_placeholder")}
          rows={4}
          className="w-full rounded-input border border-border-active bg-bg-primary p-3 text-body text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
    </Dialog>
  );
};
