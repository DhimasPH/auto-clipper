import React from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import type { ErrorInfo, JobWarning } from "../../types/errorInfo";
import { localizedText, toLang } from "../../lib/errorInfo";
import { ErrorCard } from "../ErrorCard";
import { Button } from "../ui/Button";

interface PreflightNoticesProps {
  notes: JobWarning[];
  blockers: ErrorInfo[];
  checking: boolean;
  onRecheck: () => void;
}

/** Spec 4.4: notes above the start button; a blocking problem as an error card with "Periksa lagi". */
export const PreflightNotices: React.FC<PreflightNoticesProps> = ({ notes, blockers, checking, onRecheck }) => {
  const { t, i18n } = useTranslation();
  if (notes.length === 0 && blockers.length === 0) return null;
  const lang = toLang(i18n.language);
  return (
    <div className="flex flex-col gap-3">
      {blockers.map((info) => (
        <ErrorCard key={info.code} info={info} announce>
          <Button icon={RefreshCw} loading={checking} onClick={onRecheck}>
            {t("create.recheck")}
          </Button>
        </ErrorCard>
      ))}
      {notes.length > 0 && (
        <ul aria-label={t("create.notes_label")} className="flex flex-col gap-2">
          {notes.map((note) => {
            const { title, message } = localizedText(note, lang);
            return (
              <li key={note.id} className="rounded-card border border-border bg-bg-surface p-3">
                <p className="text-body font-semibold text-text-primary">{title}</p>
                {message && <p className="text-body text-text-primary">{message}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
