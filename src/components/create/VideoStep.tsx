import React from "react";
import { useTranslation } from "react-i18next";
import { FileVideo, HardDrive } from "lucide-react";
import { linkProblem } from "../../lib/createFlow";
import type { ShapeValue } from "../../lib/clipChoices";
import { Button } from "../ui/Button";
import { InputGroup } from "../ui/InputGroup";

const SHAPES: { value: ShapeValue; key: string; box: string }[] = [
  { value: "9:16", key: "create.shape_vertical", box: "h-6 w-[14px]" },
  { value: "1:1", key: "create.shape_square", box: "h-5 w-5" },
  { value: "16:9", key: "create.shape_wide", box: "h-[14px] w-6" },
];

export interface VideoStepProps {
  link: string;
  onLinkChange: (value: string) => void;
  /** Name of the chosen file (upload or Drive), or null when a link is used. */
  chosenFile: string | null;
  onClearFile: () => void;
  onPickFile: () => void;
  /** Cloud only (caps.driveBrowser). */
  onPickDrive?: () => void;
  shape: ShapeValue;
  onShapeChange: (shape: ShapeValue) => void;
  pickButtonRef?: React.Ref<HTMLButtonElement>;
}

/** Step 1 (spec 4.2): which video, and which clip shape. */
export const VideoStep: React.FC<VideoStepProps> = ({
  link,
  onLinkChange,
  chosenFile,
  onClearFile,
  onPickFile,
  onPickDrive,
  shape,
  onShapeChange,
  pickButtonRef,
}) => {
  const { t } = useTranslation();
  const problem = link.trim() ? linkProblem(link) : null;

  return (
    <section className="flex flex-col gap-5 rounded-card border border-border bg-bg-secondary p-4 md:p-6">
      {chosenFile ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body text-text-primary break-all">{t("create.chosen_file", { name: chosenFile })}</p>
          <Button variant="outline" onClick={onClearFile}>
            {t("create.clear_file")}
          </Button>
        </div>
      ) : (
        <InputGroup
          type="url"
          inputMode="url"
          autoComplete="off"
          label={t("create.link_label")}
          placeholder="https://youtube.com/…"
          value={link}
          onChange={(e) => onLinkChange(e.target.value)}
          error={problem !== null}
          helperText={problem ? t("create.link_unsupported") : undefined}
        />
      )}

      <div className="flex flex-col gap-3">
        <p className="text-label text-text-secondary">{t("create.or")}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Icons tell a file from Google Drive at a glance; the text says it. */}
          <Button ref={pickButtonRef} variant="outline" icon={FileVideo} onClick={onPickFile}>
            {t("create.pick_file")}
          </Button>
          {onPickDrive && (
            <Button variant="outline" icon={HardDrive} onClick={onPickDrive}>
              {t("create.pick_drive")}
            </Button>
          )}
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label text-text-primary">{t("create.shape_label")}</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SHAPES.map(({ value, key, box }) => (
            <label
              key={value}
              className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-card border p-3 ${
                shape === value ? "border-accent bg-accent-muted" : "border-border-active bg-bg-secondary hover:bg-bg-surface"
              }`}
            >
              <input
                type="radio"
                name="clip-shape"
                value={value}
                checked={shape === value}
                onChange={() => onShapeChange(value)}
                className="h-5 w-5 shrink-0 accent-[var(--accent)]"
              />
              {/* The outline shows the shape itself: it is the meaning, not decoration. */}
              <span aria-hidden="true" className={`shrink-0 rounded-sm border-2 border-current text-text-secondary ${box}`} />
              <span className="text-body text-text-primary">{t(key)}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
};
