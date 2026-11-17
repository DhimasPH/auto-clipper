import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../App";
import type { ActionHandlers } from "../lib/errorInfo";
import { useLang } from "../lib/lang";

interface ErrorActionOptions {
  /** The failed job, when the error belongs to one. Without it Resume has nothing to run. */
  jobId?: string | null;
  /** Replaces the default "resume this job here". */
  onResume?: (jobId: string) => void;
}

/**
 * What the action buttons of an error do in the web app
 * (ids from backend/errors.py `_ACTIONS`).
 *
 * `open_settings` has no handler, so it gets no button: it points at the API
 * key, and the web app has no API key setting.
 */
export function useErrorActions(options: ErrorActionOptions = {}): {
  handlers: ActionHandlers;
  labels: Partial<Record<string, string>>;
} {
  const ctx = useContext(AppContext);
  const navigate = useNavigate();
  const { t } = useLang();
  const { jobId, onResume } = options;

  const resume = jobId
    ? () => {
        if (onResume) onResume(jobId);
        else ctx.resumeJob(jobId).catch((err: unknown) => console.error("Resume failed:", err));
      }
    : undefined;

  return {
    handlers: {
      upload_cookies: () => ctx.openCookies(resume),
      // The web app takes a video file from Google Drive, not from a browser upload.
      upload_video: () => {
        ctx.requestDriveBrowser();
        navigate("/");
      },
      retry: resume,
      resume,
    },
    labels: { upload_video: t("action.pick_from_drive") },
  };
}
