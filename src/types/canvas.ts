export interface CanvasConfig {
  enabled: boolean;
  background_type: "blur" | "color" | "image";
  blur_level?: "light" | "medium" | "strong";
  background_color?: string;
  background_image_path?: string;
  enlarge_scale?: number;
}

export const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  enabled: false,
  background_type: "blur",
  blur_level: "medium",
  background_color: "#000000",
  background_image_path: "",
  enlarge_scale: 1.0,
};
