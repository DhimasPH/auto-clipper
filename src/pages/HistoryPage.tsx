import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { Trash2, RefreshCw, Wand2, Play } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { AppContext } from "../App";
import { API_URL } from "../config/api";
import { canRerunAI, canResumeJob } from "../lib/history";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Select } from "../components/ui/Select";
import ClipCard from "../components/ClipCard";
import { ManualResumeModal } from "../components/ManualResumeModal";
import { ClipEditModal } from "../components/ClipEditModal";
import { CanvasConfig, DEFAULT_CANVAS_CONFIG } from "../types/canvas";
import { CanvasConfigControls } from "../components/ui/CanvasConfigControls";
import { SubtitleConfig, DEFAULT_SUBTITLE_CONFIG } from "../types/subtitle";
import { SubtitleConfigControls } from "../components/ui/SubtitleConfigControls";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

export const HistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const ctx = useContext(AppContext);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeRerenderId, setActiveRerenderId] = useState<string | null>(null);
  const [activeAiId, setActiveAiId] = useState<string | null>(null);
  const [activeManualJob, setActiveManualJob] = useState<any | null>(null);
  const [activeEditClip, setActiveEditClip] = useState<{job: any, index: number} | null>(null);
  const [extraPrompt, setExtraPrompt] = useState("");

  const [localAspectRatio, setLocalAspectRatio] = useState("9:16");
  const [localBurnSubs, setLocalBurnSubs] = useState(true);
  const [localCanvasConfig, setLocalCanvasConfig] = useState<CanvasConfig>(DEFAULT_CANVAS_CONFIG);
  const [localSubtitleConfig, setLocalSubtitleConfig] = useState<SubtitleConfig>(DEFAULT_SUBTITLE_CONFIG);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, [ctx.historyVersion]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/history`);
      setHistory(res.data.history || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const executeDelete = async () => {
    if (!confirmDeleteId) return;
    const jobId = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      setDeletingId(jobId);
      // Short pause to allow DOM to unmount video elements and release file handles
      await new Promise((r) => setTimeout(r, 60));
      await axios.delete(`${API_URL}/history/${jobId}`);
      fetchHistory();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-8 w-full mx-auto">
      <div className="flex justify-between items-center mb-8">
        <PageHeader
          title="History"
          subtitle="View and manage generated clips"
        />
        <Button
          variant="outline"
          icon={RefreshCw}
          onClick={fetchHistory}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="spinner" />
        </div>
      ) : history.length === 0 ? (
        <div className="text-center p-12 bg-bg-secondary rounded-card border border-border">
          <p className="text-body text-text-secondary">{t("history.empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 pb-12">
          {history.map((job) => (
            <div
              key={job.id}
              className="bg-bg-secondary rounded-card border border-border p-6 shadow-sm flex flex-col gap-4"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-body font-medium text-text-primary hover:text-accent truncate block"
                  >
                    {job.metadata?.title
                      ? `${job.metadata.title} - ${job.url}`
                      : job.url}
                  </a>
                  <div className="flex items-center gap-3 mt-2 text-caption text-text-secondary flex-wrap">
                    <span>{new Date(job.created_at).toLocaleString()}</span>
                    <span>•</span>
                    <Badge
                      variant={
                        (job.status === "completed" || job.status === "DONE")
                          ? "success"
                          : (job.status === "failed" || job.status === "ERROR")
                            ? "error"
                            : (job.status === "AWAITING_MANUAL")
                              ? "warning"
                              : (job.status === "PROCESSING" || job.status === "QUEUED")
                                ? "info"
                                : "default"
                      }
                    >
                      {job.status}
                    </Badge>
                    {job.metadata?.duration_seconds != null && (
                      <>
                        <span>•</span>
                        <span>
                          ⏱️ {Math.floor(job.metadata.duration_seconds / 60)}m{" "}
                          {job.metadata.duration_seconds % 60}s
                        </span>
                      </>
                    )}
                    {job.metadata?.quality && (
                      <>
                        <span>•</span>
                        <span className="uppercase text-xs font-semibold px-2 py-0.5 bg-accent/10 text-accent rounded-full">
                          {job.metadata.quality}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="text-danger"
                  icon={Trash2}
                  disabled={deletingId === job.id}
                  onClick={() => setConfirmDeleteId(job.id)}
                />
              </div>

              {deletingId !== job.id && job.result_clips && job.result_clips.length > 0 && (
                <div className="flex gap-6 overflow-x-auto py-4">
                  {job.result_clips.map((clip: any, idx: number) => (
                    <ClipCard
                      key={clip.path || idx}
                      clip={{
                        ...clip,
                        description: clip.description || "",
                        start: clip.start || "",
                        end: clip.end || "",
                        subs: clip.subs || false,
                        v: Date.now(),
                      }}
                      index={idx}
                      jobId={job.id}
                      videoSrc={(path, v) =>
                        `${API_URL}/video?path=${encodeURIComponent(path)}&v=${v || 0}`
                      }
                      onEdit={() => setActiveEditClip({job, index: idx})}
                    />
                  ))}
                </div>
              )}

              {/* Rerender Panel */}
              {activeRerenderId === job.id && (
                <div className="mt-2 p-4 bg-bg-surface rounded-lg border border-border animate-slide-up">
                  <h4 className="text-body font-medium mb-4">
                    {t("history.rerender_options")}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <Select
                      label={t("history.aspect_ratio")}
                      value={localAspectRatio}
                      onChange={(e) => setLocalAspectRatio(e.target.value)}
                      options={[
                        { label: t("history.ar_9_16"), value: "9:16" },
                        { label: t("history.ar_16_9"), value: "16:9" },
                        { label: t("history.ar_4_5"), value: "4:5" },
                        { label: t("history.ar_1_1"), value: "1:1" },
                      ]}
                    />
                    <Select
                      label={t("history.embed_subtitle")}
                      value={localBurnSubs ? "yes" : "no"}
                      onChange={(e) =>
                        setLocalBurnSubs(e.target.value === "yes")
                      }
                      options={[
                        { label: t("history.sub_yes"), value: "yes" },
                        { label: t("history.sub_no"), value: "no" },
                      ]}
                    />
                  </div>

                  {localBurnSubs && (
                    <div className="mb-4 pt-2 border-t border-border">
                      <SubtitleConfigControls
                        config={localSubtitleConfig}
                        onChange={setLocalSubtitleConfig}
                        showModeSwitch={true}
                      />
                    </div>
                  )}

                  {localAspectRatio === "16:9" && (
                    <div className="mb-4 pt-2 border-t border-border">
                      <CanvasConfigControls
                        config={localCanvasConfig}
                        onChange={setLocalCanvasConfig}
                        showModeSwitch={true}
                      />
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        ctx.handleRerender(
                          job.id,
                          localAspectRatio,
                          localSubtitleConfig.style,
                          localBurnSubs,
                          localCanvasConfig,
                          localSubtitleConfig,
                        );
                        setActiveRerenderId(null);
                      }}
                    >
                      {t("history.start_rerender")}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setActiveRerenderId(null)}
                    >
                      {t("history.cancel")}
                    </Button>
                  </div>
                </div>
              )}

              {/* AI Correction Panel */}
              {activeAiId === job.id && (
                <div className="mt-2 p-4 bg-bg-surface rounded-lg border border-border animate-slide-up">
                  <h4 className="text-body font-medium mb-2">
                    {t("history.ai_correct")}
                  </h4>
                  <p className="text-caption text-text-secondary mb-4">
                    {t("history.ai_correct_desc")}
                  </p>

                  <textarea
                    value={extraPrompt}
                    onChange={(e) => setExtraPrompt(e.target.value)}
                    placeholder={t("history.ai_prompt_placeholder")}
                    className="w-full h-24 p-3 rounded-lg border border-border bg-input-bg text-text-primary mb-4 focus:outline-none focus:border-accent"
                  />

                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        ctx.handleRerunAI(job.id, extraPrompt);
                        setActiveAiId(null);
                        setExtraPrompt("");
                      }}
                    >
                      {t("history.run_ai")}
                    </Button>
                    <Button variant="ghost" onClick={() => setActiveAiId(null)}>
                      {t("history.cancel")}
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex gap-3 mt-2 flex-wrap">
                {job.result_clips && job.result_clips.length > 0 && (
                  <Button
                    variant={
                      activeRerenderId === job.id ? "primary" : "outline"
                    }
                    icon={RefreshCw}
                    onClick={() => {
                      if (activeRerenderId === job.id) {
                        setActiveRerenderId(null);
                      } else {
                        setActiveRerenderId(job.id);
                        setLocalAspectRatio(job.aspect_ratio || "9:16");
                        setLocalBurnSubs(job.burn_subs ?? true);
                        setLocalCanvasConfig(job.canvas_config || DEFAULT_CANVAS_CONFIG);
                        if (job.subtitle_config) {
                          setLocalSubtitleConfig(job.subtitle_config);
                        } else {
                          setLocalSubtitleConfig({
                            ...DEFAULT_SUBTITLE_CONFIG,
                            style: job.caption_style === "karaoke" ? "karaoke" : "standard",
                          });
                        }
                      }
                    }}
                  >
                    {t("history.rerender_btn")}
                  </Button>
                )}
                {canRerunAI(job) && (
                  <Button
                    variant={activeAiId === job.id ? "primary" : "outline"}
                    icon={Wand2}
                    onClick={() =>
                      setActiveAiId(activeAiId === job.id ? null : job.id)
                    }
                  >
                    {t("history.ai_correct")}
                  </Button>
                )}
                {job.status === "AWAITING_MANUAL" && (
                  <Button
                    variant="primary"
                    icon={Play}
                    onClick={() => setActiveManualJob(job)}
                  >
                    {t("history.lanjut_manual")}
                  </Button>
                )}
                {(job.status === "failed" || job.status === "ERROR") && canResumeJob(job) && (
                  <Button
                    variant="outline"
                    className="!text-accent !border-accent/30 hover:!bg-accent/10"
                    icon={Play}
                    onClick={() => ctx.handleResumeJob(job.id)}
                  >
                    Retry
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeManualJob && (
        <ManualResumeModal
          job={activeManualJob}
          onClose={() => setActiveManualJob(null)}
          onSuccess={(jobId: string) => {
            setActiveManualJob(null);
            ctx.startManualResumePolling(jobId);
          }}
        />
      )}

      {activeEditClip && (
        <ClipEditModal
          jobId={activeEditClip.job.id}
          clipIndex={activeEditClip.index}
          clipTitle={`${t("clip.title_ai", { num: activeEditClip.index + 1 })}`}
          initialAspectRatio={activeEditClip.job.metadata?.aspect_ratio || "9:16"}
          initialBurnSubs={activeEditClip.job.metadata?.burn_subs ?? true}
          initialCanvasConfig={activeEditClip.job.metadata?.canvas_config}
          initialSubtitleConfig={activeEditClip.job.metadata?.subtitle_config}
          onClose={() => setActiveEditClip(null)}
          onRerenderStart={(newJobId) => {
            setActiveEditClip(null);
            ctx.handleRerenderClip(newJobId);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={executeDelete}
        title={t("history.delete_confirm")}
        intent="danger"
      />
    </div>
  );
};
