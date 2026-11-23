import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Cookie,
  Copy,
  FileVideo,
  LucideIcon,
  Play,
  RefreshCw,
  Settings,
} from "lucide-react";
import { Button } from "./ui/Button";
import type { ErrorInfo } from "../types/errorInfo";
import { ActionHandlers, localizedText, toLang, visibleActions } from "../lib/errorInfo";
import { platform } from "../platform";
import { actionLabels } from "../lib/errorActions";

const ACTION_ICONS: Record<string, LucideIcon> = {
  upload_cookies: Cookie,
  upload_video: FileVideo,
  retry: RefreshCw,
  resume: Play,
  open_settings: Settings,
};

interface ErrorCardProps {
  info: ErrorInfo;
  /** What each action id does here. Actions without a handler get no button. */
  handlers?: ActionHandlers;
  /** Read the card out when it appears. Off for lists of old failures. */
  announce?: boolean;
  /** Extra buttons, drawn after the action buttons. */
  children?: React.ReactNode;
  className?: string;
}

/** A failure in plain words, with what the user can do about it. */
export const ErrorCard: React.FC<ErrorCardProps> = ({ info, handlers = {}, announce = false, children, className = "" }) => {
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState(false);
  const lang = toLang(i18n.language);
  const { title, message } = localizedText(info, lang);
  const actions = visibleActions(info, handlers, lang, actionLabels(platform().caps, (key, fallback) => t(key, fallback)));

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
      className={`rounded-card border border-error bg-bg-secondary p-4 flex flex-col gap-3 ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-card-title text-text-primary">{title}</h3>
          {message && <p className="text-body text-text-primary mt-1">{message}</p>}
        </div>
      </div>

      {(actions.length > 0 || children) && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action, i) => (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant={i === 0 ? "primary" : "outline"}
              icon={ACTION_ICONS[action.id]}
              onClick={action.run}
            >
              {action.label}
            </Button>
          ))}
          {children}
        </div>
      )}

      {info.technical && (
        <details className="group">
          <summary className="inline-flex min-h-[44px] items-center gap-1 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden text-label text-text-primary hover:text-accent rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90" aria-hidden="true" />
            {t("errorCard.technical", "Detail teknis")}
          </summary>
          <div className="mt-2 rounded-input border border-border bg-bg-surface p-3 flex flex-col gap-2">
            <pre className="m-0 text-caption text-text-primary font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
              {info.code}
              {"\n"}
              {info.technical}
            </pre>
            <div>
              <Button type="button" size="sm" variant="outline" icon={copied ? Check : Copy} onClick={copyTechnical}>
                {copied ? t("errorCard.copied", "Tersalin") : t("errorCard.copy", "Salin")}
              </Button>
            </div>
          </div>
        </details>
      )}
    </section>
  );
};

export default ErrorCard;
