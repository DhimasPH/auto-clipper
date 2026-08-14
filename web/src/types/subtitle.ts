export interface SubtitleConfig {
  style: "standard" | "karaoke" | "single_word";

  // Tipografi
  font_family: string;
  font_size_scale: number;
  font_weight: "normal" | "bold";
  italic: boolean;
  uppercase: boolean;

  // Warna
  highlight_color: string;
  text_color: string;
  outline_color: string;
  shadow_color: string;

  // Efek visual
  outline_width: number;
  shadow_depth: number;
  animation_pop: boolean;

  // Watermark
  watermark_text?: string;
  watermark_opacity?: number;
}

export const DEFAULT_SUBTITLE_CONFIG: SubtitleConfig = {
  style: "single_word",
  highlight_color: "#FFE600",
  text_color: "#FFFFFF",
  outline_color: "#000000",
  shadow_color: "#000000",
  font_family: "Arial",
  font_size_scale: 1.0,
  font_weight: "bold",
  italic: false,
  uppercase: true,
  outline_width: 2,
  shadow_depth: 2,
  animation_pop: false,
  watermark_text: "",
  watermark_opacity: 0.5,
};

export type SubtitlePresetKey = "viral_pop" | "podcast" | "classic";

export interface SubtitlePreset {
  id: SubtitlePresetKey;
  label: string;
  description: string;
  config: Partial<SubtitleConfig>;
}

export const SUBTITLE_PRESETS: Record<SubtitlePresetKey, { label: string; description: string; config: Partial<SubtitleConfig> }> = {
  viral_pop: {
    label: "Viral Pop",
    description: "High energy, single-word pop animations for TikTok & Reels",
    config: {
      style: "single_word",
      text_color: "#FFFFFF",
      highlight_color: "#FFE600",
      outline_color: "#000000",
      shadow_color: "#000000",
      font_family: "Impact",
      font_weight: "bold",
      uppercase: true,
      outline_width: 3,
      shadow_depth: 5,
      animation_pop: true,
    },
  },
  podcast: {
    label: "Podcast",
    description: "Karaoke word-by-word highlight with elegant typography",
    config: {
      style: "karaoke",
      text_color: "#FFFFFF",
      highlight_color: "#38BDF8",
      outline_color: "#000000",
      shadow_color: "#000000",
      font_family: "Montserrat",
      font_weight: "bold",
      uppercase: false,
      outline_width: 2,
      shadow_depth: 2,
      animation_pop: false,
    },
  },
  classic: {
    label: "Classic",
    description: "Standard readable multi-line captions for clean presentation",
    config: {
      style: "standard",
      text_color: "#FFFFFF",
      highlight_color: "#FFE600",
      outline_color: "#000000",
      shadow_color: "#000000",
      font_family: "Arial",
      font_weight: "normal",
      uppercase: false,
      outline_width: 2,
      shadow_depth: 1,
      animation_pop: false,
    },
  },
};
