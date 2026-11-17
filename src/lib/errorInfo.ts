// Rendering logic for structured errors (backend/errors.py). No React here.

import type { ErrorAction, ErrorInfo } from "../types/errorInfo";

export type Lang = "id" | "en";

export function toLang(language?: string | null): Lang {
  return language && language.toLowerCase().startsWith("en") ? "en" : "id";
}

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** The error_info of a response, or null when it is missing or not usable (old jobs). */
export function asErrorInfo(value: unknown): ErrorInfo | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const info: ErrorInfo = {
    code: text(raw.code),
    title: text(raw.title),
    message: text(raw.message),
    title_en: text(raw.title_en),
    message_en: text(raw.message_en),
    actions: [],
    technical: text(raw.technical),
  };
  if (!info.code || !(info.title || info.title_en || info.message || info.message_en)) return null;
  if (Array.isArray(raw.actions)) {
    for (const item of raw.actions) {
      const id = text((item as Record<string, unknown> | null)?.id);
      if (!id) continue;
      const action = item as Record<string, unknown>;
      info.actions.push({ id, label: text(action.label), label_en: text(action.label_en) });
    }
  }
  return info;
}

/** Title and message in the UI language, falling back to the other language. */
export function localizedText(
  item: { title?: string; message?: string; title_en?: string; message_en?: string },
  lang: Lang,
): { title: string; message: string } {
  const id = { title: item.title || "", message: item.message || "" };
  const en = { title: item.title_en || "", message: item.message_en || "" };
  const [first, second] = lang === "en" ? [en, id] : [id, en];
  return { title: first.title || second.title, message: first.message || second.message };
}

export function actionLabel(action: ErrorAction, lang: Lang): string {
  const [first, second] = lang === "en" ? [action.label_en, action.label] : [action.label, action.label_en];
  return first || second || action.id;
}

/** What each action id does in this app. An id with no handler gets no button. */
export type ActionHandlers = Partial<Record<string, (() => void) | undefined>>;

export interface VisibleAction {
  id: string;
  label: string;
  run: () => void;
}

/**
 * The buttons to draw for an error: one per backend action that this app can
 * carry out, in backend order. `labels` replaces a backend label where this app
 * does something more specific than the label says.
 */
export function visibleActions(
  info: ErrorInfo,
  handlers: ActionHandlers,
  lang: Lang,
  labels: Partial<Record<string, string>> = {},
): VisibleAction[] {
  const seen = new Set<string>();
  const result: VisibleAction[] = [];
  for (const action of info.actions) {
    const run = handlers[action.id];
    if (!run || seen.has(action.id)) continue;
    seen.add(action.id);
    result.push({ id: action.id, label: labels[action.id] || actionLabel(action, lang), run });
  }
  return result;
}

/** True when the error itself offers to run the job again ("Coba lagi" or "Lanjutkan"). */
export function hasRerunAction(info: ErrorInfo | null): boolean {
  return !!info && info.actions.some((a) => a.id === "retry" || a.id === "resume");
}

/** Message and error_info of a failed axios request. */
export function requestError(err: unknown, fallback: string): { message: string; info: ErrorInfo | null } {
  const e = err as { response?: { data?: Record<string, unknown> }; message?: string } | null;
  const data = e?.response?.data;
  const message = text(data?.message) || text(data?.detail) || text(e?.message) || fallback;
  return { message, info: asErrorInfo(data?.error_info) };
}
