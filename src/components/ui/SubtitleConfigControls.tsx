import React from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, AlignLeft, Check, Palette, Eye, Type, Italic } from "lucide-react";
import { SubtitleConfig, DEFAULT_SUBTITLE_CONFIG } from "../../types/subtitle";

interface SubtitleConfigControlsProps {
  config: SubtitleConfig;
  onChange: (config: SubtitleConfig) => void;
  showModeSwitch?: boolean;
}

const COLOR_PRESETS = [
  { label: "Yellow Neon", value: "#FFE600" },
  { label: "Cyan Aqua", value: "#00FFFF" },
  { label: "Lime Green", value: "#00FF66" },
  { label: "Hot Pink", value: "#FF3366" },
  { label: "Pure White", value: "#FFFFFF" },
  { label: "Vibrant Orange", value: "#FF9900" },
];

const FONT_PRESETS = [
  { label: "Arial (Standard)", value: "Arial" },
  { label: "Montserrat (Modern)", value: "Montserrat" },
  { label: "Impact (Bold Headline)", value: "Impact" },
  { label: "Roboto (Clean)", value: "Roboto" },
  { label: "Oswald (Condensed)", value: "Oswald" },
  { label: "Bebas Neue (Viral)", value: "Bebas Neue" },
  { label: "Courier New (Retro)", value: "Courier New" },
];

