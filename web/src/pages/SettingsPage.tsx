import React from "react";
import { Cookie, Languages } from "lucide-react";
import { CookiesPanel } from "../components/CookiesPanel";
import type { Lang } from "../lib/errorInfo";
import { setLang, useLang } from "../lib/lang";

const LANGUAGES: { value: Lang; label: string }[] = [
  { value: "id", label: "Indonesia" },
  { value: "en", label: "English" },
];

export const SettingsPage: React.FC = () => {
  const { lang, t } = useLang();

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto space-y-4 sm:space-y-6">
      <header className="mb-2 sm:mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-text-primary">{t("settings.title")}</h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1">{t("settings.subtitle")}</p>
      </header>

      <section className="bg-white border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2 mb-4">
          <Cookie className="w-4 h-4 text-purple-600" aria-hidden="true" />
          {t("cookies.title")}
        </h2>
        <CookiesPanel />
      </section>

      <section className="bg-white border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2 mb-3">
          <Languages className="w-4 h-4 text-purple-600" aria-hidden="true" />
          {t("settings.language_title")}
        </h2>
        <div className="grid grid-cols-2 gap-3 max-w-sm" role="group" aria-label={t("settings.language_title")}>
          {LANGUAGES.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={lang === option.value}
              onClick={() => setLang(option.value)}
              className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 ${
                lang === option.value
                  ? "border-purple-500 bg-purple-50 text-purple-700 ring-1 ring-purple-500/30"
                  : "border-border bg-white text-text-secondary hover:border-slate-300"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-text-secondary mt-3 m-0">{t("settings.language_note")}</p>
      </section>
    </div>
  );
};

export default SettingsPage;
