// UI language for the parts of the web app that have Indonesian and English text.
// Indonesian is the default, as in the desktop app. The choice is kept in localStorage.

import { useSyncExternalStore } from "react";
import type { Lang } from "./errorInfo";
import { STRINGS } from "./strings";

const STORAGE_KEY = "ac_lang";
const listeners = new Set<() => void>();

function readStored(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "id";
  } catch {
    return "id";
  }
}

let current: Lang = readStored();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Storage is blocked: the choice still holds until the page is closed.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The text for `key`, with `{{name}}` filled from `vars`. Unknown keys give `fallback`. */
export function translate(lang: Lang, key: string, vars?: Record<string, string | number>, fallback?: string): string {
  const template = STRINGS[lang][key] ?? STRINGS.id[key] ?? fallback ?? key;
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export type Translate = (key: string, vars?: Record<string, string | number>, fallback?: string) => string;

export function useLang(): { lang: Lang; t: Translate } {
  const lang = useSyncExternalStore(subscribe, getLang, getLang);
  return { lang, t: (key, vars, fallback) => translate(lang, key, vars, fallback) };
}
