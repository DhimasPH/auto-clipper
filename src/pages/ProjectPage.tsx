import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { AppContext } from "../App";
import { ClipEditModal } from "../components/ClipEditModal";
import ClipsResult from "../components/ClipsResult";
import { ErrorCard } from "../components/ErrorCard";
import { JobReport } from "../components/JobReport";
import { RepickDialog } from "../components/projects/RepickDialog";
import { DeleteFailedAlert } from "../components/projects/DeleteFailedAlert";
import { ProjectStatusBadge } from "../components/projects/ProjectStatusBadge";
import { RerenderAllDialog } from "../components/projects/RerenderAllDialog";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { OverflowMenu, type OverflowItem } from "../components/ui/OverflowMenu";
import { useErrorActions } from "../hooks/useErrorActions";
import { asErrorInfo, hasRerunAction } from "../lib/errorInfo";
import { canRepick, repickMode } from "../lib/repick";
import { projectPrimaryAction, projectStatusKey } from "../lib/projectStatus";
import { ROUTES } from "../lib/routes";
import { platform } from "../platform";
import { API_URL } from "../platform/backendUrl";

const BACK_LINK =
  "inline-flex min-h-[44px] items-center gap-2 self-start rounded text-body text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/** Single-project page at /riwayat/:id (spec 4.1, 4.5): clips, report, timings and actions. */
