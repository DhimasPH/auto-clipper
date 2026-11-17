import React from "react";
import { AlertTriangle } from "lucide-react";
import type { JobWarning } from "../types/errorInfo";
import { localizedText } from "../lib/errorInfo";
import { useLang } from "../lib/lang";

/** The warnings of a finished job (e.g. Google Drive not connected), always visible. */
export const JobWarnings: React.FC<{ warnings: unknown; className?: string }> = ({ warnings, className = "" }) => {
  const { lang } = useLang();
  if (!Array.isArray(warnings)) return null;
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
          className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5"
        >
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            {w.title && <h4 className="text-sm font-bold text-amber-900">{w.title}</h4>}
            {w.message && <p className="text-sm text-slate-700 mt-1 leading-relaxed">{w.message}</p>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default JobWarnings;
