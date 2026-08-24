import React, { useState, useEffect } from "react";
import { X, Wand2, RefreshCcw, Search, RotateCcw, Copy, Check, ChevronRight } from "lucide-react";
import { apiGetClipWords, apiCreateClipRerenderJob } from "../api";
import { OutputStyleSelector, type OutputStyle } from "./OutputStyleSelector";
import { SubtitlePresetBar } from "./SubtitlePresetBar";
import { FontSelector } from "./FontSelector";
import { SUBTITLE_PRESETS, DEFAULT_SUBTITLE_CONFIG, type SubtitlePresetKey, type SubtitleConfig } from "../types/subtitle";
import { DEFAULT_CANVAS_CONFIG } from "../types/canvas";

interface ClipEditModalProps {
  jobId: string;
  clipIndex: number;
  clipTitle: string;
  initialOutputStyle?: OutputStyle;
  initialSubtitlePreset?: SubtitlePresetKey;
  onClose: () => void;
  onRerenderStart: (newJobId: string) => void;
}

export const ClipEditModal: React.FC<ClipEditModalProps> = ({
  jobId,
  clipIndex,
  clipTitle,
  initialOutputStyle = "face_crop",
  initialSubtitlePreset = "viral_pop",
  onClose,
  onRerenderStart,
}) => {
  const [words, setWords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [outputStyle, setOutputStyle] = useState<OutputStyle>(initialOutputStyle);
  const [subtitlePreset, setSubtitlePreset] = useState<SubtitlePresetKey>(initialSubtitlePreset);
  const [customFont, setCustomFont] = useState<string>("");
  
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
      const presetBase = SUBTITLE_PRESETS[subtitlePreset]?.config || {};
      const finalFont = customFont || presetBase.font_family || "Arial";
      
      const subtitleConfig: SubtitleConfig = {
        ...DEFAULT_SUBTITLE_CONFIG,
        ...presetBase,
        font_family: finalFont,
      };

      let aspectRatio = "9:16";
      if (outputStyle === "landscape") aspectRatio = "16:9";
      if (outputStyle === "square") aspectRatio = "1:1";

      const payload = {
        words,
        aspect_ratio: aspectRatio,
        caption_style: subtitlePreset === "podcast" ? "karaoke" : subtitlePreset === "viral_pop" ? "single_word" : "standard",
        canvas_config: { ...DEFAULT_CANVAS_CONFIG, enabled: outputStyle === "canvas_blur" },
        subtitle_config: subtitleConfig,
        burn_subs: true,
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl shadow-2xl relative my-auto animate-fadeIn overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
          <div>
            <h2 className="text-xl font-semibold text-neutral-100">Edit Subtitles</h2>
            <p className="text-sm text-neutral-400 mt-1">{clipTitle}</p>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-400 hover:text-neutral-100 rounded-lg hover:bg-neutral-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCcw className="w-6 h-6 text-amber-400 animate-spin" />
            </div>
          ) : (
            <>
              <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950">
                <button 
                  onClick={() => setIsAiAssistantOpen(!isAiAssistantOpen)}
                  className="w-full flex items-center justify-between p-4 bg-neutral-900/50 hover:bg-neutral-800 transition-colors"
                >
                  <div className="flex items-center gap-2 text-amber-400 font-medium">
                    <Wand2 className="w-4 h-4" /> AI Auto Correction
                  </div>
                  <ChevronRight className={`w-4 h-4 text-neutral-500 transition-transform ${isAiAssistantOpen ? 'rotate-90' : ''}`} />
                </button>
                
                {isAiAssistantOpen && (
                  <div className="p-4 border-t border-neutral-800 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400">1. Generate & Copy Prompt</span>
                          <button onClick={copyToClipboard} className="flex items-center gap-1.5 text-xs text-amber-400 hover:opacity-80 transition-opacity">
                            {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            {isCopied ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <textarea
                          readOnly
                          value={generatePrompt()}
                          className="w-full h-32 bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-300 font-mono resize-none focus:outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400">2. Paste AI Result (JSON)</span>
                        </div>
                        <textarea
                          value={pasteInput}
                          onChange={(e) => setPasteInput(e.target.value)}
                          placeholder='[{"word": "Hello", "start": 0.0, "end": 0.5}]'
                          className="w-full h-32 bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs text-neutral-300 font-mono resize-none focus:border-amber-400/80 focus:outline-none"
                        />
                        <button 
                          onClick={applyManualJSON}
                          disabled={!pasteInput.trim()}
                          className="w-full py-2 bg-neutral-800 border border-neutral-700 hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-200 text-xs font-medium rounded-lg transition-colors"
                        >
                          Apply Changes
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-neutral-800">
                <div className="flex justify-between items-center flex-wrap gap-4">
                  <h3 className="font-medium text-neutral-200">Word Grid</h3>
                  <div className="flex items-center gap-3">
                    {hasChanges && (
                      <button
                        onClick={handleReset}
                        className="flex items-center gap-1 text-xs text-neutral-400 hover:text-amber-400 transition-colors"
                        title="Reset changes"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset
                      </button>
                    )}
                    <div className="relative">
                      <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search word..."
                        className="bg-neutral-900 border border-neutral-800 rounded-md pl-9 pr-3 py-1.5 text-sm text-neutral-200 focus:border-amber-400/80 outline-none"
                      />
                    </div>
                    <span className="text-xs bg-amber-400/10 text-amber-400 px-2 py-1 rounded-md">
                      {words.length} words
                    </span>
                  </div>
                </div>

                {words.length === 0 ? (
                  <div className="text-center py-8 text-neutral-500 text-sm">
                    No words found.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    {words.map((w, idx) => {
                      const isMatch = search && w.word.toLowerCase().includes(search.toLowerCase());
                      const isChanged = originalWords[idx] && w.word !== originalWords[idx].word;
                      return (
                        <div key={idx} className="flex flex-col gap-1">
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {w.start.toFixed(1)}s - {w.end.toFixed(1)}s
                          </span>
                          <input
                            type="text"
                            value={w.word}
                            onChange={e => handleWordChange(idx, e.target.value)}
                            className={`bg-neutral-900 border rounded-md px-2 py-1.5 text-sm text-neutral-200 focus:outline-none ${
                              isMatch ? 'border-amber-400 bg-amber-400/10' :
                              isChanged ? 'border-yellow-500/50 bg-yellow-500/5' :
                              'border-neutral-800 focus:border-amber-400/80'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Output Style & Rerender */}
              <div className="space-y-4 pt-4 border-t border-neutral-800">
                <h3 className="font-medium text-neutral-200">Output Settings</h3>
                <OutputStyleSelector value={outputStyle} onChange={setOutputStyle} disabled={saving} />
                <SubtitlePresetBar value={subtitlePreset} onChange={setSubtitlePreset} disabled={saving} />
                <FontSelector value={customFont} onChange={setCustomFont} />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-neutral-800 bg-neutral-950 flex justify-end gap-3">
          <button onClick={onClose} disabled={saving} className="px-5 py-2 text-neutral-400 hover:text-neutral-200 font-medium">
            Cancel
          </button>
          <button 
            onClick={handleSaveRerender} 
            disabled={saving || loading}
            className="px-6 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-900 font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {saving && <RefreshCcw className="w-4 h-4 animate-spin" />}
            Save & Rerender
          </button>
        </div>
      </div>
    </div>
  );
};
