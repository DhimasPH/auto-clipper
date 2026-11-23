import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "./Button";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** Open dialogs, newest last: only the top one answers Escape and keeps Tab inside. */
const openStack: string[] = [];

export function focusableIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => !el.closest("[inert]") && el.getAttribute("aria-hidden") !== "true",
  );
}

const SIZES = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

export interface DialogProps {
  title: string;
  /** One line under the title (for example which clip the dialog is about). */
  subtitle?: string;
  /** Escape, the close button and a click outside call this. Omit for a dialog that must not close (update install). */
  onClose?: () => void;
  /** The dialog holds typed input that closing would throw away: ask first (antislop R-32, spec 4.6). */
  dirty?: boolean;
  /** Focused when the dialog opens; else the first control inside. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  size?: keyof typeof SIZES;
  footer?: React.ReactNode;
  role?: "dialog" | "alertdialog";
  children?: React.ReactNode;
}

/**
 * The one modal shell (spec 4.6: usable with the keyboard, focus visible): labelled, Tab stays
 * inside, Escape closes, focus goes back to the control that opened it. Mount it only while open.
 */
export const Dialog: React.FC<DialogProps> = ({
  title,
  subtitle,
  onClose,
  dirty = false,
  initialFocusRef,
  size = "sm",
  footer,
  role = "dialog",
  children,
}) => {
  const { t } = useTranslation();
  const id = useId();
  const titleId = `${id}-title`;
  const subtitleId = `${id}-subtitle`;
  const panelRef = useRef<HTMLDivElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const [askDiscard, setAskDiscard] = useState(false);

  const latest = useRef({ onClose, dirty, askDiscard });
  latest.current = { onClose, dirty, askDiscard };

  const requestClose = useCallback(() => {
    const { onClose: close, dirty: isDirty } = latest.current;
    if (!close) return;
    if (isDirty) setAskDiscard(true);
    else close();
  }, []);

  // Opening: remember the opener, move focus in, lock the page behind. Closing: undo all three.
  useEffect(() => {
    openStack.push(id);
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const target = initialFocusRef?.current ?? (panel ? focusableIn(panel)[0] : null) ?? panel;
    target?.focus();
    const body = document.body;
    const overflow = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      const at = openStack.indexOf(id);
      if (at >= 0) openStack.splice(at, 1);
      body.style.overflow = overflow;
      if (opener && opener.isConnected) opener.focus();
    };
    // Runs once per mount on purpose: the dialog is mounted only while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (askDiscard) keepEditingRef.current?.focus();
  }, [askDiscard]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (openStack[openStack.length - 1] !== id) return;
      const panel = panelRef.current;
      if (e.key === "Escape") {
        if (!latest.current.onClose) return;
        e.preventDefault();
        if (latest.current.askDiscard) setAskDiscard(false);
        else requestClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = focusableIn(panel);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && panel.contains(active);
      if (e.shiftKey && (active === first || !inside || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !inside)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [id, requestClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        tabIndex={-1}
        className={`flex max-h-[90dvh] w-full ${SIZES[size]} flex-col rounded-card border border-border bg-bg-secondary shadow-dropdown focus:outline-none`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-section-title text-text-primary break-words">{title}</h2>
            {subtitle && <p id={subtitleId} className="mt-1 text-body text-text-secondary break-words">{subtitle}</p>}
          </div>
          {onClose && <Button variant="ghost" icon={X} aria-label={t("common.close")} onClick={requestClose} />}
        </div>

        {children !== undefined && <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>}

        {askDiscard ? (
          <div role="alert" className="flex flex-col gap-3 border-t border-border p-4 sm:p-5">
            <p className="text-body text-text-primary">{t("dialog.discard_question")}</p>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button ref={keepEditingRef} variant="outline" onClick={() => setAskDiscard(false)}>
                {t("dialog.keep_editing")}
              </Button>
              <Button variant="danger" onClick={() => latest.current.onClose?.()}>
                {t("dialog.discard")}
              </Button>
            </div>
          </div>
        ) : (
          footer && (
            <div className="flex flex-col-reverse gap-3 border-t border-border p-4 sm:flex-row sm:flex-wrap sm:justify-end sm:p-5">
              {footer}
            </div>
          )
        )}
      </div>
    </div>
  );
};
