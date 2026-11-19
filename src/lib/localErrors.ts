import i18n from "../i18n";
import type { ErrorInfo } from "../types/errorInfo";

// Error cards for failures the backend cannot report itself (it refused a link, or
// cannot be reached). Same ErrorInfo shape as backend/errors.py, texts from
// src/locales (local_error.*), so ErrorCard renders them like any other error.

export const LOCAL_ERROR_CODES = ["VIDEO_LINK_REFUSED"] as const;
export type LocalErrorCode = (typeof LOCAL_ERROR_CODES)[number];

const ACTIONS: Record<LocalErrorCode, string[]> = {
  VIDEO_LINK_REFUSED: ["retry"],
};

export function localErrorInfo(code: LocalErrorCode, technical = ""): ErrorInfo {
  const id = i18n.getFixedT("id");
  const en = i18n.getFixedT("en");
  const key = `local_error.${code.toLowerCase()}`;
  return {
    code,
    title: id(`${key}.title`),
    message: id(`${key}.message`),
    title_en: en(`${key}.title`),
    message_en: en(`${key}.message`),
    actions: ACTIONS[code].map((action) => ({
      id: action,
      label: id(`local_error.action.${action}`),
      label_en: en(`local_error.action.${action}`),
    })),
    technical,
  };
}
