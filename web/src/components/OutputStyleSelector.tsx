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
      <div className="w-7 h-11 rounded border border-neutral-600 bg-neutral-900/80 flex flex-col items-center justify-center relative overflow-hidden group-hover:border-amber-400/60 transition-colors">
        <div className="w-3.5 h-3.5 rounded-full bg-amber-400/20 border border-amber-400/80 flex items-center justify-center animate-pulse">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        </div>
        <div className="w-4 h-1.5 bg-neutral-700 rounded-sm mt-1" />
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
      <div className="w-7 h-11 rounded border border-neutral-600 bg-neutral-800/80 flex flex-col items-center justify-center relative overflow-hidden group-hover:border-sky-400/60 transition-colors">
        <div className="absolute inset-0 bg-neutral-700/40 backdrop-blur-[1px]" />
        <div className="w-6 h-3.5 bg-neutral-900 border border-sky-400/70 rounded-sm z-10 shadow-sm flex items-center justify-center">
          <div className="w-3 h-1 bg-sky-400/40 rounded-sm" />
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
      <div className="w-11 h-7 rounded border border-neutral-600 bg-neutral-900/80 flex items-center justify-center relative overflow-hidden group-hover:border-neutral-400 transition-colors">
        <div className="w-7 h-4 bg-neutral-800 border border-neutral-600 rounded-sm flex items-center justify-center">
          <div className="w-4 h-1.5 bg-neutral-600 rounded-sm" />
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
      <div className="w-8 h-8 rounded border border-neutral-600 bg-neutral-900/80 flex items-center justify-center relative overflow-hidden group-hover:border-neutral-400 transition-colors">
        <div className="w-5 h-5 bg-neutral-800 border border-neutral-600 rounded-sm flex items-center justify-center">
          <div className="w-2.5 h-2.5 bg-neutral-600 rounded-sm" />
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
        <label className="text-sm font-medium text-neutral-200 flex items-center gap-2">
          <span>Output Video Format</span>
          <span className="text-xs font-normal text-neutral-400">
            (Aspect Ratio & Cropping)
          </span>
        </label>
        <span className="text-xs text-neutral-400 hidden sm:inline-block">
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
              className={`group relative flex flex-col text-left p-3.5 rounded-xl border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 ${
                disabled
                  ? "opacity-50 cursor-not-allowed bg-neutral-900/40 border-neutral-800"
                  : isSelected
                  ? "bg-neutral-800/90 border-amber-400/80 shadow-lg shadow-amber-500/5 ring-1 ring-amber-400/50"
                  : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800"
              }`}
            >
              {/* Top Header inside Card */}
              <div className="flex items-start justify-between w-full mb-2.5">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-lg border transition-colors ${
                      isSelected
                        ? "bg-amber-400/10 border-amber-400/30 text-amber-400"
                        : "bg-neutral-800 border-neutral-700 text-neutral-400 group-hover:text-neutral-300"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-neutral-100">
                        {option.label}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-medium text-neutral-400">
                      {option.ratio}
                    </span>
                  </div>
                </div>

                {/* Selection Indicator or Badge */}
                <div className="flex items-center gap-1.5">
                  {option.badge && !isSelected && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-800 text-neutral-400 border border-neutral-700">
                      {option.id === "face_crop" && <Sparkles className="w-2.5 h-2.5 text-amber-400" />}
                      {option.badge}
                    </span>
                  )}
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                      isSelected
                        ? "bg-amber-400 border-amber-400 text-neutral-950"
                        : "border-neutral-700 bg-neutral-900/50 group-hover:border-neutral-600"
                    }`}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                </div>
              </div>

              {/* Visual preview thumbnail */}
              <div className="my-1 py-1.5 flex items-center justify-center bg-neutral-950/40 rounded-lg border border-neutral-800/60 h-14">
                {option.renderPreview()}
              </div>

              {/* Description */}
              <p className="text-xs text-neutral-400 line-clamp-2 mt-2 leading-relaxed min-h-[2rem]">
                {option.description}
              </p>

              {/* Platforms footer */}
              <div className="mt-2.5 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500">
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
