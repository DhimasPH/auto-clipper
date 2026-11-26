import React, { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { REPICK_EXTRA_MAX, REPICK_MAX_CLIPS, parseClipCount, type RepickMode } from "../../lib/repick";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";

interface RepickDialogProps {
  isOpen: boolean;
  /** "manual": a new request for ChatGPT or Gemini (rerun-manual); "api": AI with the API key (rerun_ai). */
  mode: RepickMode;
  onClose: () => void;
  onConfirm: (extraPrompt: string, maxClips: number) => void;
}

/** "Pilih ulang momen" (SP4 spec 4.4): what should change, and how many clips. */
export const RepickDialog: React.FC<RepickDialogProps> = (props) =>
  // Mounted only while open, so every opening starts empty.
  props.isOpen ? <RepickBody {...props} /> : null;

const FIELD =
  "rounded-input border border-border-active bg-bg-primary text-body text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const RepickBody: React.FC<RepickDialogProps> = ({ mode, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const whatId = useId();
  const countId = useId();
  const countHintId = useId();
  const [extra, setExtra] = useState("");
  const [count, setCount] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  return (
    <Dialog
      title={t("projects.repick_title")}
      onClose={onClose}
      initialFocusRef={inputRef}
      // Typed text is lost on close: ask first.
      dirty={extra.trim() !== "" || count.trim() !== ""}
      footer={(requestClose) => (
        <>
          <Button variant="outline" onClick={requestClose}>{t("common.cancel")}</Button>
          <Button onClick={() => onConfirm(extra.trim(), parseClipCount(count))}>{t("projects.repick_continue")}</Button>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        <p className="text-body text-text-secondary">
          {t(mode === "manual" ? "projects.repick_manual_note" : "projects.repick_api_note")}
        </p>
        <div className="flex flex-col gap-2">
          <label htmlFor={whatId} className="text-label text-text-primary">{t("projects.repick_what")}</label>
          <textarea
            ref={inputRef}
            id={whatId}
            value={extra}
            maxLength={REPICK_EXTRA_MAX}
            onChange={(e) => setExtra(e.target.value)}
            placeholder={t("projects.repick_placeholder")}
            rows={4}
            className={`w-full p-3 ${FIELD}`}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={countId} className="text-label text-text-primary">{t("projects.repick_count")}</label>
          <input
            id={countId}
            type="number"
            inputMode="numeric"
            min={1}
            max={REPICK_MAX_CLIPS}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            aria-describedby={countHintId}
            className={`min-h-[44px] w-32 px-3 ${FIELD}`}
          />
          <p id={countHintId} className="text-caption text-text-secondary">{t("projects.repick_count_hint")}</p>
        </div>
      </div>
    </Dialog>
  );
};
