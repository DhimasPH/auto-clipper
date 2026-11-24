import React from "react";
import { useTranslation } from "react-i18next";
import { Download, Trash2 } from "lucide-react";
import { addonView, megabytes, type AddonStatus } from "../../lib/addons";
import { localizedText, toLang } from "../../lib/errorInfo";
import type { AddonFailure } from "../../hooks/useAddons";
import { Button } from "../ui/Button";
import { TechnicalDetails } from "../ui/TechnicalDetails";

interface AddonControlsProps {
  status: AddonStatus | undefined;
  /** Offer the install button when the add-on is missing (the parent knows whether it would help). */
  offerInstall: boolean;
  pending?: "install" | "remove";
  failure?: AddonFailure;
  installLabel: string;
  removeLabel: string;
  /** Translation key of the "installed" sentence; gets {{mb}}. */
  readyKey: string;
  onInstall: () => void;
  onRemove: () => void;
}

/** Download progress, install and remove for one optional add-on (SP3 spec 4.2.D). */
export const AddonControls: React.FC<AddonControlsProps> = ({
  status,
  offerInstall,
  pending,
  failure,
  installLabel,
  removeLabel,
  readyKey,
  onInstall,
  onRemove,
}) => {
  const { t, i18n } = useTranslation();
  const view = addonView(status);
  if (!status || view === "unknown" || view === "unavailable") return null;

  const percent = Math.max(0, Math.min(100, Math.round(status.percent)));
  // Before the first bytes arrive the server reports 0 of 0: use the known download size.
  const total = status.total_mb || status.size_hint_mb;
  const backgroundError = view === "absent" ? status.error_info : null;
  const failed = failure ?? (backgroundError ? { action: "install" as const, technical: backgroundError.technical, info: null } : null);

  return (
    <div className="flex flex-col gap-3">
      {(view === "downloading" || view === "finishing") && (
        <div className="flex flex-col gap-2">
          <div
            role="progressbar"
            aria-label={t("settings.addon_progress_label")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-2 w-full overflow-hidden rounded-full border border-border-active bg-bg-surface"
          >
            <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-body text-text-secondary">
            {view === "finishing"
              ? t("settings.addon_finishing")
              : t("settings.addon_downloading", { done: megabytes(status.downloaded_mb), total: megabytes(total), percent })}
          </p>
        </div>
      )}

      <div role="status">
        {view === "installed" && <p className="text-body text-success">{t(readyKey, { mb: megabytes(status.disk_mb) })}</p>}
      </div>

      {failed && (
        <div role="alert" className="flex flex-col gap-1">
          {failed.action === "remove" && failed.info ? (
            // The server says why and what happens next (e.g. removed when the app opens again).
            <>
              <p className="text-body font-medium text-text-primary">{localizedText(failed.info, toLang(i18n.language)).title}</p>
              <p className="text-body text-text-primary">{localizedText(failed.info, toLang(i18n.language)).message}</p>
            </>
          ) : (
            <p className="text-body text-error">
              {t(failed.action === "remove" ? "settings.addon_remove_failed" : "settings.addon_download_failed")}
            </p>
          )}
          <TechnicalDetails text={failed.technical} />
        </div>
      )}

      {view === "absent" && offerInstall && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-body text-text-secondary">{t("settings.addon_size", { mb: megabytes(status.size_hint_mb) })}</p>
          <Button variant="outline" icon={Download} loading={pending === "install"} onClick={onInstall}>
            {installLabel}
          </Button>
        </div>
      )}

      {view === "installed" && (
        <Button variant="outline" icon={Trash2} className="self-start" loading={pending === "remove"} onClick={onRemove}>
          {removeLabel}
        </Button>
      )}
    </div>
  );
};
