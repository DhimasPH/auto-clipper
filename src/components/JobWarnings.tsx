import React from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import type { JobWarning } from "../types/errorInfo";
import { localizedText, toLang } from "../lib/errorInfo";

/** The warnings of a finished job (e.g. Google Drive not connected), always visible. */
export const JobWarnings: React.FC<{ warnings: unknown; className?: string }> = ({ warnings, className = "" }) => {
  const { i18n } = useTranslation();
  if (!Array.isArray(warnings)) return null;
  const lang = toLang(i18n.language);
  const items = (warnings as JobWarning[])
    .filter((w) => w && typeof w === "object")
    .map((w) => ({ id: w.id, ...localizedText(w, lang) }))
    .filter((w) => w.title || w.message);
  if (items.length === 0) return null;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {items.map((w, i) => (
        <div
          key={w.id || i}
          role="status"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            {w.title && <h4 className="text-card-title text-text-primary">{w.title}</h4>}
            {w.message && <p className="text-body text-text-primary mt-1">{w.message}</p>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default JobWarnings;
