import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext } from "../App";
import { platform } from "../platform";
import { errorActionHandlers } from "../lib/errorActions";
import { ROUTES, SETTINGS_ANCHORS } from "../lib/routes";
import type { ActionHandlers } from "../lib/errorInfo";

interface ErrorActionOptions {
  /** The failed job, when the error belongs to one. Without it Resume has nothing to run. */
  jobId?: string | null;
  /** Where the clips of a resumed job should appear. */
  origin?: "workspace" | "history";
  /** Runs the failed step again when it is not a job (e.g. the quality check). */
  onRetry?: () => void;
  /** Replaces the default "go to the workspace and pick a local video". */
  onUploadVideo?: () => void;
}

/**
 * What the action buttons of an error do in this app, per platform
 * (ids from backend/errors.py `_ACTIONS`).
 */
export function useErrorActions(options: ErrorActionOptions = {}): ActionHandlers {
  const ctx = useContext(AppContext);
  const navigate = useNavigate();
  const { jobId, origin = "history", onRetry, onUploadVideo } = options;

  const resume = jobId ? () => ctx.handleResumeJob(jobId, origin) : undefined;

  return errorActionHandlers(platform().caps, {
    resume,
    rerun: onRetry ?? resume,
    openCookies: (retry) => ctx.openCookies(retry),
    uploadVideo:
      onUploadVideo ??
      (() => {
        ctx.requestLocalUpload();
        navigate("/");
      }),
    openDriveBrowser: () => {
      ctx.requestDriveBrowser();
      navigate("/");
    },
    openSettings: () => navigate(`${ROUTES.settings}#${SETTINGS_ANCHORS.advanced}`),
  });
}
