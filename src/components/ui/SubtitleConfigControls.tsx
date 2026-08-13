import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, AlignLeft, Check, Palette, Eye, Type, Italic, Zap, ChevronDown, ChevronUp, Layers, Droplet } from "lucide-react";
import { SubtitleConfig, DEFAULT_SUBTITLE_CONFIG, SUBTITLE_PRESETS } from "../../types/subtitle";

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
  const [showAdvanced, setShowAdvanced] = useState(false);

  const styleMode = config.style || "single_word";
  const highlightColor = config.highlight_color || "#FFE600";
  const textColor = config.text_color || "#FFFFFF";
  const outlineColor = config.outline_color || "#000000";
  const shadowColor = config.shadow_color || "#000000";
  
  const fontFamily = config.font_family || "Arial";
  const fontSizeScale = config.font_size_scale || 1.0;
  const fontWeight = config.font_weight || "bold";
  const isItalic = !!config.italic;
  const isUppercase = config.uppercase !== undefined ? config.uppercase : true;
  
  const outlineWidth = config.outline_width !== undefined ? config.outline_width : 2;
  const shadowDepth = config.shadow_depth !== undefined ? config.shadow_depth : 2;
  const animationPop = !!config.animation_pop;

  const watermarkText = config.watermark_text || "";
  const watermarkOpacity = config.watermark_opacity !== undefined ? config.watermark_opacity : 0.5;

  const applyPreset = (presetConfig: Partial<SubtitleConfig>) => {
    onChange({ ...config, ...presetConfig });
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Quick Presets */}
      <div className="space-y-2">
        <label className="text-label text-text-secondary font-medium">
          {t("subtitle_custom.quick_presets", "Quick Presets (Rekomendasi)")}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {Object.entries(SUBTITLE_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(preset.config)}
              className="py-2 px-3 rounded-lg border border-border bg-bg-surface text-text-secondary hover:border-accent/50 hover:bg-accent/5 transition-all text-xs font-semibold"
            >
              {t(preset.label_key)}
            </button>
          ))}
        </div>
      </div>

      {/* Mode Switch: 3 modes */}
      {showModeSwitch && (
        <div className="space-y-2">
          <label className="text-label text-text-secondary font-medium">
            {t("subtitle_custom.style_mode", "Mode Tampilan Subtitle")}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Single Word Mode */}
            <button
              type="button"
              onClick={() => onChange({ ...config, style: "single_word" })}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-2 ${
                styleMode === "single_word"
                  ? "border-accent bg-accent/10 text-text-primary ring-1 ring-accent/30"
                  : "border-border bg-bg-surface text-text-secondary hover:border-border-active hover:text-text-primary"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div
                  className={`p-1.5 rounded-lg ${
                    styleMode === "single_word" ? "bg-accent text-white" : "bg-bg-secondary text-text-secondary"
                  }`}
                >
                  <Zap className="w-4 h-4" />
                </div>
                {styleMode === "single_word" && <Check className="w-4 h-4 text-accent" />}
              </div>
              <div>
                <div className="font-semibold text-sm">{t("subtitle_custom.style_single_word", "Single Word (Pop)")}</div>
                <p className="text-[10px] leading-tight text-text-secondary mt-1 opacity-80">
                  {t("subtitle_custom.style_single_word_desc", "Satu kata per layar dengan animasi pop. (Gaya Hormozi)")}
                </p>
              </div>
            </button>

            {/* Karaoke Mode */}
            <button
              type="button"
              onClick={() => onChange({ ...config, style: "karaoke" })}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-2 ${
                styleMode === "karaoke"
                  ? "border-accent bg-accent/10 text-text-primary ring-1 ring-accent/30"
                  : "border-border bg-bg-surface text-text-secondary hover:border-border-active hover:text-text-primary"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div
                  className={`p-1.5 rounded-lg ${
                    styleMode === "karaoke" ? "bg-accent text-white" : "bg-bg-secondary text-text-secondary"
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                </div>
                {styleMode === "karaoke" && <Check className="w-4 h-4 text-accent" />}
              </div>
              <div>
                <div className="font-semibold text-sm">{t("subtitle_custom.style_karaoke", "Karaoke (Highlight)")}</div>
                <p className="text-[10px] leading-tight text-text-secondary mt-1 opacity-80">
                  {t("subtitle_custom.style_karaoke_desc", "Menampilkan kalimat dan menyorot kata yang sedang diucapkan.")}
                </p>
              </div>
            </button>

            {/* Standard Mode */}
            <button
              type="button"
              onClick={() => onChange({ ...config, style: "standard" })}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-2 ${
                styleMode === "standard"
                  ? "border-accent bg-accent/10 text-text-primary ring-1 ring-accent/30"
                  : "border-border bg-bg-surface text-text-secondary hover:border-border-active hover:text-text-primary"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div
                  className={`p-1.5 rounded-lg ${
                    styleMode === "standard" ? "bg-accent text-white" : "bg-bg-secondary text-text-secondary"
                  }`}
                >
                  <AlignLeft className="w-4 h-4" />
                </div>
                {styleMode === "standard" && <Check className="w-4 h-4 text-accent" />}
              </div>
              <div>
                <div className="font-semibold text-sm">{t("subtitle_custom.style_standard", "Standar")}</div>
                <p className="text-[10px] leading-tight text-text-secondary mt-1 opacity-80">
                  {t("subtitle_custom.style_standard_desc", "Menampilkan kalimat penuh secara statis.")}
                </p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Typography & Appearance Config Card */}
      <div className="p-4 bg-bg-secondary/70 rounded-xl border border-accent/20 space-y-4 animate-slide-up">
        {/* Live Preview Box */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary uppercase tracking-wider">
            <Eye className="w-3.5 h-3.5 text-accent" />
            <span>{t("subtitle_custom.preview_title", "Pratinjau Langsung Subtitle (Live Preview)")}</span>
          </div>

          <div className="relative w-full h-28 rounded-xl bg-gradient-to-br from-slate-900 via-neutral-950 to-zinc-900 border border-border flex items-center justify-center p-4 overflow-hidden shadow-inner">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:12px_12px]" />

            <div
              className="relative text-center px-4 py-2 transition-all duration-200"
              style={{
                fontFamily: fontFamily,
                fontWeight: fontWeight === "bold" ? 700 : 400,
                fontStyle: isItalic ? "italic" : "normal",
                textTransform: isUppercase ? "uppercase" : "none",
                fontSize: `${Math.round(18 * fontSizeScale)}px`,
                color: textColor,
                WebkitTextStroke: `${outlineWidth}px ${outlineColor}`,
                textShadow: shadowDepth > 0 ? `0px ${shadowDepth}px ${shadowDepth*2}px ${shadowColor}` : "none",
                transform: styleMode === "single_word" && animationPop ? "scale(1.1)" : "scale(1)",
              }}
            >
              {styleMode === "single_word" ? (
                <span className="text-white" style={{ color: highlightColor }}>
                  {t("subtitle_custom.preview_single_word_text", "VIRAL")}
                </span>
              ) : styleMode === "karaoke" ? (
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <span>{t("subtitle_custom.preview_karaoke_text_before", "BUAT KONTEN JADI LEBIH")}</span>
                  <span style={{ color: highlightColor }}>
                    {t("subtitle_custom.preview_karaoke_highlight", "VIRAL")}
                  </span>
                  <span>{t("subtitle_custom.preview_karaoke_text_after", "SEKARANG")}</span>
                </div>
              ) : (
                <span>
                  {t("subtitle_custom.preview_standard_text", "Buat konten video Anda menjadi viral")}
                </span>
              )}
            </div>

            {/* Watermark Preview */}
            {watermarkText && (
              <div 
                className="absolute bottom-2 text-center w-full text-white text-[10px] drop-shadow-md z-10 transition-opacity"
                style={{ opacity: watermarkOpacity }}
              >
                {watermarkText}
              </div>
            )}
          </div>
        </div>

        {/* Accordion Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full py-2 px-3 flex items-center justify-between bg-bg-surface hover:bg-bg-surface-hover border border-border rounded-lg transition-colors text-sm font-medium"
        >
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-accent" />
            {t("subtitle_custom.advanced_toggle", "Pengaturan Tampilan Lanjutan")}
          </div>
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Advanced Accordion Content */}
        {showAdvanced && (
          <div className="space-y-5 pt-3 animate-slide-up border-t border-border/50">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-label text-text-secondary font-medium">
                    {t("subtitle_custom.font_size_label", "Ukuran Huruf (Font Size)")}
                  </label>
                  <span className="text-xs font-semibold text-accent">{fontSizeScale}x</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[0.8, 1.0, 1.2, 1.5].map((scale) => (
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
                      {scale}x
                    </button>
                  ))}
                </div>
              </div>

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

            {/* Visual Effects & Animation */}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <label className="text-label text-text-secondary font-medium">
                {t("subtitle_custom.visual_effects", "Efek Visual & Animasi")}
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs text-text-secondary mb-1">
                    <span>{t("subtitle_custom.outline_width", "Tebal Garis Tepi")}</span>
                    <span>{outlineWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="1"
                    value={outlineWidth}
                    onChange={(e) => onChange({ ...config, outline_width: parseInt(e.target.value) })}
                    className="w-full accent-accent cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs text-text-secondary mb-1">
                    <span>{t("subtitle_custom.shadow_depth", "Kedalaman Bayangan")}</span>
                    <span>{shadowDepth}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={shadowDepth}
                    onChange={(e) => onChange({ ...config, shadow_depth: parseInt(e.target.value) })}
                    className="w-full accent-accent cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => onChange({ ...config, animation_pop: !animationPop })}
                  className={`p-2.5 rounded-lg border text-left transition-colors flex items-center justify-between ${
                    animationPop
                      ? "border-accent bg-accent/10 text-text-primary"
                      : "border-border bg-bg-surface text-text-secondary hover:border-border-active"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-[11px] font-medium leading-tight">
                      {t("subtitle_custom.animation_pop", "Animasi Pop (Zoom)")}
                    </span>
                  </div>
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${
                      animationPop ? "bg-accent border-accent text-white" : "border-border"
                    }`}
                  >
                    {animationPop && <Check className="w-2.5 h-2.5" />}
                  </div>
                </button>
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
                    <Type className="w-4 h-4 text-accent shrink-0" />
                    <span className="text-[11px] font-medium leading-tight">
                      {t("subtitle_custom.uppercase_toggle", "HURUF BESAR SEMUA")}
                    </span>
                  </div>
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${
                      isUppercase ? "bg-accent border-accent text-white" : "border-border"
                    }`}
                  >
                    {isUppercase && <Check className="w-2.5 h-2.5" />}
                  </div>
                </button>
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
                    <span className="text-[11px] font-medium leading-tight">
                      {t("subtitle_custom.italic_toggle", "Huruf Miring (Italic)")}
                    </span>
                  </div>
                  <div
                    className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 ${
                      isItalic ? "bg-accent border-accent text-white" : "border-border"
                    }`}
                  >
                    {isItalic && <Check className="w-2.5 h-2.5" />}
                  </div>
                </button>
              </div>
            </div>

            {/* Colors Section */}
            <div className="space-y-4 pt-2 border-t border-border/50">
              <label className="text-label text-text-secondary font-medium flex items-center gap-2">
                <Droplet className="w-4 h-4 text-accent" />
                <span>{t("subtitle_custom.colors_label", "Pengaturan Warna")}</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-xs text-text-secondary">{t("subtitle_custom.text_color", "Warna Teks Utama")}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => onChange({ ...config, text_color: e.target.value })}
                      className="w-8 h-8 rounded bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={textColor}
                      onChange={(e) => onChange({ ...config, text_color: e.target.value })}
                      className="flex-1 px-2 py-1 text-xs rounded-md bg-input-bg border border-border text-text-primary"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs text-text-secondary">{t("subtitle_custom.highlight_color", "Warna Sorotan (Highlight)")}</span>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={highlightColor}
                        onChange={(e) => onChange({ ...config, highlight_color: e.target.value })}
                        className="w-8 h-8 rounded bg-transparent cursor-pointer"
                      />
                      <input
                        type="text"
                        value={highlightColor}
                        onChange={(e) => onChange({ ...config, highlight_color: e.target.value })}
                        className="flex-1 px-2 py-1 text-xs rounded-md bg-input-bg border border-border text-text-primary"
                      />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {COLOR_PRESETS.map((p) => (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => onChange({ ...config, highlight_color: p.value })}
                          className="w-5 h-5 rounded-full border border-border transition-transform hover:scale-110"
                          style={{ backgroundColor: p.value }}
                          title={p.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Watermark Section */}
            <div className="space-y-3 pt-2 border-t border-border/50">
              <label className="text-label text-text-secondary font-medium flex items-center gap-2">
                <Layers className="w-4 h-4 text-accent" />
                <span>Watermark Video (Teks Sumber)</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <input
                    type="text"
                    placeholder="misal: sc: youtube raditya dika"
                    value={watermarkText}
                    onChange={(e) => onChange({ ...config, watermark_text: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg bg-input-bg border border-border text-text-primary focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="space-y-1 flex flex-col justify-center">
                  <div className="flex justify-between items-center text-xs text-text-secondary mb-1">
                    <span>Opacity</span>
                    <span>{Math.round(watermarkOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={watermarkOpacity}
                    onChange={(e) => onChange({ ...config, watermark_opacity: parseFloat(e.target.value) })}
                    className="w-full accent-accent cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
