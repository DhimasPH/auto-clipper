import React, { useState, useEffect } from "react";
import { X, Wand2, RefreshCcw } from "lucide-react";
import { apiGetClipWords, apiCorrectSubtitle, apiCreateClipRerenderJob } from "../api";
import { OutputStyleSelector, type OutputStyle } from "./OutputStyleSelector";
import { SubtitlePresetBar } from "./SubtitlePresetBar";
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
  
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [manualJson, setManualJson] = useState("");
  const [isManualEditOpen, setIsManualEditOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiGetClipWords(jobId, clipIndex).then((res) => {
      if (mounted) {
        setWords(res.words || []);
        setManualJson(JSON.stringify(res.words || [], null, 2));
        setLoading(false);
      }
    }).catch((err) => {
      console.error(err);
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [jobId, clipIndex]);

  const handleAiCorrect = async () => {
    setSaving(true);
    try {
      const res = await apiCorrectSubtitle({
        words,
        provider: localStorage.getItem("ai_provider") || "openai",
        api_key: localStorage.getItem("openai_api_key") || "", 
      });
      if (res.words) {
        setWords(res.words);
        setManualJson(JSON.stringify(res.words, null, 2));
        alert("Subtitle successfully corrected via AI!");
      }
    } catch (err: any) {
      alert("AI Correction failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleApplyManual = () => {
    try {
      const parsed = JSON.parse(manualJson);
      if (!Array.isArray(parsed)) throw new Error("JSON must be an array of words.");
      setWords(parsed);
      alert("Manual JSON applied successfully.");
    } catch (err: any) {
      alert("Invalid JSON: " + err.message);
    }
  };

  const handleSaveRerender = async () => {
    setSaving(true);
    try {
      const presetBase = SUBTITLE_PRESETS[subtitlePreset]?.config || {};
      const subtitleConfig: SubtitleConfig = {
        ...DEFAULT_SUBTITLE_CONFIG,
        ...presetBase,
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
              {/* AI Section */}
              <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950">
                <button 
                  onClick={() => setIsAiOpen(!isAiOpen)}
                  className="w-full flex items-center justify-between p-4 bg-neutral-900/50 hover:bg-neutral-800 transition-colors"
                >
                  <div className="flex items-center gap-2 text-amber-400 font-medium">
                    <Wand2 className="w-4 h-4" /> AI Auto Correct
                  </div>
                  <span className="text-xs text-neutral-500">{isAiOpen ? "Hide" : "Expand"}</span>
                </button>
                {isAiOpen && (
                  <div className="p-4 space-y-3 border-t border-neutral-800">
                    <p className="text-xs text-neutral-400">Use AI to fix spelling and punctuation errors.</p>
                    <button
                      onClick={handleAiCorrect}
                      disabled={saving}
                      className="w-full py-2 bg-amber-400/10 text-amber-400 border border-amber-400/20 hover:bg-amber-400/20 rounded-lg font-medium transition-colors"
                    >
                      Run AI Correction
                    </button>
                  </div>
                )}
              </div>

              {/* Manual JSON Section */}
              <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950">
                <button 
                  onClick={() => setIsManualEditOpen(!isManualEditOpen)}
                  className="w-full flex items-center justify-between p-4 bg-neutral-900/50 hover:bg-neutral-800 transition-colors"
                >
                  <div className="flex items-center gap-2 text-neutral-200 font-medium">
                    Manual JSON Edit
                  </div>
                  <span className="text-xs text-neutral-500">{isManualEditOpen ? "Hide" : "Expand"}</span>
                </button>
                {isManualEditOpen && (
                  <div className="p-4 space-y-3 border-t border-neutral-800">
                    <textarea 
                      value={manualJson}
                      onChange={(e) => setManualJson(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-xs font-mono text-neutral-300 focus:outline-none focus:border-amber-400/80 h-64"
                    />
                    <button
                      onClick={handleApplyManual}
                      className="w-full py-2 bg-neutral-800 text-neutral-200 border border-neutral-700 hover:bg-neutral-700 rounded-lg font-medium transition-colors"
                    >
                      Apply Manual Changes
                    </button>
                  </div>
                )}
              </div>

              {/* Output Style & Rerender */}
              <div className="space-y-4 pt-4 border-t border-neutral-800">
                <h3 className="font-medium text-neutral-200">Output Settings</h3>
                <OutputStyleSelector value={outputStyle} onChange={setOutputStyle} disabled={saving} />
                <SubtitlePresetBar value={subtitlePreset} onChange={setSubtitlePreset} disabled={saving} />
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
