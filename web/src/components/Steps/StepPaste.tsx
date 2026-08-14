import type React from "react";
import { useState } from "react";
import {
  Code2,
  Play,
  Clipboard,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  HelpCircle,
  FileJson,
  Layers
} from "lucide-react";

export interface StepPasteProps {
  jobId: string;
  isSubmitting?: boolean;
  onSubmit: (jsonPayload: string) => void;
  onBack: () => void;
}

const EXAMPLE_JSON = `[
  {
    "start_time": "00:01:15",
    "end_time": "00:01:45",
    "description": "The key secret to mastering productivity",
    "description_id": "Rahasia utama menguasai produktivitas",
    "description_en": "The key secret to mastering productivity"
  },
  {
    "start_time": "00:03:10",
    "end_time": "00:03:50",
    "description": "Why traditional habit tracking fails",
    "description_id": "Mengapa pelacakan kebiasaan tradisional gagal",
    "description_en": "Why traditional habit tracking fails"
  }
]`;

export const StepPaste: React.FC<StepPasteProps> = ({
  jobId,
  isSubmitting = false,
  onSubmit,
  onBack,
}) => {
  const [inputJson, setInputJson] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [parsedCount, setParsedCount] = useState<number | null>(null);
  const [showExample, setShowExample] = useState<boolean>(false);

  const cleanJsonString = (raw: string): string => {
    let clean = raw.trim();
    const match = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      clean = match[1].trim();
    } else {
      clean = clean.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
    }
    return clean;
  };

  const validateJson = (rawText: string): { valid: boolean; count?: number; errorMsg?: string } => {
    if (!rawText.trim()) {
      return { valid: false };
    }
    try {
      const cleaned = cleanJsonString(rawText);
      const parsed = JSON.parse(cleaned);

      // Support array directly or object containing highlights
      let items: any[] = [];
      if (Array.isArray(parsed)) {
        items = parsed;
      } else if (parsed && typeof parsed === "object") {
        items = parsed.highlights || parsed.clips || parsed.segments || [];
      }

      if (!Array.isArray(items) || items.length === 0) {
        return { valid: false, errorMsg: "JSON must be an array of highlights or contain a 'highlights' list." };
      }

      // Check if items have start_time / start
      const hasValidItems = items.some(
        (item) => (item.start_time || item.start) && (item.end_time || item.end)
      );

      if (!hasValidItems) {
        return {
          valid: false,
          errorMsg: "Items must contain 'start_time' (or 'start') and 'end_time' (or 'end') properties.",
        };
      }

      return { valid: true, count: items.length };
    } catch (e: any) {
      return { valid: false, errorMsg: `Invalid JSON format: ${e.message}` };
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputJson(val);
    if (val.trim()) {
      const res = validateJson(val);
      if (res.valid) {
        setError(null);
        setParsedCount(res.count || 0);
      } else {
        setError(res.errorMsg || "Invalid JSON format");
        setParsedCount(null);
      }
    } else {
      setError(null);
      setParsedCount(null);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputJson(text);
        const res = validateJson(text);
        if (res.valid) {
          setError(null);
          setParsedCount(res.count || 0);
        } else {
          setError(res.errorMsg || "Invalid JSON syntax");
          setParsedCount(null);
        }
      }
    } catch (err) {
      console.warn("Could not read clipboard", err);
    }
  };

  const handleUseExample = () => {
    setInputJson(EXAMPLE_JSON);
    const res = validateJson(EXAMPLE_JSON);
    setError(null);
    setParsedCount(res.count || 2);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = validateJson(inputJson);
    if (!res.valid) {
      setError(res.errorMsg || "Please provide valid JSON before rendering.");
      return;
    }
    onSubmit(cleanJsonString(inputJson));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Step Header */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20 shrink-0 mt-0.5">
            <FileJson className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
              <span>Step 3: Paste AI Highlights Response</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                Job: {jobId.slice(0, 8)}
              </span>
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              Paste the exact JSON reply you received from ChatGPT / Claude / Gemini below.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handlePasteClipboard}
          className="py-2 px-3.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium rounded-xl border border-neutral-700/80 transition-colors flex items-center gap-1.5 shrink-0 self-stretch sm:self-auto justify-center"
        >
          <Clipboard className="w-4 h-4 text-amber-400" />
          <span>Paste from Clipboard</span>
        </button>
      </div>

      {/* JSON Textarea Container */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-neutral-300 font-semibold">
            <Code2 className="w-4 h-4 text-amber-400" />
            <span>AI JSON Payload</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowExample(!showExample)}
              className="text-neutral-400 hover:text-amber-400 transition-colors flex items-center gap-1 text-[11px]"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{showExample ? "Hide Example" : "View Example"}</span>
            </button>
          </div>
        </div>

        {/* Example Modal / Collapsible */}
        {showExample && (
          <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 text-xs animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-neutral-400">Sample expected JSON response:</span>
              <button
                type="button"
                onClick={handleUseExample}
                className="text-[11px] font-semibold text-amber-400 hover:underline"
              >
                Insert Example Data
              </button>
            </div>
            <pre className="p-2.5 bg-neutral-900/90 rounded-lg text-neutral-300 font-mono text-[11px] overflow-x-auto">
              {EXAMPLE_JSON}
            </pre>
          </div>
        )}

        <textarea
          value={inputJson}
          onChange={handleTextChange}
          placeholder="Paste AI response here (e.g. [ { &quot;start_time&quot;: &quot;00:01:15&quot;, &quot;end_time&quot;: &quot;00:01:45&quot;, ... } ])"
          required
          rows={9}
          className={`w-full p-4 bg-neutral-950/90 border rounded-xl text-neutral-100 placeholder:text-neutral-600 font-mono text-xs focus:outline-none focus:ring-2 transition-all leading-relaxed ${
            error
              ? "border-red-500/80 focus:ring-red-500/30"
              : parsedCount !== null
              ? "border-emerald-500/80 focus:ring-emerald-500/30"
              : "border-neutral-800 focus:border-amber-400/80 focus:ring-amber-400/30"
          }`}
        />

        {/* Validation Status Feedback */}
        {error && (
          <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl flex items-start gap-2.5 text-xs text-red-300 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {parsedCount !== null && !error && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex items-center justify-between text-xs text-emerald-300 animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Valid JSON: <strong>{parsedCount} highlights</strong> detected ready for rendering!</span>
            </div>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
        )}
      </div>

      {/* Navigation & Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80 gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Back to Prompt</span>
        </button>

        <button
          type="submit"
          disabled={isSubmitting || !inputJson.trim() || !!error}
          className="py-3 px-6 bg-amber-400 hover:bg-amber-300 active:scale-95 text-neutral-950 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 shadow-xl shadow-amber-400/10 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-neutral-950/30 border-t-neutral-950 rounded-full animate-spin" />
              <span>Starting GPU Render...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-neutral-950" />
              <span>Render Video Clips</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default StepPaste;
