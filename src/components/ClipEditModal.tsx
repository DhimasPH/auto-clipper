import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X, Search, RotateCcw, Wand2, Copy, Check, Loader2, ChevronRight } from "lucide-react";
import { Button } from "./ui/Button";
import { Select } from "./ui/Select";
import { CanvasConfigControls } from "./ui/CanvasConfigControls";
import { SubtitleConfigControls } from "./ui/SubtitleConfigControls";
import { CanvasConfig, DEFAULT_CANVAS_CONFIG } from "../types/canvas";
import { SubtitleConfig, DEFAULT_SUBTITLE_CONFIG } from "../types/subtitle";
import { apiGetClipWords, apiCorrectSubtitle, apiCreateClipRerenderJob } from "../api";
import { useUserSettings } from "../hooks/useUserSettings";
import { ConfirmDialog } from "./ui/ConfirmDialog";

interface Props {
  jobId: string;
  clipIndex: number;
  clipTitle: string;
  initialAspectRatio?: string;
  initialCanvasConfig?: CanvasConfig;
  initialSubtitleConfig?: SubtitleConfig;
  initialBurnSubs?: boolean;
  onClose: () => void;
  onRerenderStart: (newJobId: string) => void;
}

export const ClipEditModal: React.FC<Props> = ({
  jobId, clipIndex, clipTitle, initialAspectRatio = "9:16", initialCanvasConfig,
  initialSubtitleConfig, initialBurnSubs = true, onClose, onRerenderStart
}) => {
  const { t } = useTranslation();
  const { apiKeys } = useUserSettings();
  const [words, setWords] = useState<any[]>([]);
  const [originalWords, setOriginalWords] = useState<any[]>([]); // For reset
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);

  const [aspectRatio, setAspectRatio] = useState(initialAspectRatio);
  const [burnSubs, setBurnSubs] = useState(initialBurnSubs);
  const [canvasConfig, setCanvasConfig] = useState<CanvasConfig>(initialCanvasConfig || DEFAULT_CANVAS_CONFIG);
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(initialSubtitleConfig || DEFAULT_SUBTITLE_CONFIG);

  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'manual' | 'auto'>('manual');
  const [isCopied, setIsCopied] = useState(false);
  const [pasteInput, setPasteInput] = useState('');
  const [isAutoCorrecting, setIsAutoCorrecting] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const generatePrompt = () => {
    const jsonStr = JSON.stringify(words, null, 2);
    return `You are a subtitle editor. Here is a JSON array of video subtitles. Correct any spelling, grammar, or punctuation errors. KEEP the exact JSON format. DO NOT change the 'start' or 'end' properties. Return ONLY the valid JSON array without markdown wrapping.\n\nSubtitles:\n${jsonStr}`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatePrompt());
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const applyManualJSON = () => {
    try {
      let cleanStr = pasteInput.trim();
      if (cleanStr.startsWith('```json')) cleanStr = cleanStr.substring(7);
      else if (cleanStr.startsWith('```')) cleanStr = cleanStr.substring(3);
      if (cleanStr.endsWith('```')) cleanStr = cleanStr.substring(0, cleanStr.length - 3);
      cleanStr = cleanStr.trim();
      
      const parsed = JSON.parse(cleanStr);
      const arr = Array.isArray(parsed) ? parsed : (parsed.words || null);
      
      if (!arr || !Array.isArray(arr) || arr.length === 0 || typeof arr[0].word !== 'string') {
        throw new Error('Invalid JSON format. Expected array of words.');
      }
      
      setWords(arr);
      setPasteInput('');
      setAlertMessage("Subtitle berhasil diperbarui");
    } catch (e: any) {
      setAlertMessage('Gagal memproses JSON: ' + e.message);
    }
  };

  const runAutoCorrect = async () => {
    setIsAutoCorrecting(true);
    try {
      const provider = localStorage.getItem('ac_provider') || 'openai';
      const apiKey = apiKeys[provider] || '';
      const model = localStorage.getItem('ac_model') || '';
      const customBaseUrl = apiKeys['custom_base_url'] || '';
      const customModelName = apiKeys['custom_model_name'] || '';

      if (!apiKey && provider !== 'custom') {
        throw new Error('API Key belum diatur di menu Settings.');
      }

      const data = await apiCorrectSubtitle({
        words, provider, api_key: apiKey, model,
        custom_base_url: customBaseUrl, custom_model_name: customModelName
      });
      if (data.status === 'success' && data.words) {
        setWords(data.words);
        setAlertMessage("Subtitle berhasil dikoreksi otomatis");
      } else {
        throw new Error(data.message || 'Gagal mengoreksi subtitle');
      }
    } catch (e: any) {
      setAlertMessage(e.response?.data?.message || e.message);
    } finally {
      setIsAutoCorrecting(false);
    }
  };

  useEffect(() => {
    fetchWords();
  }, [jobId, clipIndex]);

  const fetchWords = async () => {
    try {
      const data = await apiGetClipWords(jobId, clipIndex);
      const fetched = data.words || [];
      setWords(fetched);
      setOriginalWords(JSON.parse(JSON.stringify(fetched))); // Deep clone for reset
      setEmptyReason(data.reason || null);
    } catch (e) {
      console.error(e);
      setEmptyReason("fetch_error");
    } finally {
      setLoading(false);
    }
  };

  const handleWordChange = (idx: number, newText: string) => {
    const newWords = [...words];
    newWords[idx] = { ...newWords[idx], word: newText };
    setWords(newWords);
  };

  const handleReset = () => {
    setWords(JSON.parse(JSON.stringify(originalWords)));
  };

  const hasChanges = JSON.stringify(words) !== JSON.stringify(originalWords);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        words,
        aspect_ratio: aspectRatio,
        caption_style: subtitleConfig.style,
        burn_subs: burnSubs,
        canvas_config: canvasConfig,
        subtitle_config: subtitleConfig
      };
      const data = await apiCreateClipRerenderJob(jobId, clipIndex, payload);
      onRerenderStart(data.job_id);
    } catch (e) {
      console.error(e);
      setAlertMessage(t("clip_rerender.save_failed", "Failed to start rerender"));
    } finally {
      setSaving(false);
    }
  };

  const getEmptyMessage = () => {
    switch (emptyReason) {
      case "no_subtitle_file": return t("clip_rerender.no_subtitle_file");
      case "no_words_in_file": return t("clip_rerender.no_words_in_file");
      case "read_error": return t("clip_rerender.read_error");
      case "fetch_error": return t("clip_rerender.fetch_error");
      default: return t("clip_rerender.no_words");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-bg-surface border border-border rounded-xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-border flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {t("clip_rerender.title")}
            </h2>
            <p className="text-sm text-text-secondary">{clipTitle}</p>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* AI Auto Correction Section */}
          <div className="bg-bg-surface border border-border rounded-xl overflow-hidden mb-4">
            <button 
              onClick={() => setIsAiAssistantOpen(!isAiAssistantOpen)}
              className="w-full flex items-center justify-between p-4 hover:bg-input-bg transition-colors"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                <Wand2 className="w-4 h-4 text-accent" />
                AI Auto Correction
              </div>
              <ChevronRight className={`w-4 h-4 text-text-secondary transition-transform ${isAiAssistantOpen ? 'rotate-90' : ''}`} />
            </button>
            
            {isAiAssistantOpen && (
              <div className="p-4 border-t border-border space-y-4">
                <div className="flex items-center gap-2 p-1 bg-input-bg rounded-lg w-max">
                  <button
                    onClick={() => setAiMode('manual')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${aiMode === 'manual' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
                  >
                    Manual (Copy/Paste)
                  </button>
                  <button
                    onClick={() => setAiMode('auto')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${aiMode === 'auto' ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'}`}
                  >
                    Auto (API Key)
                  </button>
                </div>

                {aiMode === 'manual' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-secondary">1. Generate & Copy Prompt</span>
                        <button onClick={copyToClipboard} className="flex items-center gap-1.5 text-xs text-accent hover:opacity-80 transition-opacity">
                          {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {isCopied ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <textarea
                        readOnly
                        value={generatePrompt()}
                        className="w-full h-32 bg-input-bg border border-border rounded-lg p-2.5 text-xs text-text-primary font-mono resize-none outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-secondary">2. Paste AI Result (JSON)</span>
                      </div>
                      <textarea
                        value={pasteInput}
                        onChange={(e) => setPasteInput(e.target.value)}
                        placeholder='[{"word": "Hello", "start": 0.0, "end": 0.5}]'
                        className="w-full h-32 bg-input-bg border border-border rounded-lg p-2.5 text-xs text-text-primary font-mono resize-none focus:border-accent outline-none"
                      />
                      <button 
                        onClick={applyManualJSON}
                        disabled={!pasteInput.trim()}
                        className="w-full py-2 bg-input-bg border border-border hover:bg-bg-secondary disabled:opacity-50 disabled:cursor-not-allowed text-text-primary text-xs font-medium rounded-lg transition-colors"
                      >
                        Apply Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 px-4 bg-input-bg rounded-lg border border-border text-center">
                    <Wand2 className="w-8 h-8 text-accent mb-3" />
                    <h4 className="text-sm font-medium text-text-primary mb-1">Koreksi Subtitle Otomatis</h4>
                    <p className="text-xs text-text-secondary mb-4 max-w-sm">
                      Aplikasi akan mengirimkan teks subtitle ke penyedia AI yang telah diatur di Settings (OpenAI/Gemini/dll) untuk memperbaiki ejaan dan tata bahasa.
                    </p>
                    <button
                      onClick={runAutoCorrect}
                      disabled={isAutoCorrecting}
                      className="flex items-center gap-2 px-6 py-2.5 bg-accent hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-opacity"
                    >
                      {isAutoCorrecting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Memproses...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4" />
                          Auto Correct dengan AI
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <section>
            <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
              <h3 className="text-sm font-medium text-text-primary">
                {t("clip_rerender.word_grid")}
              </h3>
              <div className="flex items-center gap-3">
                {hasChanges && (
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1 text-xs text-text-secondary hover:text-accent transition-colors"
                    title={t("clip_rerender.reset")}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t("clip_rerender.reset")}
                  </button>
                )}
                <div className="relative">
                  <Search className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={t("clip_rerender.search_placeholder")}
                    className="bg-input-bg border border-border rounded-md pl-9 pr-3 py-1.5 text-sm text-text-primary focus:border-accent outline-none"
                  />
                </div>
                <span className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-md">
                  {words.length} {t("clip_rerender.words_count")}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-4 text-text-secondary">{t("clip_rerender.loading")}</div>
            ) : words.length === 0 ? (
              <div className="text-center py-8 text-text-secondary text-sm">
                {getEmptyMessage()}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-64 overflow-y-auto pr-2">
                {words.map((w, idx) => {
                  const isMatch = search && w.word.toLowerCase().includes(search.toLowerCase());
                  const isChanged = originalWords[idx] && w.word !== originalWords[idx].word;
                  return (
                    <div key={idx} className="flex flex-col gap-1">
                      <span className="text-[10px] text-text-secondary font-mono">
                        {w.start.toFixed(1)}s - {w.end.toFixed(1)}s
                      </span>
                      <input
                        type="text"
                        value={w.word}
                        onChange={e => handleWordChange(idx, e.target.value)}
                        className={`bg-input-bg border rounded-md px-2 py-1.5 text-sm text-text-primary focus:border-accent outline-none ${
                          isMatch ? 'border-accent bg-accent/10' :
                          isChanged ? 'border-yellow-500/50 bg-yellow-500/5' :
                          'border-border'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <hr className="border-border" />

          <section>
            <h3 className="text-sm font-medium text-text-primary mb-4">
              {t("clip_rerender.visual_settings")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Select
                label={t("history.aspect_ratio")}
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                options={[
                  { label: t("history.ar_9_16"), value: "9:16" },
                  { label: t("history.ar_16_9"), value: "16:9" },
                  { label: t("history.ar_1_1"), value: "1:1" },
                ]}
              />
              <Select
                label={t("history.embed_subtitle")}
                value={burnSubs ? "yes" : "no"}
                onChange={(e) => setBurnSubs(e.target.value === "yes")}
                options={[
                  { label: t("history.sub_yes"), value: "yes" },
                  { label: t("history.sub_no"), value: "no" },
                ]}
              />
            </div>
            {burnSubs && (
              <div className="mb-4">
                <SubtitleConfigControls config={subtitleConfig} onChange={setSubtitleConfig} showModeSwitch={true} />
              </div>
            )}
            {aspectRatio === "16:9" && (
              <div className="mb-4">
                <CanvasConfigControls config={canvasConfig} onChange={setCanvasConfig} showModeSwitch={true} />
              </div>
            )}
          </section>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-3 bg-bg-secondary rounded-b-xl">
          <Button variant="ghost" onClick={onClose}>{t("history.cancel")}</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? t("clip_rerender.saving") : t("clip_rerender.save_rerender")}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!alertMessage}
        onClose={() => setAlertMessage(null)}
        onConfirm={() => setAlertMessage(null)}
        title="Information"
        description={alertMessage}
        hideCancel
      />
    </div>
  );
};
