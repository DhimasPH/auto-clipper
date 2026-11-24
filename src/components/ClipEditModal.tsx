import React, { useContext, useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, ExternalLink, RotateCcw } from "lucide-react";
import { AppContext } from "../App";
import { CHATGPT_URL, GEMINI_URL } from "./create/MomentStep";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { Select } from "./ui/Select";
import { ToggleSwitch } from "./ui/ToggleSwitch";
import { CanvasConfigControls } from "./ui/CanvasConfigControls";
import { SubtitleConfigControls } from "./ui/SubtitleConfigControls";
import { CanvasConfig, DEFAULT_CANVAS_CONFIG } from "../types/canvas";
import { SubtitleConfig, DEFAULT_SUBTITLE_CONFIG } from "../types/subtitle";
import { apiGetClipWords, apiCorrectSubtitle, apiCreateClipRerenderJob } from "../api";
import { checkWordsAnswer, type SubtitleWord } from "../lib/aiAnswer";
import { copyText } from "../lib/clipboard";
import { requestError } from "../lib/errorInfo";
import { TechnicalDetails } from "./ui/TechnicalDetails";
import { platform } from "../platform";

interface Props {
  jobId: string;
  clipIndex: number;
  clipTitle: string;
  initialAspectRatio?: string;
  initialCanvasConfig?: CanvasConfig;
  initialSubtitleConfig?: SubtitleConfig;
  initialTrackingMode?: string;
  initialFaceTrackingEngine?: string;
  initialBurnSubs?: boolean;
  onClose: () => void;
  onRerenderStart: (newJobId: string) => void;
}

type Notice =
  | { kind: "ok"; key: string }
  | { kind: "error"; key: string; technical?: string };

const fieldClass =
  "min-h-[44px] w-full rounded-input border bg-bg-secondary px-3 py-2 text-body text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

/** The instruction sent to ChatGPT/Gemini; English works best with every model. */
function correctionPrompt(words: SubtitleWord[]): string {
  return `You are a subtitle editor. Here is a JSON array of video subtitles. Correct any spelling, grammar, or punctuation errors. KEEP the exact JSON format and the same number of items. DO NOT change the 'start' or 'end' properties. Return ONLY the valid JSON array without markdown wrapping.\n\nSubtitles:\n${JSON.stringify(words, null, 2)}`;
}

