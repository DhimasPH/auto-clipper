// Shapes the backend sends for errors, cookies, timings and warnings.
// See backend/errors.py, backend/cookies.py, backend/stage_timer.py, backend/preflight.py.

export interface ErrorAction {
  id: string;
  label: string;
  label_en: string;
}

export interface ErrorInfo {
  code: string;
  title: string;
  message: string;
  title_en: string;
  message_en: string;
  actions: ErrorAction[];
  technical: string;
}

/** A warning attached to a finished job. Same shape as a preflight result. */
export interface JobWarning {
  id: string;
  level: string;
  title: string;
  message: string;
  title_en?: string;
  message_en?: string;
  code?: string;
  technical?: string;
}

export interface StageTiming {
  stage: string;
  seconds: number;
  rss_mb_peak: number | null;
  ok?: boolean;
  whisper_device?: string;
  encoder?: string;
  tracking_engine_used?: string;
}

export interface CookiesStatus {
  present: boolean;
  valid: boolean;
  logged_in: boolean;
  cookie_count: number;
  youtube_cookie_count: number;
  earliest_expiry: string | null;
  latest_expiry: string | null;
  uploaded_at: string | null;
  error_info: ErrorInfo | null;
}
