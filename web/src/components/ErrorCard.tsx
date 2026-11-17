import React, { useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Cookie,
  Copy,
  FileVideo,
  Play,
  RotateCcw,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { ErrorInfo } from "../types/errorInfo";
import { localizedText, visibleActions, type ActionHandlers } from "../lib/errorInfo";
import { useLang } from "../lib/lang";
import { BTN_PRIMARY, BTN_SECONDARY, SUMMARY } from "../lib/ui";

const ACTION_ICONS: Record<string, LucideIcon> = {
  upload_cookies: Cookie,
  upload_video: FileVideo,
  retry: RotateCcw,
  resume: Play,
  open_settings: Settings,
};

interface ErrorCardProps {
  info: ErrorInfo;
  /** What each action id does here. Actions without a handler get no button. */
  handlers?: ActionHandlers;
  /** Button text for actions that do something more specific here than the backend label says. */
  labels?: Partial<Record<string, string>>;
  /** Read the card out when it appears. Off for lists of old failures. */
  announce?: boolean;
  /** Extra buttons, drawn after the action buttons. */
  children?: React.ReactNode;
  className?: string;
}

/** A failure in plain words, with what the user can do about it. */
export const ErrorCard: React.FC<ErrorCardProps> = ({
  info,
  handlers = {},
  labels,
  announce = false,
  children,
  className = "",
}) => {
  const { lang, t } = useLang();
  const [copied, setCopied] = useState(false);
  const { title, message } = localizedText(info, lang);
  const actions = visibleActions(info, handlers, lang, labels);

  const copyTechnical = async () => {
    try {
      await navigator.clipboard.writeText(`${info.code}\n${info.technical}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy technical details:", err);
    }
  };

  return (
    <section
      role={announce ? "alert" : undefined}
      className={`p-4 rounded-xl bg-red-50 border border-red-200 flex flex-col gap-3 ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-red-800">{title}</h3>
          {message && <p className="text-sm text-slate-700 mt-1 leading-relaxed">{message}</p>}
        </div>
      </div>

      {(actions.length > 0 || children) && (
        <div className="flex items-center gap-2 flex-wrap">
          {actions.map((action, i) => {
            const Icon = ACTION_ICONS[action.id];
            return (
              <button
                key={action.id}
                type="button"
                onClick={action.run}
                className={i === 0 ? BTN_PRIMARY : BTN_SECONDARY}
              >
                {Icon && <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
                {action.label}
              </button>
            );
          })}
          {children}
        </div>
      )}

      {info.technical && (
        <details className="group">
          <summary className={SUMMARY}>
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
            {t("errorCard.technical")}
          </summary>
          <div className="mt-2 p-3 rounded-lg bg-white border border-border flex flex-col gap-2">
            <pre className="m-0 text-xs text-text-secondary font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
              {info.code}
              {"\n"}
              {info.technical}
            </pre>
            <div>
              <button type="button" onClick={copyTechnical} className={BTN_SECONDARY}>
                {copied ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                {copied ? t("errorCard.copied") : t("errorCard.copy")}
              </button>
            </div>
          </div>
        </details>
      )}
    </section>
  );
};

export default ErrorCard;
