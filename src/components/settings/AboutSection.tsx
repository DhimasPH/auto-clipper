import React from "react";
import { useTranslation } from "react-i18next";
import { APP_NAME, SOCIAL_LINKS, SUPPORT_LINK, appVersion, copyrightLine } from "../../lib/appInfo";
import { platform } from "../../platform";
import { Button } from "../ui/Button";

const ICON_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-button border border-border-active bg-bg-secondary text-text-primary hover:bg-bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/** "Tentang Auto Clipper" at the top of Pengaturan, Bantuan (SP4 spec 4.2). */
export const AboutSection: React.FC = () => {
  const { t } = useTranslation();
  const open = (href: string) => {
    platform()
      .openExternal(href)
      .catch((err) => console.error("Opening a link failed", err));
  };

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-bg-secondary p-5">
      <h3 className="text-card-title text-text-primary">{t("about.title")}</h3>
      <div className="flex items-center gap-4">
        <img src="/logo.png" alt={t("about.logo_alt")} className="h-16 w-16 shrink-0 rounded-full object-cover" />
        <div className="min-w-0">
          <p className="text-section-title text-text-primary">{APP_NAME}</p>
          <p className="text-body text-text-secondary">{t("app.tagline")}</p>
          <p className="text-body text-text-secondary">{t("about.version", { version: appVersion() })}</p>
        </div>
      </div>

      <ul aria-label={t("about.links_label")} className="m-0 flex list-none flex-wrap gap-2 p-0">
        {SOCIAL_LINKS.map((link) => (
          <li key={link.id}>
            <button type="button" aria-label={link.name} title={link.name} className={ICON_BUTTON} onClick={() => open(link.href)}>
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
                <path d={link.iconPath} />
              </svg>
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-col items-start gap-2">
        {/* Outline: Pengaturan keeps its one filled button elsewhere (spec 4.2, SP2 4.6). */}
        <Button variant="outline" onClick={() => open(SUPPORT_LINK.href)}>
          {t("about.support")}
        </Button>
        <p className="text-body text-text-secondary">{t("about.support_note")}</p>
      </div>

      <p className="text-caption text-text-secondary">{copyrightLine()}</p>
    </div>
  );
};
