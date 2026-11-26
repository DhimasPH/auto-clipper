import React, { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown } from "lucide-react";
import { SubtitleConfig, DEFAULT_SUBTITLE_CONFIG, SUBTITLE_PRESETS } from "../../types/subtitle";
import { ChoiceButton } from "./ChoiceButton";
import { ToggleSwitch } from "./ToggleSwitch";

interface SubtitleConfigControlsProps {
  config: SubtitleConfig;
  onChange: (config: SubtitleConfig) => void;
  showModeSwitch?: boolean;
  aspectRatio?: string;
}

const COLOR_PRESETS = [
  { key: "yellow", value: "#FFE600" },
  { key: "cyan", value: "#00FFFF" },
  { key: "green", value: "#00FF66" },
  { key: "pink", value: "#FF3366" },
  { key: "white", value: "#FFFFFF" },
  { key: "orange", value: "#FF9900" },
] as const;

const FONTS = ["Arial", "Montserrat", "Impact", "Roboto", "Oswald", "Bebas Neue", "Courier New"];
const SIZES = [0.8, 1.0, 1.2, 1.5];
const STYLES = ["single_word", "karaoke", "standard"] as const;

const inputClass =
  "min-h-[44px] rounded-input border border-border-active bg-bg-secondary px-3 text-body text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

/** A range slider with its label and current value; 44 px tall for touch. */
const Slider: React.FC<{
  label: string;
  valueText: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}> = ({ label, valueText, min, max, step, value, onChange }) => {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-label text-text-primary">
        <label htmlFor={id}>{label}</label>
        <span className="text-caption text-text-secondary">{valueText}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-h-[44px] w-full cursor-pointer accent-[var(--accent)]"
      />
    </div>
  );
};

