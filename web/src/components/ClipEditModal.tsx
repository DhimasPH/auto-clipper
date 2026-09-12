import React, { useState, useEffect } from "react";
import { X, Wand2, RefreshCcw, Search, RotateCcw, Copy, Check, ChevronRight } from "lucide-react";
import { apiGetClipWords, apiCreateClipRerenderJob } from "../api";
import { OutputStyleSelector, type OutputStyle } from "./OutputStyleSelector";
import { CanvasConfigControls } from "./ui/CanvasConfigControls";
import { SubtitleConfigControls } from "./ui/SubtitleConfigControls";
import { ToggleSwitch } from "./ToggleSwitch";
import { DEFAULT_SUBTITLE_CONFIG, type SubtitleConfig } from "../types/subtitle";
import { DEFAULT_CANVAS_CONFIG, type CanvasConfig } from "../types/canvas";

interface ClipEditModalProps {
  jobId: string;
  clipIndex: number;
  clipTitle: string;
  initialOutputStyle?: OutputStyle;
  initialSubtitleConfig?: SubtitleConfig;
  initialCanvasConfig?: CanvasConfig;
  initialTrackingMode?: string;
  onClose: () => void;
  onRerenderStart: (newJobId: string) => void;
}

export const ClipEditModal: React.FC<ClipEditModalProps> = ({
  jobId,
  clipIndex,
  clipTitle,
  initialOutputStyle = "face_crop",
  initialSubtitleConfig = DEFAULT_SUBTITLE_CONFIG,
  initialCanvasConfig = DEFAULT_CANVAS_CONFIG,
  initialTrackingMode = "auto",
  onClose,
  onRerenderStart,
}) => {
  const [words, setWords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [outputStyle, setOutputStyle] = useState<OutputStyle>(initialOutputStyle);
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(initialSubtitleConfig);
  const [canvasConfig, setCanvasConfig] = useState<CanvasConfig>(initialCanvasConfig);
  const [trackingMode, setTrackingMode] = useState<string>(initialTrackingMode);
  const [burnSubtitles, setBurnSubtitles] = useState<boolean>(true);
  
  const [originalWords, setOriginalWords] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [pasteInput, setPasteInput] = useState("");

  useEffect(() => {
    let mounted = true;
    apiGetClipWords(jobId, clipIndex).then((res) => {
      if (mounted) {
        const fetched = res.words || [];
        setWords(fetched);
        setOriginalWords(structuredClone(fetched));
        setLoading(false);
      }
    }).catch((err) => {
      console.error(err);
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [jobId, clipIndex]);

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
      const match = cleanStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        cleanStr = match[1].trim();
      }
      
      const parsed = JSON.parse(cleanStr);
      const arr = Array.isArray(parsed) ? parsed : (parsed.words || null);
      
      if (!arr || !Array.isArray(arr) || arr.length === 0 || typeof arr[0].word !== 'string') {
        throw new Error('Invalid JSON format. Expected array of words.');
      }
      
      setWords(arr);
      setPasteInput('');
      alert("Subtitle berhasil diperbarui");
    } catch (e: any) {
      alert('Gagal memproses JSON: ' + e.message);
    }
  };

  const handleWordChange = (idx: number, newText: string) => {
    const newWords = [...words];
    newWords[idx] = { ...newWords[idx], word: newText };
    setWords(newWords);
  };

  const handleReset = () => {
    setWords(structuredClone(originalWords));
  };

  const hasChanges = JSON.stringify(words) !== JSON.stringify(originalWords);

  const handleSaveRerender = async () => {
    setSaving(true);
    try {
      let aspectRatio = "9:16";
      if (outputStyle === "landscape" || (!canvasConfig.enabled && outputStyle === "canvas_blur")) aspectRatio = "16:9";
      if (outputStyle === "square") aspectRatio = "1:1";

      const payload = {
        words,
        aspect_ratio: aspectRatio,
        caption_style: subtitleConfig.style,
        canvas_config: canvasConfig,
        subtitle_config: subtitleConfig,
        tracking_mode: trackingMode,
        burn_subs: burnSubtitles,
      };

      const res = await apiCreateClipRerenderJob(jobId, clipIndex, payload);
      if (res.job_id) {
        onRerenderStart(res.job_id);
      }
    } catch (err: any) {
      alert("Failed to rerender: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-white border border-border rounded-3xl w-full max-w-3xl shadow-2xl relative my-auto animate-fadeIn overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-white">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Edit Subtitles</h2>
            <p className="text-sm text-text-secondary mt-0.5">{clipTitle}</p>
          </div>
          <button onClick={onClose} className="p-2 text-text-tertiary hover:text-text-primary rounded-xl hover:bg-bg-surface transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCcw className="w-6 h-6 text-purple-600 animate-spin" />
            </div>
          ) : (
            <>
              <div className="border border-border rounded-2xl overflow-hidden bg-bg-surface/30">
                <button 
                  onClick={() => setIsAiAssistantOpen(!isAiAssistantOpen)}
                  className="w-full flex items-center justify-between p-4 bg-bg-surface/60 hover:bg-bg-surface transition-colors"
                >
                  <div className="flex items-center gap-2 text-purple-600 font-semibold text-sm">
                    <Wand2 className="w-4 h-4" /> AI Auto Correction
                  </div>
                  <ChevronRight className={`w-4 h-4 text-text-tertiary transition-transform ${isAiAssistantOpen ? 'rotate-90' : ''}`} />
                </button>
                
                {isAiAssistantOpen && (
                  <div className="p-5 border-t border-border space-y-4 bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-text-secondary">1. Generate & Copy Prompt</span>
                          <button onClick={copyToClipboard} className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-700 transition-colors">
                            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {isCopied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <textarea
                          readOnly
                          value={generatePrompt()}
                          className="w-full h-32 bg-bg-surface/50 border border-border rounded-xl p-3 text-xs text-text-primary font-mono resize-none focus:outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-text-secondary">2. Paste AI Result (JSON)</span>
                        </div>
                        <textarea
                          value={pasteInput}
                          onChange={(e) => setPasteInput(e.target.value)}
                          placeholder='[{"word": "Hello", "start": 0.0, "end": 0.5}]'
                          className="w-full h-32 bg-bg-surface/50 border border-border rounded-xl p-3 text-xs text-text-primary font-mono resize-none focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-500/10 focus:outline-none"
                        />
                        <button 
                          onClick={applyManualJSON}
                          disabled={!pasteInput.trim()}
                          className="w-full py-2.5 bg-bg-surface hover:bg-slate-200 border border-border disabled:opacity-50 disabled:cursor-not-allowed text-text-primary text-xs font-semibold rounded-xl transition-colors"
                        >
                          Apply Changes
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-5 border-t border-border">
                <div className="flex justify-between items-center flex-wrap gap-4">
                  <h3 className="font-semibold text-text-primary text-base">Word Grid</h3>
                  <div className="flex items-center gap-3">
                    {hasChanges && (
                      <button
                        onClick={handleReset}
                        className="flex items-center gap-1 text-xs text-text-tertiary hover:text-purple-600 transition-colors"
                        title="Reset changes"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset
                      </button>
                    )}
                    <div className="relative">
                      <Search className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search word..."
                        className="bg-bg-surface/60 border border-border rounded-xl pl-9 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:border-purple-500 focus:bg-white focus:ring-2 focus:ring-purple-500/10 outline-none"
                      />
                    </div>
                    <span className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-1 rounded-lg font-medium">
                      {words.length} words
                    </span>
                  </div>
                </div>

                {words.length === 0 ? (
                  <div className="text-center py-8 text-text-tertiary text-sm">
                    No words found.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {words.map((w, idx) => {
                      const isMatch = search && w.word.toLowerCase().includes(search.toLowerCase());
                      const isChanged = originalWords[idx] && w.word !== originalWords[idx].word;
                      return (
                        <div key={idx} className="flex flex-col gap-1">
                          <span className="text-[10px] text-text-tertiary font-mono">
                            {w.start.toFixed(1)}s - {w.end.toFixed(1)}s
                          </span>
                          <input
                            type="text"
                            value={w.word}
                            onChange={e => handleWordChange(idx, e.target.value)}
                            className={`border rounded-xl px-2.5 py-1.5 text-sm text-text-primary focus:outline-none transition-all ${
                              isMatch ? 'border-purple-500 bg-purple-50 text-purple-900 ring-2 ring-purple-500/20' :
                              isChanged ? 'border-amber-400 bg-amber-50 text-amber-900' :
                              'bg-bg-surface/40 border-border hover:border-slate-300 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Output Style & Rerender */}
              <div className="space-y-4 pt-5 border-t border-border">
                <h3 className="font-semibold text-text-primary text-base">Output Settings</h3>
                <OutputStyleSelector value={outputStyle} onChange={(val) => {
                  setOutputStyle(val);
                  setCanvasConfig(prev => ({ ...prev, enabled: val === "canvas_blur" }));
                }} disabled={saving} />
                
                {/* Tracking Mode Options for Portrait */}
                {["face_crop", "canvas_blur", "square"].includes(outputStyle) && (
                  <div className="pt-2 space-y-2">
                    <label className="text-sm font-semibold text-text-primary">
                      Face Tracking Mode
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setTrackingMode("auto")}
                        disabled={saving}
                        className={`py-3 px-3 rounded-xl border transition-colors flex flex-col items-center gap-1 font-medium ${
                          trackingMode === "auto"
                            ? "border-purple-500 bg-purple-50 text-purple-700 ring-1 ring-purple-500/30"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        } disabled:opacity-50`}
                      >
                        <span className="text-sm">Auto Face Tracking</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrackingMode("center")}
                        disabled={saving}
                        className={`py-3 px-3 rounded-xl border transition-colors flex flex-col items-center gap-1 font-medium ${
                          trackingMode === "center"
                            ? "border-purple-500 bg-purple-50 text-purple-700 ring-1 ring-purple-500/30"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        } disabled:opacity-50`}
                      >
                        <span className="text-sm">Center Crop</span>
                      </button>
                    </div>
                  </div>
                )}
                
                {outputStyle === "canvas_blur" && (
                  <CanvasConfigControls config={canvasConfig} onChange={setCanvasConfig} showModeSwitch={false} />
                )}
                
                {/* Burn Subtitles Toggle */}
                <div className="pt-3 pb-1 flex items-center justify-between border-t border-border mt-3">
                  <label className="text-sm font-semibold text-text-primary">Burn Subtitles</label>
                  <ToggleSwitch
                    checked={burnSubtitles}
                    onChange={setBurnSubtitles}
                    disabled={saving}
                  />
                </div>

                {burnSubtitles && (
                  <SubtitleConfigControls config={subtitleConfig} onChange={setSubtitleConfig} showModeSwitch={true} />
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border bg-bg-surface/30 flex justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="px-5 py-2.5 text-text-secondary hover:text-text-primary hover:bg-bg-surface font-semibold text-sm rounded-xl transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleSaveRerender} 
            disabled={saving || loading}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2"
          >
            {saving && <RefreshCcw className="w-4 h-4 animate-spin" />}
            Save & Rerender
          </button>
        </div>
      </div>
    </div>
  );
};
