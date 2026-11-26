import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { addonView } from "../../lib/addons";
import { useAddons } from "../../hooks/useAddons";
import { useKeepFocus } from "../../hooks/useKeepFocus";
import { SETTINGS_ANCHORS } from "../../lib/routes";
import { Select } from "../ui/Select";
import { AddonControls } from "./AddonControls";

interface FaceTrackingSectionProps {
  value: string;
  onChange: (engine: "haar" | "mediapipe") => void;
  /** From settingsVisibility (caps.addons): the precise tracker can be installed here. */
  addonsEnabled: boolean;
}

/** Pengaturan, Lanjutan: Standar or Teliti face following, and the add-on Teliti needs (SP3 spec 4.2.C). */
export const FaceTrackingSection: React.FC<FaceTrackingSectionProps> = ({ value, onChange, addonsEnabled }) => {
  const { t } = useTranslation();
  const { addons, pending, failures, removalScheduled, install, remove } = useAddons(addonsEnabled, "mediapipe");
  const status = addons.mediapipe;
  const view = addonView(status);
  const precise = value === "mediapipe";
  // Removing the add-on while Standar is chosen hides its whole card: keep the focus in this section.
  const sectionRef = useRef<HTMLDivElement>(null);
  useKeepFocus(pending.mediapipe, () => sectionRef.current);

  return (
    // The progress note on Buat klip links here (/pengaturan#pelacak-wajah); useScrollToHash focuses it.
    <div
      ref={sectionRef}
      id={SETTINGS_ANCHORS.faceTracking}
      tabIndex={-1}
      className="flex scroll-mt-16 flex-col gap-3 rounded-card border border-border bg-bg-secondary p-5 focus:outline-none"
    >
      <div>
        <Select
          label={t("settings.face_engine_label")}
          value={value}
          onChange={(e) => onChange(e.target.value === "mediapipe" ? "mediapipe" : "haar")}
          aria-describedby="face-engine-help"
          options={[
            { label: t("settings.face_engine_standard"), value: "haar" },
            { label: t("settings.face_engine_precise"), value: "mediapipe" },
          ]}
        />
        <p id="face-engine-help" className="mt-2 text-body text-text-secondary">
          {t("settings.face_engine_help")}
        </p>
      </div>

      {(view === "installed" || view === "downloading" || view === "finishing" || (precise && (view === "absent" || view === "unavailable"))) && (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <p className="text-body font-medium text-text-primary">{t("settings.addon_face_title")}</p>
          {precise && view === "absent" && (
            <p className="rounded-input border border-border bg-bg-surface p-3 text-body text-text-primary">
              {t("settings.addon_face_fallback_note")}
            </p>
          )}
          {precise && view === "unavailable" && <p className="text-body text-text-secondary">{t("settings.addon_face_unavailable")}</p>}
          {view === "absent" && <p className="text-body text-text-secondary">{t("settings.addon_face_desc")}</p>}
          <AddonControls
            status={status}
            name={t("settings.addon_face_title")}
            offerInstall={precise}
            pending={pending.mediapipe}
            failure={failures.mediapipe}
            removalScheduled={removalScheduled.mediapipe}
            installLabel={t("settings.addon_face_install")}
            removeLabel={t("settings.addon_face_remove")}
            readyKey="settings.addon_face_ready"
            onInstall={() => void install("mediapipe")}
            onRemove={() => void remove("mediapipe")}
          />
        </div>
      )}
    </div>
  );
};
