import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en.json';
import idTranslation from './locales/id.json';

const resources = {
  en: {
    translation: enTranslation
  },
  id: {
    translation: idTranslation
  }
};

function savedLanguage(): string {
  try {
    const saved = localStorage.getItem("ac_lang");
    return saved === "en" || saved === "id" ? saved : "id";
  } catch {
    return "id";
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

/** <html lang> follows the language (screen readers), and the choice is kept for the next visit. */
function applyLanguage(lng: string): void {
  const lang = lng.startsWith("en") ? "en" : "id";
  if (typeof document !== "undefined") document.documentElement.lang = lang;
  try {
    localStorage.setItem("ac_lang", lang);
  } catch {
    // Storage blocked: the language still applies for this visit.
  }
}

applyLanguage(i18n.language);
i18n.on("languageChanged", applyLanguage);

export default i18n;
