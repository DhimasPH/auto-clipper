import React from "react";
import { useTranslation } from "react-i18next";
import { APP_NAME, appVersion } from "../lib/appInfo";

/**
 * Logo, name, tagline and version while the app gets ready (SP4 spec 4.3). A spinner, not a
 * progress bar: the app cannot know how far along it is. No entry or exit animation, and the
 * spinner stands still for people who ask for reduced motion.
 */
export const SplashScreen: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg-primary px-4 text-center">
      {/* The name follows right below, so the logo needs no text of its own. */}
      <img src="/logo.png" alt="" className="h-20 w-20 rounded-full object-cover" />
      <h1 className="text-page-title text-text-primary">{APP_NAME}</h1>
      <p className="max-w-sm text-body text-text-secondary">{t("app.tagline")}</p>
      <div role="status" className="flex items-center gap-3 text-body text-text-secondary">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent motion-reduce:animate-none"
          aria-hidden="true"
        />
        {t("startup.loading")}
      </div>
      <p className="text-caption text-text-secondary">{t("about.version", { version: appVersion() })}</p>
    </div>
  );
};