/** A colour: the system picker plus the hex code, both labelled. */
const ColorField: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <p id={id} className="text-label text-text-primary">{label}</p>
      <div role="group" aria-labelledby={id} className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#FFFFFF"}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-16 shrink-0 cursor-pointer rounded-input border border-border-active bg-bg-secondary p-1"
        />
        <input
          type="text"
          aria-label={t("subtitle_custom.color_code", { name: label })}
          value={value}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} w-32 min-w-0 font-mono uppercase`}
        />
      </div>
    </div>
  );
};

/** Subtitle look (ADR-009): ready-made styles, how words appear, then letters, position and colours. */
export const SubtitleConfigControls: React.FC<SubtitleConfigControlsProps> = ({
  config = DEFAULT_SUBTITLE_CONFIG,
  onChange,
  showModeSwitch = true,
  aspectRatio = "9:16",
}) => {
  const { t } = useTranslation();
  const ids = useId();
  // Closed by default: the presets and the preview cover most people; the rest is for fine-tuning.
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
  const positionX = config.position_x !== undefined ? config.position_x : 50;
  const positionY = config.position_y !== undefined ? config.position_y : 85;

  const set = (patch: Partial<SubtitleConfig>) => onChange({ ...config, ...patch });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p id={`${ids}-presets`} className="text-label text-text-primary">{t("subtitle_custom.quick_presets")}</p>
        <div role="group" aria-labelledby={`${ids}-presets`} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {Object.entries(SUBTITLE_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              type="button"
              onClick={() => set(preset.config)}
              className="min-h-[44px] rounded-button border border-border-active bg-bg-secondary px-3 py-2 text-left text-body text-text-primary hover:bg-bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
            >
              {t(preset.label_key)}
            </button>
          ))}
        </div>
      </div>

      {showModeSwitch && (
        <div className="flex flex-col gap-2">
          <p id={`${ids}-style`} className="text-label text-text-primary">{t("subtitle_custom.style_mode")}</p>
          <div role="group" aria-labelledby={`${ids}-style`} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {STYLES.map((style) => (
              <ChoiceButton
                key={style}
                selected={styleMode === style}
                label={t(`subtitle_custom.style_${style}`)}
                description={t(`subtitle_custom.style_${style}_desc`)}
                onClick={() => set({ style })}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-label text-text-primary">{t("subtitle_custom.preview_title")}</p>
        {/* A plain mid-grey frame stands in for the video, so light and dark subtitle colours both show. */}
        <div
          className="relative mx-auto w-full max-w-[240px] overflow-hidden rounded-input border border-border-active bg-[#6B6E74]"
          style={{ aspectRatio: aspectRatio.replace(":", "/") }}
          aria-hidden="true"
        >
          <style>{`
            @keyframes karaoke-pop { 0% { transform: scale(1); } 15% { transform: scale(1.2); } 100% { transform: scale(1); } }
            .animate-karaoke-pop { display: inline-block; animation: karaoke-pop 1.5s infinite cubic-bezier(0.2, 0.8, 0.2, 1); transform-origin: center; }
          `}</style>
          <div
            className="absolute w-full px-3 text-center"
            style={{
              top: `${positionY}%`,
              left: `${positionX}%`,
              fontFamily,
              fontWeight: fontWeight === "bold" ? 700 : 400,
              fontStyle: isItalic ? "italic" : "normal",
              textTransform: isUppercase ? "uppercase" : "none",
              fontSize: `${Math.round(18 * fontSizeScale)}px`,
              color: textColor,
              WebkitTextStroke: `${outlineWidth}px ${outlineColor}`,
              textShadow: shadowDepth > 0 ? `0px ${shadowDepth}px ${shadowDepth * 2}px ${shadowColor}` : "none",
              transform: "translate(-50%, -100%)",
            }}
          >
            {styleMode === "single_word" ? (
              <span className={animationPop ? "animate-karaoke-pop" : ""} style={{ color: highlightColor }}>
                {t("subtitle_custom.preview_word")}
              </span>
            ) : styleMode === "karaoke" ? (
              <span>
                {t("subtitle_custom.preview_before")}{" "}
                <span className={animationPop ? "animate-karaoke-pop" : ""} style={{ color: highlightColor }}>
                  {t("subtitle_custom.preview_word")}
                </span>
              </span>
            ) : (
              <span>{t("subtitle_custom.preview_sentence")}</span>
            )}
          </div>
          {watermarkText && (
            <div className="absolute bottom-2 w-full text-center text-[12px] text-white" style={{ opacity: watermarkOpacity }}>
              {watermarkText}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        aria-expanded={showAdvanced}
        aria-controls={`${ids}-advanced`}
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-button border border-border-active bg-bg-secondary px-3 text-left text-body font-medium text-text-primary hover:bg-bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
      >
        {t("subtitle_custom.advanced_toggle")}
        {/* Chevron shows open/closed state of the disclosure. */}
        <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${showAdvanced ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {showAdvanced && (
        <div id={`${ids}-advanced`} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p id={`${ids}-font`} className="text-label text-text-primary">{t("subtitle_custom.font_family_label")}</p>
            <div role="group" aria-labelledby={`${ids}-font`} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FONTS.map((font) => (
                <ChoiceButton
                  key={font}
                  selected={fontFamily === font}
                  label={<span style={{ fontFamily: font }}>{font}</span>}
                  onClick={() => set({ font_family: font })}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <p id={`${ids}-size`} className="text-label text-text-primary">{t("subtitle_custom.font_size_label")}</p>
              <div role="group" aria-labelledby={`${ids}-size`} className="grid grid-cols-2 gap-2">
                {SIZES.map((scale) => (
                  <ChoiceButton key={scale} selected={fontSizeScale === scale} label={`${scale}x`} onClick={() => set({ font_size_scale: scale })} />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p id={`${ids}-weight`} className="text-label text-text-primary">{t("subtitle_custom.font_weight_label")}</p>
              <div role="group" aria-labelledby={`${ids}-weight`} className="grid grid-cols-2 gap-2">
                <ChoiceButton selected={fontWeight === "normal"} label={t("subtitle_custom.weight_normal")} onClick={() => set({ font_weight: "normal" })} />
                <ChoiceButton selected={fontWeight === "bold"} label={t("subtitle_custom.weight_bold")} onClick={() => set({ font_weight: "bold" })} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <ToggleSwitch label={t("subtitle_custom.uppercase_toggle")} checked={isUppercase} onChange={(v) => set({ uppercase: v })} />
            <ToggleSwitch label={t("subtitle_custom.italic_toggle")} checked={isItalic} onChange={(v) => set({ italic: v })} />
            <ToggleSwitch label={t("subtitle_custom.animation_pop")} checked={animationPop} onChange={(v) => set({ animation_pop: v })} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Slider
              label={t("subtitle_custom.position_y")}
              valueText={`${positionY}%`}
              min={10}
              max={95}
              step={1}
              value={positionY}
              onChange={(v) => set({ position_y: v })}
            />
            <Slider
              label={t("subtitle_custom.position_x")}
              valueText={`${positionX}%`}
              min={10}
              max={90}
              step={1}
              value={positionX}
              onChange={(v) => set({ position_x: v })}
            />
            <Slider
              label={t("subtitle_custom.outline_width")}
              valueText={`${outlineWidth} px`}
              min={0}
              max={5}
              step={1}
              value={outlineWidth}
              onChange={(v) => set({ outline_width: v })}
            />
            <Slider
              label={t("subtitle_custom.shadow_depth")}
              valueText={`${shadowDepth} px`}
              min={0}
              max={10}
              step={1}
              value={shadowDepth}
              onChange={(v) => set({ shadow_depth: v })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ColorField label={t("subtitle_custom.text_color")} value={textColor} onChange={(v) => set({ text_color: v })} />
            <div className="flex flex-col gap-2">
              <ColorField label={t("subtitle_custom.highlight_color")} value={highlightColor} onChange={(v) => set({ highlight_color: v })} />
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    aria-pressed={highlightColor.toUpperCase() === p.value}
                    aria-label={t(`subtitle_custom.color_${p.key}`)}
                    title={t(`subtitle_custom.color_${p.key}`)}
                    onClick={() => set({ highlight_color: p.value })}
                    className={`flex h-11 w-11 items-center justify-center rounded-full border-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary ${
                      highlightColor.toUpperCase() === p.value ? "border-accent" : "border-border-active"
                    }`}
                    style={{ backgroundColor: p.value }}
                  >
                    {/* All presets are bright colours: a black check reads on each. */}
                    {highlightColor.toUpperCase() === p.value && <Check className="h-5 w-5 text-black" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-label text-text-primary">
              {t("subtitle_custom.watermark_label")}
              <input
                type="text"
                placeholder={t("subtitle_custom.watermark_placeholder")}
                value={watermarkText}
                onChange={(e) => set({ watermark_text: e.target.value })}
                className={`${inputClass} w-full placeholder:text-text-secondary`}
              />
            </label>
            <Slider
              label={t("subtitle_custom.watermark_opacity")}
              valueText={`${Math.round(watermarkOpacity * 100)}%`}
              min={0.1}
              max={1}
              step={0.05}
              value={watermarkOpacity}
              onChange={(v) => set({ watermark_opacity: v })}
            />
          </div>
        </div>
      )}
    </div>
  );
};
