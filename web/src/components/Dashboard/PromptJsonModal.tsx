import React, { useState, useEffect } from "react";
import { MessageSquareQuote, FileJson, Copy, Check, Share2, Clipboard, Play, Loader2, AlertCircle, ExternalLink, XCircle } from "lucide-react";

export const parseAndValidateClips = (rawJson: string): { count?: number; error?: string; cleanJson: string } => {
  if (rawJson.trim() === "") {
    return { cleanJson: "" };
  }

  let cleanJson = rawJson;
  const match = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (match && match[1]) {
    cleanJson = match[1];
  }

  try {
    const data = JSON.parse(cleanJson);
    if (!data || typeof data !== 'object') {
      return { error: "Invalid structure. Expected an array or object containing highlights.", cleanJson };
    }
    let items: any[] = [];
    if (Array.isArray(data)) {
      items = data;
    } else if (data.highlights && Array.isArray(data.highlights)) {
      items = data.highlights;
    } else if (data.clips && Array.isArray(data.clips)) {
      items = data.clips;
    } else if (data.segments && Array.isArray(data.segments)) {
      items = data.segments;
    } else {
      return { error: "Invalid structure. Expected an array or { highlights: [] }.", cleanJson };
    }
    
    if (items.length === 0) {
      return { error: "No highlights found in the JSON.", cleanJson };
    }
    
    const first = items[0];
    const hasStart = first && (first.start_time != null || first.start != null);
    if (!hasStart) {
      return { error: "Missing 'start_time' or 'start' in the first highlight.", cleanJson };
    }
    
    return { count: items.length, cleanJson };
  } catch (err: unknown) {
    if (err instanceof Error) {
      return { error: err.message, cleanJson };
    } else {
      return { error: "Invalid JSON syntax", cleanJson };
    }
  }
};

export const PromptJsonModal: React.FC<{
  prompt: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmitJson: (json: string) => Promise<void>;
  isSubmitting: boolean;
}> = ({ prompt, isOpen, onClose, onSubmitJson, isSubmitting }) => {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [inputJson, setInputJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [parsedCount, setParsedCount] = useState<number | null>(null);

  useEffect(() => {
    if (inputJson.trim() === "") {
      setError(null);
      setParsedCount(null);
      return;
    }
    const result = parseAndValidateClips(inputJson);
    setError(result.error || null);
    setParsedCount(result.count || null);
  }, [inputJson]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      console.error("Clipboard copy error:", err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Auto Clipper AI Prompt",
          text: prompt,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2200);
      } catch (err) {
        console.error("Share error:", err);
      }
    }
  };
  
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInputJson(text);
    } catch (err) {
      console.error("Clipboard paste error:", err);
      setError("Failed to read from clipboard");
    }
  };

  const handleLLMLaunch = (url: string) => {
    navigator.clipboard.writeText(prompt).catch((err) => console.error("Clipboard copy error:", err));
    window.open(url, "_blank");
  };

  const handleFinalSubmit = () => {
    const result = parseAndValidateClips(inputJson);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSubmitJson(result.cleanJson);
  };

  // Close modal on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, isSubmitting]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 py-10" onClick={(e) => { if(e.target === e.currentTarget && !isSubmitting) onClose(); }}>
        <div className="bg-white border border-border w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
          
          <div className="p-6 border-b border-border bg-white">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                   <MessageSquareQuote className="w-5 h-5 text-purple-600" />
                   <h2 className="text-xl font-bold text-text-primary">Review AI Prompt & JSON</h2>
                </div>
                <button onClick={() => !isSubmitting && onClose()} disabled={isSubmitting} className="text-text-tertiary hover:text-text-primary transition-colors disabled:opacity-50"><XCircle className="w-6 h-6" /></button>
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <button onClick={() => handleLLMLaunch("https://gemini.google.com")} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-border hover:border-blue-500/50 hover:bg-blue-50/50 transition-colors">
                  <span className="flex items-center gap-2 font-medium text-sm text-text-primary"><span className="w-2 h-2 rounded-full bg-blue-500"/> Gemini</span>
                  <ExternalLink className="w-4 h-4 text-text-tertiary" />
                </button>
                <button onClick={() => handleLLMLaunch("https://chatgpt.com")} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-border hover:border-emerald-500/50 hover:bg-emerald-50/50 transition-colors">
                  <span className="flex items-center gap-2 font-medium text-sm text-text-primary"><span className="w-2 h-2 rounded-full bg-emerald-500"/> ChatGPT</span>
                  <ExternalLink className="w-4 h-4 text-text-tertiary" />
                </button>
                <button onClick={() => handleLLMLaunch("https://claude.ai")} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-border hover:border-amber-500/50 hover:bg-amber-50/50 transition-colors">
                  <span className="flex items-center gap-2 font-medium text-sm text-text-primary"><span className="w-2 h-2 rounded-full bg-amber-500"/> Claude</span>
                  <ExternalLink className="w-4 h-4 text-text-tertiary" />
                </button>
             </div>

             <div className="relative group rounded-2xl bg-slate-50 border border-border p-4">
                <pre className="text-xs text-text-secondary font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">{prompt}</pre>
                <div className="absolute top-3 right-3 flex gap-2">
                   <button onClick={handleCopy} className="p-2 rounded-lg bg-white border border-border text-text-secondary hover:text-text-primary shadow-sm transition-colors" title="Copy Prompt">
                     {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                   </button>
                   {typeof navigator !== "undefined" && !!navigator.share && (
                     <button onClick={handleShare} className="p-2 rounded-lg bg-white border border-border text-text-secondary hover:text-text-primary shadow-sm transition-colors" title="Share">
                       {shared ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
                     </button>
                   )}
                </div>
             </div>
          </div>

          <div className="p-6 bg-white">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                   <FileJson className="w-5 h-5 text-purple-600" />
                   <h3 className="font-semibold text-text-primary">Paste JSON Response</h3>
                </div>
                <button onClick={handlePaste} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 border border-border text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-slate-200 transition-colors">
                  <Clipboard className="w-3.5 h-3.5" /> Paste
                </button>
             </div>
             
             <textarea 
                value={inputJson} 
                onChange={(e) => setInputJson(e.target.value)}
                placeholder="Paste the JSON response from AI here..."
                className={`w-full h-48 bg-slate-50 font-mono text-sm p-4 rounded-2xl border focus:outline-none focus:bg-white transition-all resize-y text-text-primary ${
                  error ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20" : parsedCount ? "border-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" : "border-border focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                }`}
             />

             {error && (
               <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5">
                 <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                 <span className="text-sm text-red-600">{error}</span>
               </div>
             )}
             
             {parsedCount !== null && (
               <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5">
                 <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                 <span className="text-sm text-emerald-700 font-medium">Valid JSON: {parsedCount} highlights detected!</span>
               </div>
             )}
          </div>

          <div className="p-6 border-t border-border flex justify-end gap-3 bg-slate-50/70 rounded-b-3xl">
             <button onClick={onClose} disabled={isSubmitting} className="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-slate-200 transition-colors">
               Cancel
             </button>
             <button 
                onClick={handleFinalSubmit}
                disabled={isSubmitting || !!error || inputJson.trim() === ""}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white shadow-md shadow-purple-500/25 disabled:opacity-50 transition-all"
             >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                Resume Job
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};
