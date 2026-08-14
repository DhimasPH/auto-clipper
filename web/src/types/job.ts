import type { CanvasConfig } from "./canvas";
import type { SubtitleConfig } from "./subtitle";

export type JobStatus =
  | "IDLE"
  | "PENDING"
  | "QUEUED"
  | "DOWNLOADING"
  | "TRANSCRIBING"
  | "AWAITING_MANUAL"
  | "CROPPING"
  | "PROCESSING"
  | "DONE"
  | "ERROR"
  | "CANCELLED";

export interface ClipSocialKit {
  title?: string;
  caption?: string;
  hashtags?: string[];
  hook?: string;
}

export interface Clip {
  path: string;
  description: string;
  description_en?: string;
  description_id?: string;
  start: string;
  end: string;
  subs?: boolean;
  social?: ClipSocialKit;
  v?: number;
}

export interface JobMetadata {
  title?: string;
  manual_prompt?: string;
  subtitle_path?: string;
  source_video?: string;
  duration_seconds?: number;
  quality?: string;
  highlight_prompt?: string;
  aspect_ratio?: string;
  caption_style?: string;
  burn_subs?: boolean;
  canvas_config?: CanvasConfig;
  subtitle_config?: SubtitleConfig;
  whisper_model?: string;
  language?: string;
}

export interface JobResponse {
  id: string;
  status: JobStatus;
  progress: string;
  clips: Clip[];
  failed?: number;
  error?: string | null;
  metadata?: JobMetadata;
  created_at?: string;
}

export interface CreateJobPayload {
  url: string;
  provider?: string;
  api_key?: string;
  aspect_ratio?: string;
  caption_style?: string;
  burn_subs?: boolean;
  output_dir?: string;
  quality?: string;
  extra_prompt?: string;
  title?: string;
  enable_broll?: boolean;
  pexels_api_key?: string;
  max_clips?: number;
  custom_base_url?: string;
  custom_model_name?: string;
  is_gaming_video?: boolean;
  whisper_model?: string;
  model?: string;
  language?: string;
  canvas_config?: CanvasConfig;
  subtitle_config?: SubtitleConfig;
}
