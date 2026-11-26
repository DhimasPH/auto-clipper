import React from "react";
import { useTranslation } from "react-i18next";
import { platform } from "../../platform";
import type { UpdateNotice } from "../../hooks/useUpdateNotice";
import { AboutSection } from "./AboutSection";
import { UpdateNoticeSection } from "./UpdateNoticeSection";
import { UpdaterSection } from "./UpdaterSection";
import { LogViewer } from "./LogViewer";

// Answers with an "a_keys" sentence (API key mode) add it only where caps.apiKeys.
const FAQ_WITH_KEYS = new Set(["free", "moments"]);

// keysText: an extra sentence about API key mode, shown only where caps.apiKeys.
const STEPS: { title: string; text: string; keysText?: string }[] = [
  { title: "create.step_video", text: "settings.help_step_video" },
  { title: "create.step_prepare", text: "settings.help_step_prepare" },
  { title: "create.step_choose", text: "settings.help_step_choose", keysText: "settings.help_step_choose_keys" },
  { title: "create.step_clips", text: "settings.help_step_clips" },
];

interface HelpSectionProps {
  showUpdater: boolean;
  /** Auto Clipper Web only (caps.updateNotice). */
  updateNotice?: UpdateNotice | null;
}

/** Pengaturan, Bantuan (spec 4.5): short steps, common questions, version, updater, technical log. */
export const HelpSection: React.FC<HelpSectionProps> = ({ showUpdater, updateNotice }) => {
  const { t } = useTranslation();
  const caps = platform().caps;
  const faqs = [
    "free",
    "sources",
    "youtube",
    "moments",
    "slow",
    "change",
    // Custom providers need the API key mode.
    ...(caps.apiKeys ? ["custom_ai"] : []),
    // Only the desktop app is installed on macOS ("app" must stay open).
    ...(caps.keepOpen === "app" ? ["mac"] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <AboutSection />
      {updateNotice && <UpdateNoticeSection notice={updateNotice} />}
      <div className="rounded-card border border-border bg-bg-secondary p-5">
        <h3 className="text-card-title text-text-primary">{t("settings.help_steps_title")}</h3>
        <ol className="mt-4 flex flex-col gap-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-active text-label text-text-primary"
              >
                {i + 1}
              </span>
              <div>
                <p className="text-body font-medium text-text-primary">{t(step.title)}</p>
                <p className="text-body text-text-secondary">
                  {t(step.text)}
                  {caps.apiKeys && step.keysText && ` ${t(step.keysText)}`}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-card border border-border bg-bg-secondary p-5">
        <h3 className="text-card-title text-text-primary">{t("settings.help_faq_title")}</h3>
        <dl className="mt-4 flex flex-col gap-4">
          {faqs.map((id) => (
            <div key={id}>
              <dt className="text-body font-medium text-text-primary">{t(`settings.help_faqs.${id}.q`)}</dt>
              <dd className="mt-1 text-body text-text-secondary break-words">
                {t(`settings.help_faqs.${id}.a`)}
                {caps.apiKeys && FAQ_WITH_KEYS.has(id) && ` ${t(`settings.help_faqs.${id}.a_keys`)}`}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {showUpdater && <UpdaterSection />}
      <LogViewer />
    </div>
  );
};
