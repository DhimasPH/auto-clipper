import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Trash2 } from "lucide-react";
import { addonView, megabytes, type AddonStatus } from "../../lib/addons";
import type { AddonFailure } from "../../hooks/useAddons";
import { useKeepFocus } from "../../hooks/useKeepFocus";
import { ErrorCard } from "../ErrorCard";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { TechnicalDetails } from "../ui/TechnicalDetails";

interface AddonControlsProps {
  status: AddonStatus | undefined;
  /** The add-on's name on screen (the card title): names the progress bar. */
  name: string;
  /** Offer the install button when the add-on is missing (the parent knows whether it would help). */
  offerInstall: boolean;
  pending?: "install" | "remove";
  failure?: AddonFailure;
  /** Removal waits for the app to open again (ADDON_IN_USE): no "installed" sentence, no remove button. */
  removalScheduled?: boolean;
  /** Ask before removing (a large add-on that would have to be downloaded again). */
  confirmRemove?: { title: string; message: string; confirmLabel: string };
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
  name,
  offerInstall,
  pending,
  failure,
  removalScheduled = false,
  confirmRemove,
  installLabel,
  removeLabel,
  readyKey,
  onInstall,
  onRemove,
}) => {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const view = addonView(status);

  // The pressed button goes away when the request succeeds (install becomes progress, remove becomes
  // install). Keep the keyboard focus here instead of losing it to the page: on the progress if shown.
  // When the whole card goes away, the section around it does the same.
  useKeepFocus(pending, () => progressRef.current ?? rootRef.current);

  if (!status || view === "unknown" || view === "unavailable") return null;

  const percent = Math.max(0, Math.min(100, Math.round(status.percent)));
  // Before the first bytes arrive the server reports 0 of 0: use the known download size.
  const total = status.total_mb || status.size_hint_mb;
  // AGENTS F rule 12: the server explains its own failures (error_info); this screen's words only
  // for a request that failed without one (no connection, an older server).
  const info = failure?.info ?? status.error_info;
  const retry = failure?.action !== "remove" && offerInstall && view === "absent" ? onInstall : undefined;
  const cardRetries = !!info && !!retry && info.actions.some((a) => a.id === "retry");
  const localFailure = failure && !failure.info ? failure : null;

  return (
    <div ref={rootRef} tabIndex={-1} className="flex flex-col gap-3 focus:outline-none">
      {(view === "downloading" || view === "finishing") && (
        <div ref={progressRef} tabIndex={-1} className="flex flex-col gap-2 focus:outline-none">
          <div
            role="progressbar"
            aria-label={t("settings.addon_progress_label", { name })}
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
        {view === "installed" && !removalScheduled && (
          <p className="text-body text-success">{t(readyKey, { mb: megabytes(status.disk_mb) })}</p>
        )}
      </div>

      {/* quiet: Pengaturan already has its one filled button elsewhere (spec 4.6). */}
      {info && <ErrorCard info={info} handlers={retry ? { retry } : {}} announce quiet />}
      {!info && localFailure && (
        <div role="alert" className="flex flex-col gap-1">
          <p className="text-body text-error">
            {t(localFailure.action === "remove" ? "settings.addon_remove_failed" : "settings.addon_download_failed")}
          </p>
          <TechnicalDetails text={localFailure.technical} />
        </div>
      )}

      {view === "absent" && offerInstall && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-body text-text-secondary">{t("settings.addon_size", { mb: megabytes(status.size_hint_mb) })}</p>
          {/* After a failed download the card's Coba lagi installs again: one button for one action. */}
          {!cardRetries && (
            <Button variant="outline" icon={Download} loading={pending === "install"} onClick={onInstall}>
              {installLabel}
            </Button>
          )}
        </div>
      )}

      {view === "installed" && !removalScheduled && (
        <Button
          variant="outline"
          icon={Trash2}
          className="self-start"
          loading={pending === "remove"}
          onClick={() => (confirmRemove ? setConfirming(true) : onRemove())}
        >
          {removeLabel}
        </Button>
      )}

      {confirmRemove && (
        <ConfirmDialog
          isOpen={confirming}
          title={confirmRemove.title}
          message={confirmRemove.message}
          confirmLabel={confirmRemove.confirmLabel}
          isDestructive
          onConfirm={() => {
            setConfirming(false);
            onRemove();
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
};