export const ProjectPage: React.FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const ctx = useContext(AppContext);
  const navigate = useNavigate();
  const caps = platform().caps;

  const [job, setJob] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<"failed" | "not_found" | null>(null);
  const [editClip, setEditClip] = useState<number | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [rerenderOpen, setRerenderOpen] = useState(false);
  const [repickOpen, setRepickOpen] = useState(false);
  const mode = repickMode(caps, ctx?.aiMode ?? "manual", ctx?.provider ?? "");
  const showHistoryRequestError = ctx?.jobOrigin === "history" && ctx?.status === "IDLE" && !!(ctx?.errorInfo || ctx?.errorMsg);
  const requestErrorActions = useErrorActions({ jobId: ctx?.failedJobId ?? (id || null), origin: "history" });
  // A retry button disappears once pressed; keyboard focus waits on a heading instead of falling to <body>.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const backRef = useRef<HTMLAnchorElement>(null);

  const fetchJob = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await axios.get(`${API_URL}/jobs/${encodeURIComponent(id)}`);
      setJob(res.data);
    } catch (err) {
      console.error("Failed to load project", err);
      const status = (err as { response?: { status?: number } } | null)?.response?.status;
      setLoadError(status === 404 ? "not_found" : "failed");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchJob();
  }, [fetchJob, ctx?.historyVersion]);

  const handleDelete = async () => {
    setConfirmDeleteOpen(false);
    if (!job?.id) return;
    // Unmount the clip players first so Windows releases the files before the backend deletes them.
    setDeleting(true);
    setDeleteFailed(false);
    await new Promise((resolve) => setTimeout(resolve, 60));
    try {
      await axios.delete(`${API_URL}/history/${encodeURIComponent(job.id)}`);
      navigate(ROUTES.projects);
    } catch (err) {
      console.error("Failed to delete project", err);
      setDeleting(false);
      setDeleteFailed(true);
    }
  };

  const backLink = (
    <Link ref={backRef} to={ROUTES.projects} className={BACK_LINK}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {t("projects.back")}
    </Link>
  );

  if (loading && !job && !loadError) {
    return (
      // Same first child (the back link) as the other states, so React keeps that element and its focus.
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {backLink}
        <p role="status" className="text-body text-text-secondary">{t("projects.loading")}</p>
      </div>
    );
  }

  if (loadError || !job) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        {backLink}
        <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-border bg-bg-secondary p-5">
          <p className="text-body text-error">{t(loadError === "not_found" ? "projects.not_found" : "projects.load_failed")}</p>
          {loadError !== "not_found" && (
            <Button
              variant="outline"
              icon={RefreshCw}
              onClick={() => {
                backRef.current?.focus();
                void fetchJob();
              }}
              disabled={loading}
            >
              {t("projects.retry_load")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const meta = (job.metadata || {}) as Record<string, any>;
  const clips: any[] = Array.isArray(job.clips) ? job.clips : [];
  const statusKey = projectStatusKey(job);
  const title = String(meta.title || "").trim() || meta.url || t("projects.untitled");
  // GET /jobs/{id} keeps the error next to the metadata; JobReport reads it from the metadata.
  const reportJob = {
    id: job.id,
    url: meta.url || "",
    status: job.status,
    metadata: {
      ...meta,
      ...(job.error ? { error: job.error } : {}),
      ...(job.error_info ? { error_info: job.error_info } : {}),
    },
  };
  const primary = projectPrimaryAction(reportJob, typeof job.queue_position === "number" && job.queue_position > 0);
  // The error card already carries "Coba lagi"/"Lanjutkan" when the error offers it.
  const cardHasRerun = hasRerunAction(asErrorInfo(reportJob.metadata.error_info));

  const menuItems: OverflowItem[] = [
    ...(clips.length > 0 ? [{ id: "rerender", label: t("projects.menu_rerender"), onSelect: () => setRerenderOpen(true) }] : []),
    ...(canRepick(reportJob) ? [{ id: "repick", label: t("projects.menu_repick"), onSelect: () => setRepickOpen(true) }] : []),
    { id: "delete", label: t("projects.menu_delete"), danger: true, onSelect: () => setConfirmDeleteOpen(true) },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {backLink}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 ref={headingRef} tabIndex={-1} className="text-page-title text-text-primary break-words focus:outline-none">{title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-caption text-text-secondary">
            <ProjectStatusBadge statusKey={statusKey} />
            {clips.length > 0 && <span>{t("projects.clip_count", { count: clips.length })}</span>}
          </div>
        </div>
        <OverflowMenu label={t("projects.menu_label", { title })} items={menuItems} />
      </div>

      {deleteFailed && (
        <DeleteFailedAlert
          onRetry={() => {
            headingRef.current?.focus();
            void handleDelete();
          }}
        />
      )}

      {showHistoryRequestError &&
        (ctx.errorInfo ? (
          <ErrorCard info={ctx.errorInfo} handlers={requestErrorActions} announce quiet />
        ) : (
          <p role="alert" className="m-0 text-body text-error break-words">
            {ctx.errorMsg}
          </p>
        ))}

      {primary === "paste_answer" && (
        <div>
          <Button
            onClick={() => {
              ctx.openAwaiting(job);
              navigate(ROUTES.create);
            }}
          >
            {t("projects.action_paste_answer")}
          </Button>
        </div>
      )}

      {(primary === "resume" || primary === "retry") && !cardHasRerun && (
        <div>
          <Button variant="outline" onClick={() => void ctx.handleResumeJob(job.id, "history")}>
            {t(primary === "resume" ? "projects.action_resume" : "projects.action_retry")}
          </Button>
        </div>
      )}

      {primary === "view_progress" && (
        <div>
          <Button
            variant="outline"
            onClick={() => {
              ctx.watchJob?.(job.id);
              navigate(ROUTES.create);
            }}
          >
            {t("projects.action_view_progress")}
          </Button>
        </div>
      )}

      <JobReport job={reportJob} />

      {clips.length > 0 && !deleting && (
        <ClipsResult
          clips={clips}
          status={job.status}
          failedCount={job.failed || 0}
          jobId={job.id}
          metadata={null}
          onEditClip={setEditClip}
        />
      )}

      {editClip !== null && (
        <ClipEditModal
          jobId={job.id}
          clipIndex={editClip}
          clipTitle={t("result.clip_n", { n: editClip + 1 })}
          initialAspectRatio={meta.aspect_ratio || "9:16"}
          initialTrackingMode={meta.tracking_mode || "auto"}
          initialFaceTrackingEngine={meta.face_tracking_engine || "haar"}
          initialBurnSubs={meta.burn_subs ?? true}
          initialCanvasConfig={meta.canvas_config}
          initialSubtitleConfig={meta.subtitle_config}
          onClose={() => setEditClip(null)}
          onRerenderStart={(newJobId) => {
            setEditClip(null);
            ctx.handleRerenderClip(newJobId);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title={t("projects.delete_title")}
        message={t("projects.delete_body")}
        confirmLabel={t("projects.delete_confirm")}
        cancelLabel={t("common.cancel")}
        isDestructive
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      <RerenderAllDialog
        isOpen={rerenderOpen}
        initialMeta={meta}
        onClose={() => setRerenderOpen(false)}
        onConfirm={(opts) => {
          setRerenderOpen(false);
          void ctx.handleRerender(job.id, opts.aspectRatio, opts.subtitleConfig.style, opts.burnSubs, opts.canvasConfig, opts.subtitleConfig);
        }}
      />

      <RepickDialog
        isOpen={repickOpen}
        mode={mode}
        onClose={() => setRepickOpen(false)}
        onConfirm={(extra, maxClips) => {
          setRepickOpen(false);
          if (mode === "api") {
            void ctx.handleRerunAI(job.id, extra, maxClips);
            return;
          }
          void ctx.handleRerunManual(job.id, extra, maxClips).then((opened: boolean) => {
            if (opened) navigate(ROUTES.create);
          });
        }}
      />
    </div>
  );
};
