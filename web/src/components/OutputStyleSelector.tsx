import React from "react";
import { ScanFace, Layers, Monitor, Square, Check, Sparkles } from "lucide-react";

export type OutputStyle = "face_crop" | "canvas_blur" | "landscape" | "square";

export interface OutputStyleOption {
  id: OutputStyle;
  label: string;
  ratio: string;
  description: string;
  platforms: string;
  icon: React.ElementType;
  badge?: string;
  renderPreview: () => React.ReactNode;
}

export interface OutputStyleSelectorProps {
  value: OutputStyle | string;
  onChange: (value: OutputStyle) => void;
  disabled?: boolean;
  className?: string;
}

export const OUTPUT_STYLE_OPTIONS: OutputStyleOption[] = [
  {
    id: "face_crop",
    label: "Face Crop",
    ratio: "9:16",
    description: "AI tracks speaker face dynamically for portrait short-form video",
    platforms: "TikTok, Reels, Shorts",
    badge: "AI Powered",
    icon: ScanFace,
    renderPreview: () => (
      <div className="w-7 h-11 rounded border border-slate-300 bg-slate-100 flex flex-col items-center justify-center relative overflow-hidden group-hover:border-purple-400 transition-colors">
        <div className="w-3.5 h-3.5 rounded-full bg-purple-100 border border-purple-500 flex items-center justify-center animate-pulse">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-600" />
        </div>
        <div className="w-4 h-1.5 bg-slate-300 rounded-sm mt-1" />
      </div>
    ),
  },
  {
    id: "canvas_blur",
    label: "Canvas Blur",
    ratio: "9:16",
    description: "Original video centered on 9:16 canvas with blurred ambient background",
    platforms: "Stories, Shorts, Feed",
    badge: "Full View",
    icon: Layers,
    renderPreview: () => (
      <div className="w-7 h-11 rounded border border-slate-300 bg-slate-200 flex flex-col items-center justify-center relative overflow-hidden group-hover:border-purple-400 transition-colors">
        <div className="absolute inset-0 bg-slate-300/60 backdrop-blur-[1px]" />
        <div className="w-6 h-3.5 bg-white border border-purple-400 rounded-sm z-10 shadow-sm flex items-center justify-center">
          <div className="w-3 h-1 bg-purple-200 rounded-sm" />
        </div>
      </div>
    ),
  },
  {
    id: "landscape",
    label: "Landscape",
    ratio: "16:9",
    description: "Standard widescreen format preserving original footage aspect ratio",
    platforms: "YouTube, Web, Desktop",
    icon: Monitor,
    renderPreview: () => (
      <div className="w-11 h-7 rounded border border-slate-300 bg-slate-100 flex items-center justify-center relative overflow-hidden group-hover:border-purple-400 transition-colors">
        <div className="w-7 h-4 bg-white border border-slate-300 rounded-sm flex items-center justify-center">
          <div className="w-4 h-1.5 bg-slate-200 rounded-sm" />
        </div>
      </div>
    ),
  },
  {
    id: "square",
    label: "Square",
    ratio: "1:1",
    description: "Balanced square format optimal for grid feeds and post carousels",
    platforms: "Instagram, LinkedIn, X",
    icon: Square,
    renderPreview: () => (
      <div className="w-8 h-8 rounded border border-slate-300 bg-slate-100 flex items-center justify-center relative overflow-hidden group-hover:border-purple-400 transition-colors">
        <div className="w-5 h-5 bg-white border border-slate-300 rounded-sm flex items-center justify-center">
          <div className="w-2.5 h-2.5 bg-slate-200 rounded-sm" />
        </div>
      </div>
    ),
  },
];

export const OutputStyleSelector: React.FC<OutputStyleSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  className = "",
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <span>Output Video Format</span>
          <span className="text-xs font-normal text-text-tertiary">
            (Aspect Ratio & Cropping)
          </span>
        </label>
        <span className="text-xs text-text-tertiary hidden sm:inline-block">
          Select target social media format
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label="Output Style Selector"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {OUTPUT_STYLE_OPTIONS.map((option) => {
          const isSelected = value === option.id;
          const Icon = option.icon;

          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onChange(option.id)}
              className={`group relative flex flex-col text-left p-3.5 rounded-2xl border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 ${
                disabled
                  ? "opacity-50 cursor-not-allowed bg-slate-50 border-slate-200"
                  : isSelected
                  ? "bg-purple-50/70 border-purple-500 shadow-md ring-1 ring-purple-500/30"
                  : "bg-white border-border hover:border-slate-300 hover:bg-slate-50/80 shadow-sm"
              }`}
            >
              {/* Top Header inside Card */}
              <div className="flex items-start justify-between w-full mb-2.5">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-xl border transition-colors ${
                      isSelected
                        ? "bg-purple-100 border-purple-200 text-purple-600"
                        : "bg-slate-100 border-slate-200 text-slate-500 group-hover:text-slate-700"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-text-primary">
                        {option.label}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-medium text-text-tertiary">
                      {option.ratio}
                    </span>
                  </div>
                </div>

                {/* Selection Indicator or Badge */}
                <div className="flex items-center gap-1.5">
                  {option.badge && !isSelected && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      {option.id === "face_crop" && <Sparkles className="w-2.5 h-2.5 text-purple-600" />}
                      {option.badge}
                    </span>
                  )}
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                      isSelected
                        ? "bg-purple-600 border-purple-600 text-white"
                        : "border-slate-300 bg-slate-50 group-hover:border-slate-400"
                    }`}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                </div>
              </div>

              {/* Visual preview thumbnail */}
              <div className="my-1 py-1.5 flex items-center justify-center bg-slate-50/80 rounded-xl border border-slate-200/80 h-14">
                {option.renderPreview()}
              </div>

              {/* Description */}
              <p className="text-xs text-text-secondary line-clamp-2 mt-2 leading-relaxed min-h-[2rem]">
                {option.description}
              </p>

              {/* Platforms footer */}
              <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between text-[11px] text-text-tertiary">
                <span className="truncate">{option.platforms}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default OutputStyleSelector;
