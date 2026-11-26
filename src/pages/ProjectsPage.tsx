import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { AppContext } from "../App";
import { ErrorCard } from "../components/ErrorCard";
import { RerenderAllDialog } from "../components/projects/RerenderAllDialog";
import { RepickDialog } from "../components/projects/RepickDialog";
import { DeleteFailedAlert } from "../components/projects/DeleteFailedAlert";
import { ProjectStatusBadge } from "../components/projects/ProjectStatusBadge";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { OverflowMenu, type OverflowItem } from "../components/ui/OverflowMenu";
import { useErrorActions } from "../hooks/useErrorActions";
import { asErrorInfo, hasRerunAction, toLang } from "../lib/errorInfo";
import { canResumeJob } from "../lib/history";
import { canRepick, repickMode } from "../lib/repick";
import { formatProjectDate, projectDisplayTitle, projectPrimaryAction, projectStatusKey, type ProjectPrimaryAction } from "../lib/projectStatus";
import { projectPath, ROUTES } from "../lib/routes";
import { platform } from "../platform";
import { API_URL } from "../platform/backendUrl";

const PRIMARY_LABEL: Record<ProjectPrimaryAction, string> = {
  view_clips: "projects.action_view_clips",
  paste_answer: "projects.action_paste_answer",
  resume: "projects.action_resume",
  retry: "projects.action_retry",
  view_progress: "projects.action_view_progress",
};

interface FailedRowErrorProps {
  job: { id: string; url?: string; metadata?: Record<string, unknown> | null };
}

/** The error card of a failed project (spec 4.5), with the same actions as on its project page. */
const FailedRowError: React.FC<FailedRowErrorProps> = ({ job }) => {
  const meta = (job.metadata || {}) as Record<string, unknown>;
  const info = asErrorInfo(meta.error_info);
  const raw = typeof meta.error === "string" ? meta.error : "";
  const handlers = useErrorActions({ jobId: canResumeJob(job) ? job.id : null });
  if (info) return <ErrorCard info={info} handlers={handlers} quiet />;
  if (raw) return <p className="text-body text-error break-words m-0">{raw}</p>;
  return null;
};

