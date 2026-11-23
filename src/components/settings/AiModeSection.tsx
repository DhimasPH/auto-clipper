import React from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import type { AiMode } from "../../lib/createFlow";

interface AiModeSectionProps {
  aiMode: AiMode;
  setAiMode: (mode: AiMode) => void;
}

/** Switch between guided manual AI (default) and API-key automatic AI (Spec gap 12). */
export const AiModeSection: React.FC<AiModeSectionProps> = ({ aiMode, setAiMode }) => {
  const { t } = useTranslation();
  return (
    <div className="rounded-card border border-border bg-bg-secondary p-5">
      <h3 className="text-card-title text-text-primary">{t("settings.ai_mode_title")}</h3>
      <p className="mt-1 text-body text-text-secondary">{t("settings.ai_mode_desc")}</p>
      <div className="mt-4">
        <ToggleSwitch
          checked={aiMode === "auto"}
          onChange={(checked) => setAiMode(checked ? "auto" : "manual")}
          label={t("settings.ai_mode_toggle")}
        />
      </div>
    </div>
  );
};
