import type React from "react";
import { useState } from "react";
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  ArrowRight,
  Bot,
  MessageSquareQuote,
  RotateCcw,
  CheckCircle2,
  Info,
  Loader2
} from "lucide-react";
import type { JobStatus } from "../../types/job";

export interface StepPromptProps {
  prompt: string;
  jobId: string;
  status?: JobStatus;
  progress?: string;
  onNext: () => void;
  onBack?: () => void;
}

export const StepPrompt: React.FC<StepPromptProps> = ({
  prompt,
  jobId,
  status,
  progress,
  onNext,
  onBack,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [shared, setShared] = useState<boolean>(false);

  const hasPrompt = Boolean(prompt && prompt.trim().length > 0);

  const handleCopy = async () => {
    if (!hasPrompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.error("Failed to copy to clipboard", err);
    }
  };

  const handleShare = async () => {
    if (!hasPrompt) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Auto Clipper AI Highlight Prompt",
          text: prompt,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2200);
      } catch (err: any) {
        if (err.name !== "AbortError") {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="space-y-6">
      {/* Step Guide Header */}
      <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-400/20 text-amber-400 shrink-0 mt-0.5">
            <MessageSquareQuote className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
              <span>Step 2: Send Prompt to AI</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300">
                AI-Agnostic
              </span>
            </h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              {hasPrompt
                ? "Share or copy this generated prompt into your favorite AI model (ChatGPT, Gemini, Claude) to extract viral highlights."
                : "Transcribing your video audio on Google Colab GPU to generate the prompt..."}
            </p>
          </div>
        </div>

        {/* Share & Copy Action Group */}
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          {canShare && (
            <button
              type="button"
              disabled={!hasPrompt}
              onClick={handleShare}
              className="flex-1 sm:flex-none py-2 px-3.5 bg-amber-400 hover:bg-amber-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-950 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-amber-400/10"
            >
              {shared ? <Check className="w-4 h-4 stroke-[3]" /> : <Share2 className="w-4 h-4" />}
              <span>{shared ? "Shared!" : "Share Prompt"}</span>
            </button>
          )}

          <button
            type="button"
            disabled={!hasPrompt}
            onClick={handleCopy}
            className={`flex-1 sm:flex-none py-2 px-3.5 border rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
              copied
                ? "bg-emerald-950/60 border-emerald-500 text-emerald-300"
                : "bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-200"
            }`}
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-neutral-400" />
                <span>Copy Prompt</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Quick Launch Buttons for Popular LLMs */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block">
          Quick Launch AI Model:
        </label>
        <div className="grid grid-cols-3 gap-2.5">
          <a
            href="https://gemini.google.com"
            target="_blank"
            rel="noopener noreferrer"
            onClick={hasPrompt ? handleCopy : undefined}
            className={`p-2.5 bg-neutral-900/80 hover:bg-neutral-800/90 border border-neutral-800 hover:border-neutral-700 rounded-xl flex items-center justify-between text-xs text-neutral-200 transition-colors group ${
              !hasPrompt ? "opacity-60 pointer-events-none" : ""
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
              <span className="font-semibold truncate">Google Gemini</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-neutral-500 group-hover:text-neutral-300 shrink-0 ml-1" />
          </a>

          <a
            href="https://chatgpt.com"
            target="_blank"
            rel="noopener noreferrer"
            onClick={hasPrompt ? handleCopy : undefined}
            className={`p-2.5 bg-neutral-900/80 hover:bg-neutral-800/90 border border-neutral-800 hover:border-neutral-700 rounded-xl flex items-center justify-between text-xs text-neutral-200 transition-colors group ${
              !hasPrompt ? "opacity-60 pointer-events-none" : ""
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="font-semibold truncate">ChatGPT</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-neutral-500 group-hover:text-neutral-300 shrink-0 ml-1" />
          </a>

          <a
            href="https://claude.ai"
            target="_blank"
            rel="noopener noreferrer"
            onClick={hasPrompt ? handleCopy : undefined}
            className={`p-2.5 bg-neutral-900/80 hover:bg-neutral-800/90 border border-neutral-800 hover:border-neutral-700 rounded-xl flex items-center justify-between text-xs text-neutral-200 transition-colors group ${
              !hasPrompt ? "opacity-60 pointer-events-none" : ""
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span className="font-semibold truncate">Claude</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-neutral-500 group-hover:text-neutral-300 shrink-0 ml-1" />
          </a>
        </div>
      </div>

      {/* Code / Prompt Display Box or Transcription Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-amber-400" />
            <span className="font-medium text-neutral-300">Generated Prompt & Subtitle Transcript</span>
          </div>
          <span className="font-mono text-[11px] text-neutral-500">
            {hasPrompt ? `${prompt.length} characters • ` : ""}Job {jobId.slice(0, 8)}
          </span>
        </div>

        {hasPrompt ? (
          <div className="relative group animate-fadeIn">
            <pre className="w-full h-64 p-4 bg-neutral-950/90 border border-neutral-800 rounded-xl text-neutral-300 font-mono text-xs overflow-y-auto whitespace-pre-wrap select-all leading-relaxed focus:outline-none">
              {prompt}
            </pre>
            <button
              type="button"
              onClick={handleCopy}
              className="absolute top-3 right-3 p-2 bg-neutral-800/90 hover:bg-neutral-700 border border-neutral-700/80 rounded-lg text-neutral-300 hover:text-white transition-colors opacity-90 shadow-md flex items-center gap-1.5 text-[11px]"
              title="Copy prompt"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        ) : (
          <div className="w-full h-64 p-6 bg-neutral-950/90 border border-neutral-800 rounded-xl flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-3 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-neutral-200">
                {status === "DOWNLOADING" ? "Downloading video on Colab..." : "Transcribing speech..."}
              </h4>
              <p className="text-xs text-neutral-400 max-w-sm">
                {progress || "Whisper VAD is analyzing timestamps and preparing your AI prompt."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Info Tip */}
      <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-xl flex items-start gap-2.5 text-xs text-neutral-400">
        <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <p>
          Once you ask the AI, it will return a JSON array containing timestamps and highlight descriptions. Copy that JSON and proceed to the next step.
        </p>
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80 gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="py-2.5 px-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Edit Input</span>
          </button>
        ) : <div />}

        <button
          type="button"
          disabled={!hasPrompt}
          onClick={onNext}
          className="py-3 px-5 bg-amber-400 hover:bg-amber-300 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed text-neutral-950 font-bold text-xs sm:text-sm rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-amber-400/10"
        >
          <span>Next: Paste AI Response</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default StepPrompt;
