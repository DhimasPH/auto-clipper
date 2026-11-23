import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Select } from "../ui/Select";
import { ToggleSwitch } from "../ui/ToggleSwitch";
import { CanvasConfigControls } from "../ui/CanvasConfigControls";
import { SubtitleConfigControls } from "../ui/SubtitleConfigControls";
import { DEFAULT_CANVAS_CONFIG, type CanvasConfig } from "../../types/canvas";
import { DEFAULT_SUBTITLE_CONFIG, type SubtitleConfig } from "../../types/subtitle";

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

function initialOptions(meta: Record<string, any>): RerenderOptions {
  return {
    aspectRatio: meta.aspect_ratio || "9:16",
    burnSubs: meta.burn_subs ?? true,
    canvasConfig: meta.canvas_config || DEFAULT_CANVAS_CONFIG,
    subtitleConfig: meta.subtitle_config || {
      ...DEFAULT_SUBTITLE_CONFIG,
      style: meta.caption_style === "karaoke" ? "karaoke" : "standard",
    },
  };
}

const RerenderAllBody: React.FC<RerenderAllDialogProps> = ({ initialMeta, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const meta = (initialMeta || {}) as Record<string, any>;
  const [start] = useState(() => initialOptions(meta));
  const [opts, setOpts] = useState<RerenderOptions>(start);
  const set = (patch: Partial<RerenderOptions>) => setOpts((o) => ({ ...o, ...patch }));
  // Changed choices (including a typed watermark) are lost on close: ask first.
  const dirty = JSON.stringify(opts) !== JSON.stringify(start);

  return (
    <Dialog
      title={t("projects.rerender_title")}
      onClose={onClose}
      dirty={dirty}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => onConfirm(opts)}>{t("projects.rerender_start")}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          label={t("create.shape_label")}
          value={opts.aspectRatio}
          onChange={(e) => set({ aspectRatio: e.target.value })}
          options={[
            { label: t("create.shape_vertical"), value: "9:16" },
            { label: t("create.shape_square"), value: "1:1" },
            { label: t("create.shape_wide"), value: "16:9" },
            ...(meta.aspect_ratio === "4:5" ? [{ label: "4:5", value: "4:5" }] : []),
          ]}
        />

        <ToggleSwitch checked={opts.burnSubs} onChange={(v) => set({ burnSubs: v })} label={t("create.subtitles")} />

        {opts.burnSubs && (
          <div className="border-t border-border pt-4">
            <SubtitleConfigControls
              config={opts.subtitleConfig}
              onChange={(subtitleConfig) => set({ subtitleConfig })}
              showModeSwitch={true}
              aspectRatio={opts.aspectRatio}
            />
          </div>
        )}

        {opts.aspectRatio === "16:9" && (
          <div className="border-t border-border pt-4">
            <CanvasConfigControls config={opts.canvasConfig} onChange={(canvasConfig) => set({ canvasConfig })} showModeSwitch={true} />
          </div>
        )}
      </div>
    </Dialog>
  );
};