export const SubtitleConfigControls: React.FC<SubtitleConfigControlsProps> = ({
  config = DEFAULT_SUBTITLE_CONFIG,
  onChange,
  showModeSwitch = true,
}) => {
  const { t } = useTranslation();

  const styleMode = config.style || "karaoke";
  const highlightColor = config.highlight_color || "#FFE600";
  const fontFamily = config.font_family || "Arial";
  const fontSizeScale = config.font_size_scale || 1.0;
  const fontWeight = config.font_weight || "bold";
  const isItalic = !!config.italic;
  const isUppercase = config.uppercase !== undefined ? config.uppercase : true;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Mode Switch: Karaoke vs Standard */}
      {showModeSwitch && (
        <div className="space-y-2">
          <label className="text-label text-text-secondary font-medium">
            {t("subtitle_custom.style_mode", "Mode Tampilan Subtitle")}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onChange({ ...config, style: "karaoke" })}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                styleMode === "karaoke"
                  ? "border-accent bg-accent/10 text-text-primary ring-1 ring-accent/30"
                  : "border-border bg-bg-surface text-text-secondary hover:border-border-active hover:text-text-primary"
              }`}
            >
              <div
                className={`p-2 rounded-lg mt-0.5 ${
                  styleMode === "karaoke" ? "bg-accent text-white" : "bg-bg-secondary text-text-secondary"
                }`}
              >
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm flex items-center justify-between">
                  <span>{t("subtitle_custom.style_karaoke", "Karaoke (Word-by-word)")}</span>
                  {styleMode === "karaoke" && <Check className="w-4 h-4 text-accent" />}
                </div>
                <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                  {t(
                    "subtitle_custom.style_karaoke_desc",
                    "Setiap kata yang diucapkan akan menyala terang satu per satu, sangat cocok untuk video Shorts/TikTok."
                  )}
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onChange({ ...config, style: "standard" })}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                styleMode === "standard"
                  ? "border-accent bg-accent/10 text-text-primary ring-1 ring-accent/30"
                  : "border-border bg-bg-surface text-text-secondary hover:border-border-active hover:text-text-primary"
              }`}
            >
              <div
                className={`p-2 rounded-lg mt-0.5 ${
                  styleMode === "standard" ? "bg-accent text-white" : "bg-bg-secondary text-text-secondary"
                }`}
              >
                <AlignLeft className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm flex items-center justify-between">
                  <span>{t("subtitle_custom.style_standard", "Standar (Kalimat Penuh)")}</span>
                  {styleMode === "standard" && <Check className="w-4 h-4 text-accent" />}
                </div>
                <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                  {t(
                    "subtitle_custom.style_standard_desc",
                    "Menampilkan satu baris kalimat lengkap secara statis."
                  )}
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Typography & Appearance Config Card */}
      <div className="p-4 bg-bg-secondary/70 rounded-xl border border-accent/20 space-y-5 animate-slide-up">
        {/* Live Preview Box */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary uppercase tracking-wider">
            <Eye className="w-3.5 h-3.5 text-accent" />
            <span>{t("subtitle_custom.preview_title", "Pratinjau Langsung Subtitle (Live Preview)")}</span>
          </div>

          <div className="relative w-full h-28 rounded-xl bg-gradient-to-br from-slate-900 via-neutral-950 to-zinc-900 border border-border flex items-center justify-center p-4 overflow-hidden shadow-inner">
            {/* Simulated background dots */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:12px_12px]" />

            <div
              className="relative text-center px-4 py-2 transition-all duration-200"
              style={{
                fontFamily: fontFamily,
                fontWeight: fontWeight === "bold" ? 700 : 400,
                fontStyle: isItalic ? "italic" : "normal",
                textTransform: isUppercase ? "uppercase" : "none",
                fontSize: `${Math.round(18 * fontSizeScale)}px`,
                textShadow:
                  "0px 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 8px rgba(0,0,0,0.8)",
              }}
            >
              {styleMode === "karaoke" ? (
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <span className="text-white">
                    {t("subtitle_custom.preview_karaoke_text_before", "BUAT KONTEN JADI LEBIH")}
                  </span>
                  <span
                    className="font-extrabold px-1.5 py-0.5 rounded transition-colors"
                    style={{
                      color: highlightColor,
                      textShadow: `0 0 10px ${highlightColor}66, 0px 2px 4px rgba(0,0,0,0.9), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000`,
                    }}
                  >
                    {t("subtitle_custom.preview_karaoke_highlight", "VIRAL")}
                  </span>
                  <span className="text-white">
                    {t("subtitle_custom.preview_karaoke_text_after", "SEKARANG")}
                  </span>
                </div>
              ) : (
                <span className="text-white">
                  {t(
                    "subtitle_custom.preview_standard_text",
                    "Buat konten video Anda menjadi lebih menarik dan viral!"
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Font Family Selection */}
        <div className="space-y-2">
          <label className="text-label text-text-secondary font-medium flex items-center gap-2">
            <Type className="w-4 h-4 text-accent" />
            <span>{t("subtitle_custom.font_family_label", "Jenis Huruf (Font Family)")}</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {FONT_PRESETS.map((font) => (
              <button
                key={font.value}
                type="button"
                onClick={() => onChange({ ...config, font_family: font.value })}
                className={`py-2 px-2.5 rounded-lg border text-xs text-left truncate transition-all ${
                  fontFamily === font.value
                    ? "border-accent bg-accent/15 text-accent font-semibold ring-1 ring-accent/30"
                    : "border-border bg-bg-surface text-text-secondary hover:border-border-active hover:text-text-primary"
                }`}
                style={{ fontFamily: font.value }}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{font.label.split(" ")[0]}</span>
                  {fontFamily === font.value && <Check className="w-3.5 h-3.5 shrink-0" />}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Font Size & Weight Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/50">
          {/* Font Size Scale */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-label text-text-secondary font-medium">
                {t("subtitle_custom.font_size_label", "Ukuran Huruf (Font Size)")}
              </label>
              <span className="text-xs font-semibold text-accent">{fontSizeScale}x</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { scale: 0.8, label: t("subtitle_custom.font_size_small", "0.8x") },
                { scale: 1.0, label: t("subtitle_custom.font_size_normal", "1.0x") },
                { scale: 1.2, label: t("subtitle_custom.font_size_large", "1.2x") },
                { scale: 1.5, label: t("subtitle_custom.font_size_xl", "1.5x") },
              ].map(({ scale, label }) => (
                <button
                  key={scale}
                  type="button"
                  onClick={() => onChange({ ...config, font_size_scale: scale })}
                  className={`py-1.5 px-1 rounded-lg border text-xs font-medium transition-colors ${
                    fontSizeScale === scale
                      ? "border-accent bg-accent text-white"
                      : "border-border bg-bg-surface text-text-secondary hover:border-border-active hover:text-text-primary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Font Weight */}
          <div className="space-y-2">
            <label className="text-label text-text-secondary font-medium">
              {t("subtitle_custom.font_weight_label", "Ketebalan Huruf (Font Weight)")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onChange({ ...config, font_weight: "normal" })}
                className={`py-1.5 px-3 rounded-lg border text-xs font-medium transition-colors ${
                  fontWeight === "normal"
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-bg-surface text-text-secondary hover:border-border-active hover:text-text-primary"
                }`}
              >
                {t("subtitle_custom.weight_normal", "Normal")}
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...config, font_weight: "bold" })}
                className={`py-1.5 px-3 rounded-lg border text-xs font-bold transition-colors ${
                  fontWeight === "bold"
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-bg-surface text-text-secondary hover:border-border-active hover:text-text-primary"
                }`}
              >
                {t("subtitle_custom.weight_bold", "Tebal (Bold)")}
              </button>
            </div>
          </div>
        </div>

        {/* Text Style Toggles (UPPERCASE & Italic) */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          <label className="text-label text-text-secondary font-medium">
            {t("subtitle_custom.options_label", "Gaya Tambahan (Text Styling)")}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Uppercase Toggle */}
            <button
              type="button"
              onClick={() => onChange({ ...config, uppercase: !isUppercase })}
              className={`p-2.5 rounded-lg border text-left transition-colors flex items-center justify-between ${
                isUppercase
                  ? "border-accent bg-accent/10 text-text-primary"
                  : "border-border bg-bg-surface text-text-secondary hover:border-border-active"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs bg-bg-secondary px-1.5 py-0.5 rounded border border-border">
                  AA
                </span>
                <span className="text-xs font-medium">
                  {t("subtitle_custom.uppercase_toggle", "HURUF BESAR SEMUA (UPPERCASE)")}
                </span>
              </div>
              <div
                className={`w-4 h-4 rounded flex items-center justify-center border ${
                  isUppercase ? "bg-accent border-accent text-white" : "border-border"
                }`}
              >
                {isUppercase && <Check className="w-3 h-3" />}
              </div>
            </button>

            {/* Italic Toggle */}
            <button
              type="button"
              onClick={() => onChange({ ...config, italic: !isItalic })}
              className={`p-2.5 rounded-lg border text-left transition-colors flex items-center justify-between ${
                isItalic
                  ? "border-accent bg-accent/10 text-text-primary"
                  : "border-border bg-bg-surface text-text-secondary hover:border-border-active"
              }`}
            >
              <div className="flex items-center gap-2">
                <Italic className="w-4 h-4 text-accent shrink-0" />
                <span className="text-xs font-medium">
                  {t("subtitle_custom.italic_toggle", "Huruf Miring (Italic)")}
                </span>
              </div>
              <div
                className={`w-4 h-4 rounded flex items-center justify-center border ${
                  isItalic ? "bg-accent border-accent text-white" : "border-border"
                }`}
              >
                {isItalic && <Check className="w-3 h-3" />}
              </div>
            </button>
          </div>
        </div>

        {/* Highlight Color Picker (Active for Karaoke mode) */}
        {styleMode === "karaoke" && (
          <div className="space-y-3 pt-2 border-t border-border/50 animate-fade-in">
            <label className="text-label text-text-secondary font-medium flex items-center gap-2">
              <Palette className="w-4 h-4 text-accent" />
              <span>{t("subtitle_custom.highlight_color_label", "Warna Sorotan Kata (Highlight Color)")}</span>
            </label>
            <div className="flex flex-wrap items-center gap-3">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  title={preset.label}
                  onClick={() => onChange({ ...config, highlight_color: preset.value })}
                  className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                    highlightColor.toUpperCase() === preset.value.toUpperCase()
                      ? "border-accent scale-110 shadow-sm ring-2 ring-accent/30"
                      : "border-border hover:border-text-secondary"
                  }`}
                  style={{ backgroundColor: preset.value }}
                >
                  {highlightColor.toUpperCase() === preset.value.toUpperCase() && (
                    <Check
                      className={`w-4 h-4 ${
                        preset.value === "#FFFFFF" || preset.value === "#FFE600" || preset.value === "#00FF66" || preset.value === "#00FFFF"
                          ? "text-black"
                          : "text-white"
                      }`}
                    />
                  )}
                </button>
              ))}

              {/* Custom Color Input */}
              <div className="flex items-center gap-2 pl-2 border-l border-border">
                <input
                  type="color"
                  value={highlightColor.startsWith("#") && highlightColor.length === 7 ? highlightColor : "#FFE600"}
                  onChange={(e) => onChange({ ...config, highlight_color: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-border"
                />
                <input
                  type="text"
                  value={highlightColor}
                  onChange={(e) => onChange({ ...config, highlight_color: e.target.value })}
                  placeholder="#FFE600"
                  className="w-24 px-2 py-1 text-xs rounded-md bg-input-bg border border-border text-text-primary uppercase focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