/** "Ubah subtitle atau tampilan" for one clip: fix words, change the look, make the clip again. */
export const ClipEditModal: React.FC<Props> = ({
  jobId, clipIndex, clipTitle, initialAspectRatio = "9:16", initialCanvasConfig,
  initialSubtitleConfig, initialTrackingMode = "auto", initialFaceTrackingEngine = "haar", initialBurnSubs = true, onClose, onRerenderStart,
}) => {
  const { t } = useTranslation();
  const ctx = useContext(AppContext);
  const ids = useId();
  const [words, setWords] = useState<SubtitleWord[]>([]);
  const [originalWords, setOriginalWords] = useState<SubtitleWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  // "offline": the request never reached the app; "refused": the app answered with an error.
  const [saveFailed, setSaveFailed] = useState<{ cause: "offline" | "refused"; technical: string } | null>(null);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);

  const [aspectRatio, setAspectRatio] = useState(initialAspectRatio);
  const [trackingMode, setTrackingMode] = useState(initialTrackingMode);
  const [faceTrackingEngine, setFaceTrackingEngine] = useState(initialFaceTrackingEngine);
  const [burnSubs, setBurnSubs] = useState(initialBurnSubs);
  const [canvasConfig, setCanvasConfig] = useState<CanvasConfig>(initialCanvasConfig || DEFAULT_CANVAS_CONFIG);
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(initialSubtitleConfig || DEFAULT_SUBTITLE_CONFIG);
  const [start] = useState(() => JSON.stringify([initialAspectRatio, initialTrackingMode, initialFaceTrackingEngine, initialBurnSubs, canvasConfig, subtitleConfig]));

  const [pasteInput, setPasteInput] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [autoCorrecting, setAutoCorrecting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  // Automatic correction needs the API key mode and a key (or a custom server).
  const provider: string = ctx?.provider || "";
  const apiKey: string = ctx?.apiKeys?.[provider] || "";
  const canAutoCorrect = platform().caps.apiKeys && ctx?.aiMode === "auto" && (!!apiKey || provider === "custom");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await apiGetClipWords(jobId, clipIndex);
        if (!alive) return;
        const fetched: SubtitleWord[] = data.words || [];
        setWords(fetched);
        setOriginalWords(fetched.map((w) => ({ ...w })));
        setEmptyReason(data.reason || null);
      } catch (e) {
        console.error(e);
        if (alive) setEmptyReason("fetch_error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [jobId, clipIndex]);

  const wordsChanged = JSON.stringify(words) !== JSON.stringify(originalWords);
  const lookChanged =
    JSON.stringify([aspectRatio, trackingMode, faceTrackingEngine, burnSubs, canvasConfig, subtitleConfig]) !== start;
  const dirty = wordsChanged || lookChanged || pasteInput.trim() !== "";

  const handleWordChange = (idx: number, newText: string) => {
    setWords((list) => list.map((w, i) => (i === idx ? { ...w, word: newText } : w)));
  };

  const copyPrompt = async () => {
    const ok = await copyText(correctionPrompt(words));
    setCopyState(ok ? "copied" : "failed");
    if (ok) setTimeout(() => setCopyState("idle"), 2000);
  };

  const applyAnswer = () => {
    const check = checkWordsAnswer(pasteInput, words);
    if (!check.ok) {
      setNotice({ kind: "error", key: `clip_rerender.answer_${check.problem}` });
      return;
    }
    setWords(check.words);
    setPasteInput("");
    setNotice({ kind: "ok", key: "clip_rerender.answer_applied" });
  };

  const runAutoCorrect = async () => {
    setAutoCorrecting(true);
    setNotice(null);
    try {
      const data = await apiCorrectSubtitle({
        words,
        provider,
        api_key: apiKey,
        model: ctx?.selectedModel || "",
        custom_base_url: ctx?.apiKeys?.custom_base_url || "",
        custom_model_name: ctx?.apiKeys?.custom_model_name || "",
      });
      if (data?.status === "success" && Array.isArray(data.words)) {
        setWords(data.words);
        setNotice({ kind: "ok", key: "clip_rerender.auto_done" });
      } else {
        setNotice({ kind: "error", key: "clip_rerender.auto_failed", technical: typeof data?.message === "string" ? data.message : "" });
      }
    } catch (e) {
      setNotice({ kind: "error", key: "clip_rerender.auto_failed", technical: requestError(e, "").message });
    } finally {
      setAutoCorrecting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveFailed(null);
    try {
      const data = await apiCreateClipRerenderJob(jobId, clipIndex, {
        words,
        aspect_ratio: aspectRatio,
        tracking_mode: trackingMode,
        face_tracking_engine: faceTrackingEngine,
        caption_style: subtitleConfig.style,
        burn_subs: burnSubs,
        canvas_config: canvasConfig,
        subtitle_config: subtitleConfig,
      });
      onRerenderStart(data.job_id);
    } catch (e) {
      console.error(e);
      const status = (e as { response?: { status?: number } } | null)?.response?.status;
      const refused = typeof status === "number" && status >= 400 && status < 500 && status !== 404;
      setSaveFailed({ cause: refused ? "refused" : "offline", technical: requestError(e, "").message });
    } finally {
      setSaving(false);
    }
  };

  const emptyMessage = () => {
    switch (emptyReason) {
      case "no_subtitle_file": return t("clip_rerender.no_subtitle_file");
      case "no_words_in_file": return t("clip_rerender.no_words_in_file");
      case "read_error": return t("clip_rerender.read_error");
      case "fetch_error": return t("clip_rerender.fetch_error");
      default: return t("clip_rerender.no_words");
    }
  };

  const query = search.trim().toLowerCase();

  return (
    <Dialog
      title={t("clip_rerender.title")}
      subtitle={clipTitle}
      onClose={onClose}
      dirty={dirty}
      size="xl"
      footer={(requestClose) => (
        <>
          <Button variant="outline" onClick={requestClose}>{t("common.cancel")}</Button>
          <Button variant="primary" onClick={() => void handleSave()} loading={saving} disabled={loading}>
            {saving ? t("clip_rerender.saving") : t("clip_rerender.save_rerender")}
          </Button>
        </>
      )}
    >
      <div className="flex flex-col gap-6">
        <section aria-labelledby={`${ids}-words`} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 id={`${ids}-words`} className="text-card-title text-text-primary">{t("clip_rerender.word_grid")}</h3>
              <p className="text-caption text-text-secondary">{t("clip_rerender.words_count", { count: words.length })}</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              {wordsChanged && (
                <Button variant="ghost" icon={RotateCcw} onClick={() => setWords(originalWords.map((w) => ({ ...w })))}>
                  {t("clip_rerender.reset")}
                </Button>
              )}
              <label className="flex flex-col gap-1.5 text-label text-text-primary">
                {t("clip_rerender.search_label")}
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    // Escape empties the search only; the dialog leaves an Escape that was used alone.
                    if (e.key === "Escape" && search !== "") {
                      e.preventDefault();
                      setSearch("");
                    }
                  }}
                  className={`${fieldClass} border-border-active sm:w-56`}
                />
              </label>
            </div>
          </div>

          {loading ? (
            <p role="status" className="text-body text-text-secondary">{t("clip_rerender.loading")}</p>
          ) : words.length === 0 ? (
            <p className="text-body text-text-secondary">{emptyMessage()}</p>
          ) : (
            <div className="grid max-h-72 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {words.map((w, idx) => {
                const isMatch = !!query && w.word.toLowerCase().includes(query);
                const isChanged = originalWords[idx] && w.word !== originalWords[idx].word;
                return (
                  <label key={idx} className="flex min-w-0 flex-col gap-1">
                    <span className="text-caption text-text-secondary">
                      {t("clip_rerender.word_time", { start: w.start.toFixed(1), end: w.end.toFixed(1) })}
                      {isChanged && <span> · {t("clip_rerender.changed")}</span>}
                    </span>
                    <input
                      type="text"
                      value={w.word}
                      onChange={(e) => handleWordChange(idx, e.target.value)}
                      className={`${fieldClass} ${isMatch ? "border-accent bg-accent-muted" : isChanged ? "border-warning" : "border-border-active"}`}
                    />
                  </label>
                );
              })}
            </div>
          )}

          {words.length > 0 && (
            <details className="rounded-card border border-border">
              <summary className="flex min-h-[44px] cursor-pointer items-center px-4 text-body font-medium text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                {t("clip_rerender.ai_title")}
              </summary>
              <div className="flex flex-col gap-3 border-t border-border p-4">
                {canAutoCorrect && (
                  <div className="flex flex-col items-start gap-2">
                    <p className="text-body text-text-secondary">{t("clip_rerender.auto_desc")}</p>
                    <Button variant="outline" loading={autoCorrecting} onClick={() => void runAutoCorrect()}>
                      {autoCorrecting ? t("clip_rerender.auto_running") : t("clip_rerender.auto_btn")}
                    </Button>
                  </div>
                )}
                <p className="text-body text-text-secondary">{t("clip_rerender.manual_desc")}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" icon={Copy} onClick={() => void copyPrompt()}>
                    {copyState === "copied" ? t("moment.copied") : t("moment.copy")}
                  </Button>
                  <Button variant="outline" icon={ExternalLink} onClick={() => void platform().openExternal(CHATGPT_URL).catch(console.error)}>
                    {t("moment.open_chatgpt")}
                  </Button>
                  <Button variant="outline" icon={ExternalLink} onClick={() => void platform().openExternal(GEMINI_URL).catch(console.error)}>
                    {t("moment.open_gemini")}
                  </Button>
                </div>
                {copyState === "failed" && <p role="alert" className="text-body text-error">{t("clip_rerender.copy_failed")}</p>}
                <label className="flex flex-col gap-1.5 text-label text-text-primary">
                  {t("moment.answer_label")}
                  <textarea
                    value={pasteInput}
                    onChange={(e) => setPasteInput(e.target.value)}
                    rows={4}
                    className={`${fieldClass} border-border-active font-mono`}
                  />
                </label>
                <div>
                  <Button variant="outline" disabled={!pasteInput.trim()} onClick={applyAnswer}>
                    {t("clip_rerender.apply_answer")}
                  </Button>
                </div>
                {notice?.kind === "ok" && <p role="status" className="text-body text-success">{t(notice.key)}</p>}
                {notice?.kind === "error" && (
                  <div role="alert" className="flex flex-col gap-1">
                    <p className="text-body text-error">{t(notice.key)}</p>
                    <TechnicalDetails text={notice.technical} />
                  </div>
                )}
              </div>
            </details>
          )}
        </section>

        <section aria-labelledby={`${ids}-look`} className="flex flex-col gap-4 border-t border-border pt-5">
          <h3 id={`${ids}-look`} className="text-card-title text-text-primary">{t("clip_rerender.visual_settings")}</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              label={t("create.shape_label")}
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              options={[
                { label: t("create.shape_vertical"), value: "9:16" },
                { label: t("create.shape_square"), value: "1:1" },
                { label: t("create.shape_wide"), value: "16:9" },
                ...(initialAspectRatio === "4:5" ? [{ label: "4:5", value: "4:5" }] : []),
              ]}
            />
            {["9:16", "4:5", "1:1"].includes(aspectRatio) && (
              <Select
                label={t("create.face_label")}
                value={trackingMode}
                onChange={(e) => setTrackingMode(e.target.value)}
                options={[
                  { label: t("create.face_follow"), value: "auto" },
                  { label: t("create.face_center"), value: "center" },
                ]}
              />
            )}
            {["9:16", "4:5", "1:1"].includes(aspectRatio) && trackingMode === "auto" && (
              <Select
                label={t("settings.face_engine_label")}
                value={faceTrackingEngine}
                onChange={(e) => setFaceTrackingEngine(e.target.value)}
                options={[
                  { label: t("settings.face_engine_standard"), value: "haar" },
                  { label: t("settings.face_engine_precise"), value: "mediapipe" },
                ]}
              />
            )}
          </div>
          <ToggleSwitch label={t("create.subtitles")} checked={burnSubs} onChange={setBurnSubs} />
          {burnSubs && (
            <SubtitleConfigControls config={subtitleConfig} onChange={setSubtitleConfig} showModeSwitch={true} aspectRatio={aspectRatio} />
          )}
          {aspectRatio === "16:9" && (
            <CanvasConfigControls config={canvasConfig} onChange={setCanvasConfig} showModeSwitch={true} />
          )}
        </section>

        {saveFailed !== null && (
          <div role="alert" className="flex flex-col gap-1">
            <p className="text-body text-error">
              {t(saveFailed.cause === "refused" ? "clip_rerender.save_refused" : "clip_rerender.save_failed")}
            </p>
            <TechnicalDetails text={saveFailed.technical} />
          </div>
        )}
      </div>
    </Dialog>
  );
};
