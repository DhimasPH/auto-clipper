import React from "react";
import { Flame, Mic, Subtitles, Check, Sparkles } from "lucide-react";
import type { SubtitlePresetKey } from "../types/subtitle";
import { SUBTITLE_PRESETS } from "../types/subtitle";

export interface SubtitlePresetBarProps {
  value: SubtitlePresetKey | string;
  onChange: (preset: SubtitlePresetKey) => void;
  disabled?: boolean;
  className?: string;
}

interface PresetItem {
  id: SubtitlePresetKey;
  label: string;
  badge?: string;
  description: string;
  icon: React.ElementType;
  renderVisualSample: () => React.ReactNode;
}

const PRESET_ITEMS: PresetItem[] = [
  {
    id: "viral_pop",
    label: "Viral Pop",
    badge: "Trending",
    description: SUBTITLE_PRESETS.viral_pop.description,
    icon: Flame,
    renderVisualSample: () => (
      <div className="h-10 bg-neutral-950/60 rounded-lg border border-neutral-800/80 flex items-center justify-center px-3 overflow-hidden">
        <span
          className="font-black text-xs tracking-wider uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] text-[#FFE600] scale-110 transform transition-transform"
          style={{ fontFamily: "Impact, sans-serif" }}
        >
          VIRAL POP!
        </span>
      </div>
    ),
  },
  {
    id: "podcast",
    label: "Podcast",
    badge: "Karaoke",
    description: SUBTITLE_PRESETS.podcast.description,
    icon: Mic,
    renderVisualSample: () => (
      <div className="h-10 bg-neutral-950/60 rounded-lg border border-neutral-800/80 flex items-center justify-center px-3 gap-1 overflow-hidden text-[11px] font-bold">
        <span className="text-neutral-400">talking</span>
        <span className="text-[#38BDF8] bg-sky-950/60 px-1 py-0.5 rounded border border-sky-500/30">
          about
        </span>
        <span className="text-neutral-400">ideas</span>
      </div>
    ),
  },
  {
    id: "classic",
    label: "Classic",
    badge: "Clean",
    description: SUBTITLE_PRESETS.classic.description,
    icon: Subtitles,
    renderVisualSample: () => (
      <div className="h-10 bg-neutral-950/60 rounded-lg border border-neutral-800/80 flex items-center justify-center px-3 overflow-hidden">
        <span className="text-xs font-normal text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          Clean standard captions
        </span>
      </div>
    ),
  },
];

export const SubtitlePresetBar: React.FC<SubtitlePresetBarProps> = ({
  value,
  onChange,
  disabled = false,
  className = "",
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-neutral-200 flex items-center gap-2">
          <span>Subtitle Presets</span>
          <span className="text-xs font-normal text-neutral-400">
            (Typography & Animation)
          </span>
        </label>
        <span className="text-xs text-neutral-400 hidden sm:inline-block">
          Select caption presentation style
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label="Subtitle Presets"
        className="grid grid-cols-1 md:grid-cols-3 gap-3"
      >
        {PRESET_ITEMS.map((item) => {
          const isSelected = value === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onChange(item.id)}
              className={`group relative flex flex-col text-left p-3.5 rounded-xl border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 ${
                disabled
                  ? "opacity-50 cursor-not-allowed bg-neutral-900/40 border-neutral-800"
                  : isSelected
                  ? "bg-neutral-800/90 border-amber-400/80 shadow-lg shadow-amber-500/5 ring-1 ring-amber-400/50"
                  : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800"
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between w-full mb-2.5">
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
                    <span className="text-sm font-semibold text-neutral-100 block">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="text-[10px] font-medium text-neutral-400">
                        {item.badge}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.id === "viral_pop" && !isSelected && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-950/40 text-amber-300 border border-amber-500/30">
                      <Sparkles className="w-2.5 h-2.5" />
                      Popular
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

              {/* Visual preview sample */}
              <div className="my-1">{item.renderVisualSample()}</div>

              {/* Description */}
              <p className="text-xs text-neutral-400 line-clamp-2 mt-2 leading-relaxed min-h-[2rem]">
                {item.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SubtitlePresetBar;
