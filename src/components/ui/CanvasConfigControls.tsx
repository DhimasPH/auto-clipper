import React, { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Upload, X } from "lucide-react";
import { uploadCanvasImage } from "../../api";
import { CanvasConfig } from "../../types/canvas";
import { platform } from "../../platform";
import { Button } from "./Button";
import { ChoiceButton } from "./ChoiceButton";

interface CanvasConfigControlsProps {
  config: CanvasConfig;
  onChange: (config: CanvasConfig) => void;
  /** Whether to show the top switch (stay wide vs make vertical). Default true. */
  showModeSwitch?: boolean;
}

const COLOR_PRESETS = [
  { key: "black", value: "#000000" },
  { key: "dark_blue", value: "#0F172A" },
  { key: "navy", value: "#1E293B" },
  { key: "charcoal", value: "#334155" },
  { key: "white", value: "#FFFFFF" },
] as const;

const BLUR_LEVELS = ["light", "medium", "strong"] as const;
const SCALES = [1.0, 1.2, 1.5, 1.8, 2.0] as const;

/** Small heading of one group of choices; the group is labelled by it. */
const GroupLabel: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => (
  <p id={id} className="text-label text-text-primary">{children}</p>
);

/** A wide (16:9) video kept wide, or placed in the middle of a vertical frame with a background (ADR-008). */
export const CanvasConfigControls: React.FC<CanvasConfigControlsProps> = ({
  config,
  onChange,
  showModeSwitch = true,
}) => {
  const { t } = useTranslation();
  const ids = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);
  const uploadSeq = useRef(0);
  const [uploading, setUploading] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);

  const isEnabled = config.enabled;

  // Another background, or "Gambar" again: an old "upload failed" no longer applies.
  const chooseBackground = (background_type: CanvasConfig["background_type"]) => {
    setUploadFailed(false);
    onChange({ ...config, background_type });
  };
  const bgType = config.background_type || "blur";
  const blurLevel = config.blur_level || "medium";
  const bgColor = config.background_color || "#000000";
  const bgImage = config.background_image_path || "";
  const enlargeScale = config.enlarge_scale || 1.0;

  const handleSelectImage = async () => {
    if (uploading) return;
    // No OS dialog (local/cloud): the browser file input, opened synchronously so the click still counts as a user gesture.
    if (!platform().caps.localFilePicker) {
      fileInputRef.current?.click();
      return;
    }
    try {
      const selected = await platform().pickImage();
      if (selected) {
        setUploadFailed(false);
        onChange({
          ...configRef.current,
          background_type: "image",
          background_image_path: selected,
        });
      }
    } catch (err) {
      console.error("Error opening file dialog:", err);
      fileInputRef.current?.click();
    }
  };

  // The backend cannot read a browser blob: address (spec 4.7): upload the image, keep its backend path.
  const handleWebFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const seq = ++uploadSeq.current;
    setUploading(true);
    setUploadFailed(false);
    try {
      const path = await uploadCanvasImage(file);
      if (seq !== uploadSeq.current) return;
      onChange({
        ...configRef.current,
        background_image_path: path,
      });
    } catch (err) {
      if (seq !== uploadSeq.current) return;
      console.error("Canvas image upload failed:", err);
      setUploadFailed(true);
    } finally {
      if (seq === uploadSeq.current) setUploading(false);
    }
  };

  const colorText = /^#[0-9a-f]{6}$/i.test(bgColor) ? bgColor : "#000000";

  return (
    <div className="flex flex-col gap-4">
      {showModeSwitch && (
        <div className="flex flex-col gap-2">
          <GroupLabel id={`${ids}-mode`}>{t("canvas.mode_label")}</GroupLabel>
          <div role="group" aria-labelledby={`${ids}-mode`} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ChoiceButton
              selected={!isEnabled}
              label={t("canvas.mode_normal")}
              description={t("canvas.mode_normal_desc")}
              onClick={() => onChange({ ...config, enabled: false })}
            />
            <ChoiceButton
              selected={isEnabled}
              label={t("canvas.mode_convert_portrait")}
              description={t("canvas.mode_convert_portrait_desc")}
              onClick={() => onChange({ ...config, enabled: true })}
            />
          </div>
        </div>
      )}

      {isEnabled && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <GroupLabel id={`${ids}-bg`}>{t("canvas.bg_options_label")}</GroupLabel>
            <div role="group" aria-labelledby={`${ids}-bg`} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <ChoiceButton selected={bgType === "blur"} label={t("canvas.bg_blur")} onClick={() => chooseBackground("blur")} />
              <ChoiceButton selected={bgType === "color"} label={t("canvas.bg_color")} onClick={() => chooseBackground("color")} />
              <ChoiceButton selected={bgType === "image"} label={t("canvas.bg_image")} onClick={() => chooseBackground("image")} />
            </div>
          </div>

          {bgType === "blur" && (
            <div className="flex flex-col gap-2">
              <GroupLabel id={`${ids}-blur`}>{t("canvas.blur_level_label")}</GroupLabel>
              <div role="group" aria-labelledby={`${ids}-blur`} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {BLUR_LEVELS.map((lvl) => (
                  <ChoiceButton
                    key={lvl}
                    selected={blurLevel === lvl}
                    label={t(`canvas.blur_${lvl}`)}
                    onClick={() => onChange({ ...config, blur_level: lvl })}
                  />
                ))}
              </div>
            </div>
          )}

          {bgType === "color" && (
            <div className="flex flex-col gap-2">
              <GroupLabel id={`${ids}-color`}>{t("canvas.color_picker_label")}</GroupLabel>
              <div role="group" aria-labelledby={`${ids}-color`} className="flex flex-wrap items-center gap-2">
                {COLOR_PRESETS.map((preset) => {
                  const selected = bgColor.toUpperCase() === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      aria-pressed={selected}
                      aria-label={t(`canvas.color_${preset.key}`)}
                      title={t(`canvas.color_${preset.key}`)}
                      onClick={() => onChange({ ...config, background_color: preset.value })}
                      className={`flex h-11 w-11 items-center justify-center rounded-full border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary ${
                        selected ? "border-accent" : "border-border-active"
                      }`}
                      style={{ backgroundColor: preset.value }}
                    >
                      {selected && (
                        <Check className={`h-5 w-5 ${preset.value === "#FFFFFF" ? "text-black" : "text-white"}`} aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1.5 text-label text-text-primary">
                  {t("canvas.color_custom")}
                  <input
                    type="color"
                    value={colorText}
                    onChange={(e) => onChange({ ...config, background_color: e.target.value })}
                    className="h-11 w-16 cursor-pointer rounded-input border border-border-active bg-bg-secondary p-1"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-label text-text-primary">
                  {t("canvas.color_code")}
                  <input
                    type="text"
                    value={bgColor}
                    onChange={(e) => onChange({ ...config, background_color: e.target.value })}
                    placeholder="#000000"
                    spellCheck={false}
                    className="min-h-[44px] w-32 rounded-input border border-border-active bg-bg-secondary px-3 font-mono text-body uppercase text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </label>
              </div>
            </div>
          )}

          {bgType === "image" && (
            <div className="flex flex-col gap-2">
              <p className="text-body text-text-secondary">{t("canvas.bg_image_desc")}</p>
              <input
                type="file"
                ref={fileInputRef}
                disabled={uploading}
                onChange={handleWebFileChange}
                accept="image/png, image/jpeg, image/jpg, image/webp"
                className="hidden"
                tabIndex={-1}
                aria-hidden="true"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" icon={Upload} disabled={uploading} onClick={() => void handleSelectImage()}>
                  {bgImage ? t("canvas.change_image_btn") : t("canvas.select_image_btn")}
                </Button>
                {bgImage ? (
                  <span className="flex min-w-0 items-center gap-1 text-body text-text-primary">
                    <span className="min-w-0 break-all">{bgImage.split(/[\\/]/).pop()}</span>
                    <Button
                      variant="ghost"
                      icon={X}
                      aria-label={t("canvas.remove_image")}
                      title={t("canvas.remove_image")}
                      onClick={() => {
                        setUploadFailed(false);
                        onChange({ ...config, background_image_path: "" });
                      }}
                    />
                  </span>
                ) : (
                  <span className="text-body text-text-secondary">{t("canvas.no_image_selected")}</span>
                )}
              </div>
              {uploading && (
                <p role="status" className="text-body text-text-secondary">
                  {t("canvas.uploading_image")}
                </p>
              )}
              {uploadFailed && (
                <p role="alert" className="text-body text-error">
                  {t("canvas.upload_failed")}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <GroupLabel id={`${ids}-scale`}>{t("canvas.enlarge_label")}</GroupLabel>
            <p className="text-caption text-text-secondary">{t("canvas.enlarge_desc")}</p>
            <div role="group" aria-labelledby={`${ids}-scale`} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {SCALES.map((scale) => (
                <ChoiceButton
                  key={scale}
                  selected={enlargeScale === scale}
                  label={scale === 1.0 ? t("canvas.enlarge_none") : `${scale}x`}
                  onClick={() => onChange({ ...config, enlarge_scale: scale })}
                />
              ))}
            </div>
          </div>

          <p className="text-caption text-text-secondary">{t("canvas.preview_hint")}</p>
        </div>
      )}
    </div>
  );
};
