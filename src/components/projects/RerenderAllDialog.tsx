import React, { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { CanvasConfigControls } from "../ui/CanvasConfigControls";
import { SubtitleConfigControls } from "../ui/SubtitleConfigControls";
import { DEFAULT_CANVAS_CONFIG, type CanvasConfig } from "../../types/canvas";
import { DEFAULT_SUBTITLE_CONFIG, type SubtitleConfig } from "../../types/subtitle";
import { useEscape } from "./useEscape";

export interface RerenderOptions {
  aspectRatio: string;
  burnSubs: boolean;
  canvasConfig: CanvasConfig;
  subtitleConfig: SubtitleConfig;
}

interface RerenderAllDialogProps {
  isOpen: boolean;
  initialMeta?: Record<string, unknown> | null;
  onClose: () => void;
  onConfirm: (opts: RerenderOptions) => void;
}

/** Re-make every clip in a project with updated look settings (spec 4.5). */
export const RerenderAllDialog: React.FC<RerenderAllDialogProps> = (props) =>
  // Mounted only while open, so every opening starts from the project's saved look.
  props.isOpen ? <RerenderAllBody {...props} /> : null;

const RerenderAllBody: React.FC<RerenderAllDialogProps> = ({ initialMeta, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  const meta = (initialMeta || {}) as Record<string, any>;
  const [aspectRatio, setAspectRatio] = useState<string>(meta.aspect_ratio || "9:16");
  const [burnSubs, setBurnSubs] = useState<boolean>(meta.burn_subs ?? true);
  const [canvasConfig, setCanvasConfig] = useState<CanvasConfig>(meta.canvas_config || DEFAULT_CANVAS_CONFIG);
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(
    () =>
      meta.subtitle_config || {
        ...DEFAULT_SUBTITLE_CONFIG,
        style: meta.caption_style === "karaoke" ? "karaoke" : "standard",
      },
  );

  useEffect(() => cancelRef.current?.focus(), []);
  useEscape(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-scrim p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-card border border-border bg-bg-secondary shadow-dropdown"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <h2 id={titleId} className="text-section-title text-text-primary">{t("projects.rerender_title")}</h2>
          <Button variant="ghost" icon={X} aria-label={t("common.close")} onClick={onClose} />
        </div>

        <div className="flex flex-col gap-4 p-5">
          <Select
            label={t("create.shape_label")}
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            options={[
              { label: t("create.shape_vertical"), value: "9:16" },
              { label: t("create.shape_square"), value: "1:1" },
              { label: t("create.shape_wide"), value: "16:9" },
              ...(meta.aspect_ratio === "4:5" ? [{ label: "4:5", value: "4:5" }] : []),
            ]}
          />

          <ToggleSwitch checked={burnSubs} onChange={setBurnSubs} label={t("create.subtitles")} />

          {burnSubs && (
            <div className="border-t border-border pt-4">
              <SubtitleConfigControls
                config={subtitleConfig}
                onChange={setSubtitleConfig}
                showModeSwitch={true}
                aspectRatio={aspectRatio}
              />
            </div>
          )}

          {aspectRatio === "16:9" && (
            <div className="border-t border-border pt-4">
              <CanvasConfigControls config={canvasConfig} onChange={setCanvasConfig} showModeSwitch={true} />
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-border p-5 sm:flex-row sm:justify-end">
          <Button ref={cancelRef} variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => onConfirm({ aspectRatio, burnSubs, canvasConfig, subtitleConfig })}>
            {t("projects.rerender_start")}
          </Button>
        </div>
      </div>
    </div>
  );
};