/** Riwayat list (spec 4.5): project name, date, plain status, clip count, one primary action and a "⋯" menu. */
export const ProjectsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const ctx = useContext(AppContext);
  const navigate = useNavigate();
  const caps = platform().caps;
  const lang = toLang(i18n.language);
  const showHistoryRequestError = ctx?.jobOrigin === "history" && ctx?.status === "IDLE" && !!(ctx?.errorInfo || ctx?.errorMsg);
  const requestErrorActions = useErrorActions({ jobId: ctx?.failedJobId, origin: "history" });

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteFailedId, setDeleteFailedId] = useState<string | null>(null);
  const [rerenderTarget, setRerenderTarget] = useState<any | null>(null);
  const [repickTarget, setRepickTarget] = useState<any | null>(null);
  const mode = repickMode(caps, ctx?.aiMode ?? "manual", ctx?.provider ?? "");
  // A retry button disappears once pressed; keyboard focus waits on the page title instead of falling to <body>.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const retryFrom = (run: () => void) => () => {
    headingRef.current?.focus();
    run();
  };

  // Loads can overlap (Muat ulang, a finished job): only the newest answer is shown.
  const latestLoad = useRef(0);
  const fetchProjects = useCallback(async () => {
    const load = ++latestLoad.current;
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await axios.get(`${API_URL}/history`);
      if (load === latestLoad.current) setProjects(Array.isArray(res.data?.history) ? res.data.history : []);
    } catch (err) {
      if (load !== latestLoad.current) return;
      console.error("Failed to load projects", err);
      setLoadFailed(true);
    } finally {
      if (load === latestLoad.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects, ctx?.historyVersion]);

  const deleteProject = async (id: string) => {
    setDeleteFailedId(null);
    try {
      await axios.delete(`${API_URL}/history/${encodeURIComponent(id)}`);
    } catch (err) {
      console.error("Failed to delete project", err);
      setDeleteFailedId(id);
      return;
    }
    await fetchProjects();
  };

  const confirmDelete = () => {
    const id = deleteTarget;
    setDeleteTarget(null);
    if (id) void deleteProject(id);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 ref={headingRef} tabIndex={-1} className="text-page-title text-text-primary focus:outline-none">{t("projects.title")}</h1>
        <Button variant="outline" icon={RefreshCw} onClick={() => void fetchProjects()} disabled={loading}>
          {t("projects.refresh")}
        </Button>
      </div>

      {showHistoryRequestError &&
        (ctx.errorInfo ? (
          <ErrorCard info={ctx.errorInfo} handlers={requestErrorActions} announce quiet />
        ) : (
          <p role="alert" className="m-0 text-body text-error break-words">
            {ctx.errorMsg}
          </p>
        ))}

      {loading && projects.length === 0 && !loadFailed ? (
        <p role="status" className="text-body text-text-secondary">{t("projects.loading")}</p>
      ) : loadFailed ? (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-border bg-bg-secondary p-5">
          <p className="text-body text-error">{t("projects.load_failed")}</p>
          <Button variant="outline" icon={RefreshCw} onClick={retryFrom(() => void fetchProjects())} disabled={loading}>
            {t("projects.retry_load")}
          </Button>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-card border border-border bg-bg-secondary p-6">
          <p className="text-body text-text-secondary">{t("projects.empty")}</p>
          <Link
            to={ROUTES.create}
            className="inline-flex min-h-[44px] items-center rounded-button bg-accent px-4 py-2 text-body font-semibold text-on-accent hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
          >
            {t("nav.create")}
          </Link>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {projects.map((job) => {
            const isQueuedHere = ctx?.jobId === job.id && (ctx?.queuePosition ?? 0) > 0;
            const statusKey = projectStatusKey(job, isQueuedHere);
            const action = projectPrimaryAction(job, isQueuedHere);
            const clips: any[] = Array.isArray(job.result_clips) ? job.result_clips : [];
            const title = projectDisplayTitle(job.metadata?.title, job.url) || t("projects.untitled");
            const dateText = formatProjectDate(job.created_at, lang);
            const failed = statusKey === "failed";
            // The error card already carries "Coba lagi"/"Lanjutkan" when the error offers it.
            const cardHasRerun = failed && hasRerunAction(asErrorInfo(job.metadata?.error_info));

            const menuItems: OverflowItem[] = [
              ...(clips.length > 0
                ? [{ id: "rerender", label: t("projects.menu_rerender"), onSelect: () => setRerenderTarget(job) }]
                : []),
              ...(canRepick(job)
                ? [{ id: "repick", label: t("projects.menu_repick"), onSelect: () => setRepickTarget(job) }]
                : []),
              { id: "delete", label: t("projects.menu_delete"), danger: true, onSelect: () => setDeleteTarget(job.id) },
            ];

            const runPrimary = () => {
              if (action === "view_clips") navigate(projectPath(job.id));
              else if (action === "paste_answer") {
                ctx.openAwaiting(job);
                navigate(ROUTES.create);
              } else if (action === "resume" || action === "retry") {
                void ctx.handleResumeJob(job.id, "history");
              } else if (action === "view_progress") {
                ctx.watchJob?.(job.id);
                navigate(ROUTES.create);
              }
            };

            return (
              <li key={job.id} className="flex flex-col gap-3 rounded-card border border-border bg-bg-secondary p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-card-title text-text-primary break-words">
                      <Link
                        to={projectPath(job.id)}
                        className="rounded hover:text-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {title}
                      </Link>
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-caption text-text-secondary">
                      <ProjectStatusBadge statusKey={statusKey} />
                      {/* Separators only between items, so a wrapped line never starts with "·". */}
                      {[clips.length > 0 ? t("projects.clip_count", { count: clips.length }) : "", dateText]
                        .filter(Boolean)
                        .map((text, i) => (
                          <span key={i}>{i > 0 ? `· ${text}` : text}</span>
                        ))}
                    </div>
                  </div>
                  <OverflowMenu label={t("projects.menu_label", { title })} items={menuItems} />
                </div>

                {deleteFailedId === job.id && <DeleteFailedAlert onRetry={retryFrom(() => void deleteProject(job.id))} />}

                {failed && <FailedRowError job={job} />}

                {action && !cardHasRerun && (
                  <div>
                    <Button
                      // One focal point per screen: only a project waiting for the AI answer gets the filled button.
                      variant={action === "paste_answer" ? "primary" : "outline"}
                      onClick={runPrimary}
                    >
                      {t(PRIMARY_LABEL[action])}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t("projects.delete_title")}
        message={t("projects.delete_body")}
        confirmLabel={t("projects.delete_confirm")}
        cancelLabel={t("common.cancel")}
        isDestructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <RerenderAllDialog
        isOpen={!!rerenderTarget}
        initialMeta={rerenderTarget?.metadata}
        onClose={() => setRerenderTarget(null)}
        onConfirm={(opts) => {
          const target = rerenderTarget;
          setRerenderTarget(null);
          if (target) {
            void ctx.handleRerender(
              target.id,
              opts.aspectRatio,
              opts.subtitleConfig.style,
              opts.burnSubs,
              opts.canvasConfig,
              opts.subtitleConfig,
            );
          }
        }}
      />

      <RepickDialog
        isOpen={!!repickTarget}
        mode={mode}
        onClose={() => setRepickTarget(null)}
        onConfirm={(extra, maxClips) => {
          const target = repickTarget;
          setRepickTarget(null);
          if (!target) return;
          if (mode === "api") {
            void ctx.handleRerunAI(target.id, extra, maxClips);
            return;
          }
          void ctx.handleRerunManual(target.id, extra, maxClips).then((opened: boolean) => {
            if (opened) navigate(ROUTES.create);
          });
        }}
      />
    </div>
  );
};
