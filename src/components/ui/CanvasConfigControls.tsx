import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Palette, Image as ImageIcon, Check, Upload, Trash2, Info, Monitor, Smartphone } from "lucide-react";
import { CanvasConfig } from "../../types/canvas";
import { open } from "@tauri-apps/plugin-dialog";

interface CanvasConfigControlsProps {
  config: CanvasConfig;
  onChange: (config: CanvasConfig) => void;
  /** Whether to show the top mode switch (Normal Landscape vs Convert to Vertical). Default true */
  showModeSwitch?: boolean;
}

const COLOR_PRESETS = [
  { label: "Pitch Black", value: "#000000" },
  { label: "Dark Slate", value: "#0F172A" },
  { label: "Navy Blue", value: "#1E293B" },
  { label: "Charcoal", value: "#334155" },
  { label: "Pure White", value: "#FFFFFF" },
];

export const CanvasConfigControls: React.FC<CanvasConfigControlsProps> = ({
  config,
  onChange,
  showModeSwitch = true,
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEnabled = config.enabled;
  const bgType = config.background_type || "blur";
  const blurLevel = config.blur_level || "medium";
  const bgColor = config.background_color || "#000000";
  const bgImage = config.background_image_path || "";
  const enlargeScale = config.enlarge_scale || 1.0;

  const handleSelectImage = async () => {
    try {
      if ("__TAURI_INTERNALS__" in window) {
        const selected = await open({
          multiple: false,
          filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] }],
        });
        if (selected && typeof selected === "string") {
          onChange({
            ...config,
            background_type: "image",
            background_image_path: selected,
          });
        }
      } else {
        fileInputRef.current?.click();
      }
    } catch (err) {
      console.error("Error opening file dialog:", err);
      fileInputRef.current?.click();
    }
  };

  const handleWebFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // In web fallback, we use object URL or name
      const fakePath = URL.createObjectURL(file);
      onChange({
        ...config,
        background_type: "image",
        background_image_path: (file as any).path || fakePath,
      });
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Mode Switch: Normal 16:9 vs Convert to 9:16 Canvas */}
      {showModeSwitch && (
        <div className="space-y-2">
          <label className="text-label text-text-secondary font-medium">
            {t("canvas.mode_label", "Format Output Landscape (16:9)")}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onChange({ ...config, enabled: false })}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                !isEnabled
                  ? "border-accent bg-accent/10 text-text-primary ring-1 ring-accent/30"
                  : "border-border bg-bg-surface text-text-secondary hover:border-border-active hover:text-text-primary"
              }`}
            >
              <div
                className={`p-2 rounded-lg mt-0.5 ${
                  !isEnabled ? "bg-accent text-white" : "bg-bg-secondary text-text-secondary"
                }`}
              >
                <Monitor className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm flex items-center justify-between">
                  <span>{t("canvas.mode_normal", "Normal Landscape (16:9)")}</span>
                  {!isEnabled && <Check className="w-4 h-4 text-accent" />}
                </div>
                <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                  {t("canvas.mode_normal_desc", "Video tetap 16:9 horizontal murni tanpa latar tambahan.")}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onChange({ ...config, enabled: true })}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                isEnabled
                  ? "border-accent bg-accent/10 text-text-primary ring-1 ring-accent/30"
                  : "border-border bg-bg-surface text-text-secondary hover:border-border-active hover:text-text-primary"
              }`}
            >
              <div
                className={`p-2 rounded-lg mt-0.5 ${
                  isEnabled ? "bg-accent text-white" : "bg-bg-secondary text-text-secondary"
                }`}
              >
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm flex items-center justify-between">
                  <span>{t("canvas.mode_convert_portrait", "Convert to 9:16 Vertical (Canvas)")}</span>
                  {isEnabled && <Check className="w-4 h-4 text-accent" />}
                </div>
                <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                  {t("canvas.mode_convert_portrait_desc", "Pertahankan video landscape utuh di tengah kanvas 9:16 vertikal dengan latar belakang estetik.")}
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Extended Canvas Configuration (shown only when enabled) */}
      {isEnabled && (
        <div className="p-4 bg-bg-secondary/70 rounded-xl border border-accent/20 space-y-5 animate-slide-up">
          {/* Background Options */}
          <div className="space-y-2">
            <label className="text-label text-text-secondary font-medium">
              {t("canvas.bg_options_label", "Gaya Latar Belakang (Background Style)")}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Blur Option */}
              <button
                type="button"
                onClick={() => onChange({ ...config, background_type: "blur" })}
                className={`p-3 rounded-lg border text-left transition-colors flex items-center gap-2.5 ${
                  bgType === "blur"
                    ? "border-accent bg-accent/15 text-accent font-medium"
                    : "border-border bg-bg-surface text-text-secondary hover:border-border-active hover:text-text-primary"
                }`}
              >
                <Sparkles className="w-4 h-4 shrink-0" />
                <span className="text-xs sm:text-sm truncate">
                  {t("canvas.bg_blur", "Latar Blur (Blurred)")}
                </span>
              </button>

              {/* Color Option */}
              <button
                type="button"
                onClick={() => onChange({ ...config, background_type: "color" })}
                className={`p-3 rounded-lg border text-left transition-colors flex items-center gap-2.5 ${
                  bgType === "color"
                    ? "border-accent bg-accent/15 text-accent font-medium"
                    : "border-border bg-bg-surface text-text-secondary hover:border-border-active hover:text-text-primary"
                }`}
              >
                <Palette className="w-4 h-4 shrink-0" />
                <span className="text-xs sm:text-sm truncate">
                  {t("canvas.bg_color", "Warna Polos (Solid Color)")}
                </span>
              </button>

              {/* Image Option */}
              <button
                type="button"
                onClick={() => onChange({ ...config, background_type: "image" })}
                className={`p-3 rounded-lg border text-left transition-colors flex items-center gap-2.5 ${
                  bgType === "image"
                    ? "border-accent bg-accent/15 text-accent font-medium"
                    : "border-border bg-bg-surface text-text-secondary hover:border-border-active hover:text-text-primary"
                }`}
              >
                <ImageIcon className="w-4 h-4 shrink-0" />
                <span className="text-xs sm:text-sm truncate">
                  {t("canvas.bg_image", "Gambar Kustom (Image)")}
                </span>
              </button>
            </div>
          </div>

          {/* Sub-config: Blur Level */}
          {bgType === "blur" && (
            <div className="space-y-2 pt-2 border-t border-border/50 animate-fade-in">
              <label className="text-caption text-text-secondary">
                {t("canvas.blur_level_label", "Intensitas Blur")}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["light", "medium", "strong"] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onChange({ ...config, blur_level: lvl })}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                      blurLevel === lvl
                        ? "border-accent bg-accent text-white"
                        : "border-border bg-bg-surface text-text-secondary hover:border-border-active hover:text-text-primary"
                    }`}
                  >
                    {lvl === "light"
                      ? t("canvas.blur_light", "Ringan (Light)")
                      : lvl === "medium"
                        ? t("canvas.blur_medium", "Sedang (Medium)")
                        : t("canvas.blur_strong", "Kuat (Strong)")}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sub-config: Color Picker */}
          {bgType === "color" && (
            <div className="space-y-3 pt-2 border-t border-border/50 animate-fade-in">
              <label className="text-caption text-text-secondary">
                {t("canvas.color_picker_label", "Pilih Warna Latar")}
              </label>
              <div className="flex flex-wrap items-center gap-3">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    title={preset.label}
                    onClick={() => onChange({ ...config, background_color: preset.value })}
                    className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                      bgColor.toUpperCase() === preset.value.toUpperCase()
                        ? "border-accent scale-110 shadow-sm ring-2 ring-accent/30"
                        : "border-border hover:border-text-secondary"
                    }`}
                    style={{ backgroundColor: preset.value }}
                  >
                    {bgColor.toUpperCase() === preset.value.toUpperCase() && (
                      <Check
                        className={`w-4 h-4 ${
                          preset.value === "#FFFFFF" ? "text-black" : "text-white"
                        }`}
                      />
                    )}
                  </button>
                ))}

                {/* Custom Color Input */}
                <div className="flex items-center gap-2 pl-2 border-l border-border">
                  <input
                    type="color"
                    value={bgColor.startsWith("#") && bgColor.length === 7 ? bgColor : "#000000"}
                    onChange={(e) => onChange({ ...config, background_color: e.target.value })}
                    className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-border"
                  />
                  <input
                    type="text"
                    value={bgColor}
                    onChange={(e) => onChange({ ...config, background_color: e.target.value })}
                    placeholder="#000000"
                    className="w-24 px-2 py-1 text-xs rounded-md bg-input-bg border border-border text-text-primary uppercase focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Sub-config: Image Picker */}
          {bgType === "image" && (
            <div className="space-y-3 pt-2 border-t border-border/50 animate-fade-in">
              <label className="text-caption text-text-secondary">
                {t("canvas.bg_image_desc", "Menggunakan gambar atau poster dari komputer lokal sebagai latar belakang.")}
              </label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleWebFileChange}
                accept="image/png, image/jpeg, image/jpg, image/webp"
                className="hidden"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectImage}
                  className="px-3.5 py-2 rounded-lg bg-bg-surface border border-border hover:border-accent hover:text-accent text-text-primary text-xs font-medium flex items-center gap-2 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  {bgImage
                    ? t("canvas.change_image_btn", "Ganti Gambar")
                    : t("canvas.select_image_btn", "Pilih Gambar Latar")}
                </button>
                {bgImage ? (
                  <div className="flex items-center gap-2 text-xs text-text-secondary truncate max-w-xs bg-bg-surface px-2.5 py-1.5 rounded-md border border-border">
                    <span className="truncate">{bgImage.split(/[\\/]/).pop()}</span>
                    <button
                      type="button"
                      onClick={() => onChange({ ...config, background_image_path: "" })}
                      className="text-red-400 hover:text-red-300 p-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-text-secondary italic">
                    {t("canvas.no_image_selected", "Belum ada gambar dipilih")}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Foreground Enlarge Scale Option */}
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <label className="text-label text-text-secondary font-medium">
                {t("canvas.enlarge_label", "Perbesar Video Utama (Enlarge Scale)")}
              </label>
              <span className="text-xs font-semibold text-accent">
                {enlargeScale === 1.0 ? "1.0x (Normal)" : `${enlargeScale}x`}
              </span>
            </div>
            <p className="text-caption text-text-secondary text-xs">
              {t(
                "canvas.enlarge_desc",
                "Perbesar ukuran video utama untuk mengisi ruang vertikal dan meminimalkan area latar belakang."
              )}
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {([1.0, 1.2, 1.5, 1.8, 2.0] as const).map((scale) => (
                <button
                  key={scale}
                  type="button"
                  onClick={() => onChange({ ...config, enlarge_scale: scale })}
                  className={`py-1.5 px-1 rounded-md border text-xs font-medium transition-colors ${
                    enlargeScale === scale
                      ? "border-accent bg-accent text-white"
                      : "border-border bg-bg-surface text-text-secondary hover:border-border-active hover:text-text-primary"
                  }`}
                >
                  {scale === 1.0 ? t("canvas.enlarge_none", "1.0x") : `${scale}x`}
                </button>
              ))}
            </div>
          </div>

          {/* Subtitle Auto-positioning Tip */}
          <div className="flex items-start gap-2 p-2.5 bg-accent/5 rounded-lg border border-accent/10 text-xs text-text-secondary">
            <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <span>
              {t("canvas.preview_hint", "Tip: Subtitle akan otomatis diposisikan tepat di bawah video utama secara rapi.")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
