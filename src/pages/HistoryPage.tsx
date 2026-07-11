import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { Trash2, Download, Folder, RefreshCw, Wand2 } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { AppContext, API_URL } from "../App";
import { canRerunAI } from "../lib/history";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Select } from "../components/ui/Select";
import ClipCard from "../components/ClipCard";

export const HistoryPage: React.FC = () => {
  const { t } = useTranslation();
  const ctx = useContext(AppContext);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeRerenderId, setActiveRerenderId] = useState<string | null>(null);
  const [activeAiId, setActiveAiId] = useState<string | null>(null);
  const [extraPrompt, setExtraPrompt] = useState("");

  const [localAspectRatio, setLocalAspectRatio] = useState("9:16");
  const [localCaptionStyle, setLocalCaptionStyle] = useState("standard");
  const [localBurnSubs, setLocalBurnSubs] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

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

  const deleteHistory = async (jobId: string) => {
    if (window.confirm(t("history.delete_confirm"))) {
      try {
        await axios.delete(`${API_URL}/history/${jobId}`);
        fetchHistory();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
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
                    {job.url}
                  </a>
                  <div className="flex items-center gap-3 mt-2 text-caption text-text-secondary">
                    <span>{new Date(job.created_at).toLocaleString()}</span>
                    <span>•</span>
                    <Badge
                      variant={
                        job.status === "completed"
                          ? "success"
                          : job.status === "failed"
                            ? "error"
                            : "neutral"
                      }
                    >
                      {job.status}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="text-danger"
                  icon={Trash2}
                  onClick={() => deleteHistory(job.id)}
                />
              </div>

              {job.result_clips && job.result_clips.length > 0 && (
                <div className="flex gap-6 overflow-x-auto py-4">
                  {job.result_clips.map((clip: any, idx: number) => (
                    <ClipCard
                      key={clip.path || idx}
                      clip={{
                        path: clip.path,
                        description: clip.description || "",
                        description_id: clip.description_id || "",
                        description_en: clip.description_en || "",
                        start: clip.start || "",
                        end: clip.end || "",
                        subs: clip.subs || false,
                        v: Date.now(),
                      }}
                      index={idx}
                      mode="ai"
                      videoSrc={(path) =>
                        `${API_URL}/video?path=${encodeURIComponent(path)}`
                      }
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
                    {localBurnSubs && (
                      <Select
                        label={t("history.caption_style")}
                        value={localCaptionStyle}
                        onChange={(e) => setLocalCaptionStyle(e.target.value)}
                        options={[
                          {
                            label: t("history.style_standard"),
                            value: "standard",
                          },
                          {
                            label: t("history.style_karaoke"),
                            value: "karaoke",
                          },
                        ]}
                      />
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        ctx.handleRerender(
                          job.id,
                          localAspectRatio,
                          localCaptionStyle,
                          localBurnSubs,
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
                    onClick={() =>
                      setActiveRerenderId(
                        activeRerenderId === job.id ? null : job.id,
                      )
                    }
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
