export interface SubtitleConfig {
  style: "karaoke" | "standard";
  highlight_color: string;
  font_family: string;
  font_size_scale: number;
  font_weight: "normal" | "bold";
  italic: boolean;
  uppercase: boolean;
  watermark_text?: string;
  watermark_opacity?: number;
}

export const DEFAULT_SUBTITLE_CONFIG: SubtitleConfig = {
  style: "karaoke",
  highlight_color: "#FFE600",
  font_family: "Arial",
  font_size_scale: 1.0,
  font_weight: "bold",
  italic: false,
  uppercase: true,
  watermark_text: "",
  watermark_opacity: 0.5,
};
