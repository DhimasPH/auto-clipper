import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { MAX_CLIP_OPTIONS, type ClipChoices } from "../../lib/clipChoices";
import { platform } from "../../platform";
import { CanvasConfigControls } from "../ui/CanvasConfigControls";
import { InputGroup } from "../ui/InputGroup";
import { Select } from "../ui/Select";
import { SubtitleConfigControls } from "../ui/SubtitleConfigControls";
import { ToggleSwitch } from "../ui/ToggleSwitch";

export interface ClipOptionsProps {
  choices: ClipChoices;
  onChange: (patch: Partial<ClipChoices>) => void;
  title: string;
  onTitleChange: (title: string) => void;
  quality: string;
  onQualityChange: (quality: string) => void;
  /** Download quality only matters for links. */
  showQuality: boolean;
  hasPexelsKey: boolean;
}

const QUALITIES = ["2160p", "1440p", "1080p", "720p", "480p"];

function Row({ label, help, children }: { label?: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-border pt-4">
      {label && <p className="text-label text-text-primary">{label}</p>}
      {children}
      {help && <p className="text-caption text-text-secondary">{help}</p>}
    </div>
  );
}

/** "Atur tampilan klip" (spec 4.2): closed by default, good defaults, remembered by App. */
export const ClipOptions: React.FC<ClipOptionsProps> = ({
  choices,
  onChange,
  title,
  onTitleChange,
  quality,
  onQualityChange,
  showQuality,
  hasPexelsKey,
}) => {
  const { t } = useTranslation();
  const caps = platform().caps;
  const wide = choices.aspectRatio === "16:9";

  return (
    <details className="group rounded-card border border-border bg-bg-secondary">
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 text-body font-semibold text-text-primary [&::-webkit-details-marker]:hidden">
        {t("create.options")}
        {/* Chevron shows expand/collapse disclosure state for the summary control. */}
        <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>

      <div className="flex flex-col gap-4 px-4 pb-4">
        <InputGroup
          label={t("create.project_name")}
          helperText={t("create.project_name_help")}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />

        <Row>
          <ToggleSwitch label={t("create.subtitles")} checked={choices.burnSubtitles} onChange={(v) => onChange({ burnSubtitles: v })} />
          {choices.burnSubtitles && (
            <SubtitleConfigControls
              config={choices.subtitleConfig}
              onChange={(subtitleConfig) => onChange({ subtitleConfig })}
              showModeSwitch={true}
              aspectRatio={choices.aspectRatio}
            />
          )}
        </Row>

        {wide ? (
          <Row>
            <CanvasConfigControls config={choices.canvasConfig} onChange={(canvasConfig) => onChange({ canvasConfig })} showModeSwitch={true} />
          </Row>
        ) : (
          <Row label={t("create.face_label")}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(["auto", "center"] as const).map((mode) => (
                <label key={mode} className="flex min-h-[44px] cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="tracking-mode"
                    checked={choices.trackingMode === mode}
                    onChange={() => onChange({ trackingMode: mode })}
                    className="h-5 w-5 accent-[var(--accent)]"
                  />
                  <span className="text-body">{t(mode === "auto" ? "create.face_follow" : "create.face_center")}</span>
                </label>
              ))}
            </div>
          </Row>
        )}

        <Row help={t("create.hook_help")}>
          <ToggleSwitch label={t("create.hook")} checked={choices.enableHook} onChange={(v) => onChange({ enableHook: v })} />
        </Row>

        {caps.apiKeys && (
          <Row help={t(hasPexelsKey ? "create.broll_help" : "create.broll_needs_key")}>
            <ToggleSwitch
              label={t("create.broll")}
              checked={choices.enableBroll && hasPexelsKey}
              disabled={!hasPexelsKey}
              onChange={(v) => onChange({ enableBroll: v })}
            />
          </Row>
        )}

        {choices.aspectRatio === "9:16" && (
          <Row help={t("create.game_help")}>
            <ToggleSwitch label={t("create.game")} checked={choices.isGamingVideo} onChange={(v) => onChange({ isGamingVideo: v })} />
          </Row>
        )}

        {showQuality && (
          <Select
            label={t("create.quality")}
            value={quality}
            onChange={(e) => onQualityChange(e.target.value)}
            options={[
              { label: t("create.quality_auto"), value: "best" },
              ...QUALITIES.map((q) => ({ label: q === "2160p" ? "2160p (4K)" : q === "1440p" ? "1440p (2K)" : q, value: q })),
            ]}
          />
        )}

        <Select
          label={t("create.max_clips")}
          value={String(choices.maxClips)}
          onChange={(e) => onChange({ maxClips: Number(e.target.value) })}
          options={MAX_CLIP_OPTIONS.map((n) => ({ label: n === 0 ? t("create.max_clips_auto") : String(n), value: String(n) }))}
        />
      </div>
    </details>
  );
};
