import React, { useState, useEffect } from "react";
import { MessageSquareQuote, FileJson, Copy, Check, Share2, Clipboard, Play, Loader2, AlertCircle, ExternalLink, XCircle } from "lucide-react";

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
    try {
      let rawJson = inputJson;
      const match = rawJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        rawJson = match[1];
      }
      const data = JSON.parse(rawJson);
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
        throw new Error("Invalid structure. Expected an array or { highlights: [] }.");
      }
      if (items.length === 0) {
        throw new Error("No highlights found in the JSON.");
      }
      const first = items[0];
      if (typeof first.start_time !== "number" && typeof first.start !== "number") {
        throw new Error("Missing 'start_time' or 'start' in the first highlight.");
      }
      setError(null);
      setParsedCount(items.length);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Invalid JSON syntax");
      }
      setParsedCount(null);
    }
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
    }
  };

  const handleLLMLaunch = (url: string) => {
    navigator.clipboard.writeText(prompt).catch((err) => console.error("Clipboard copy error:", err));
    window.open(url, "_blank");
  };

  const handleFinalSubmit = () => {
    let cleanJson = inputJson;
    const match = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      cleanJson = match[1];
    }
    onSubmitJson(cleanJson);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto py-10" onClick={(e) => { if(e.target === e.currentTarget && !isSubmitting) onClose(); }}>
       <div className="bg-neutral-900 border border-neutral-800 w-full max-w-4xl rounded-2xl flex flex-col my-auto">
          
          <div className="p-6 border-b border-neutral-800">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                   <MessageSquareQuote className="w-5 h-5 text-amber-400" />
                   <h2 className="text-xl font-bold">Review AI Prompt & JSON</h2>
                </div>
                <button onClick={onClose} className="text-neutral-400 hover:text-white"><XCircle className="w-6 h-6" /></button>
             </div>
             
             <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <button onClick={() => handleLLMLaunch("https://gemini.google.com")} className="flex items-center justify-between p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-blue-500/50 hover:bg-neutral-900 transition-colors">
                  <span className="flex items-center gap-2 font-medium text-sm text-neutral-300"><span className="w-2 h-2 rounded-full bg-blue-500"/> Gemini</span>
                  <ExternalLink className="w-4 h-4 text-neutral-500" />
                </button>
                <button onClick={() => handleLLMLaunch("https://chatgpt.com")} className="flex items-center justify-between p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-emerald-500/50 hover:bg-neutral-900 transition-colors">
                  <span className="flex items-center gap-2 font-medium text-sm text-neutral-300"><span className="w-2 h-2 rounded-full bg-emerald-500"/> ChatGPT</span>
                  <ExternalLink className="w-4 h-4 text-neutral-500" />
                </button>
                <button onClick={() => handleLLMLaunch("https://claude.ai")} className="flex items-center justify-between p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-900 transition-colors">
                  <span className="flex items-center gap-2 font-medium text-sm text-neutral-300"><span className="w-2 h-2 rounded-full bg-amber-500"/> Claude</span>
                  <ExternalLink className="w-4 h-4 text-neutral-500" />
                </button>
             </div>

             <div className="relative group rounded-xl bg-neutral-950 border border-neutral-800 p-4">
                <pre className="text-xs text-neutral-300 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">{prompt}</pre>
                <div className="absolute top-3 right-3 flex gap-2">
                   <button onClick={handleCopy} className="p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white transition-colors">
                     {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                   </button>
                   <button onClick={handleShare} className="p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white transition-colors">
                     {shared ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                   </button>
                </div>
             </div>
          </div>

          <div className="p-6">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                   <FileJson className="w-5 h-5 text-amber-400" />
                   <h3 className="font-semibold">Paste JSON Response</h3>
                </div>
                <button onClick={handlePaste} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 text-xs font-medium text-neutral-300 hover:bg-neutral-700">
                  <Clipboard className="w-3.5 h-3.5" /> Paste
                </button>
             </div>
             
             <textarea 
                value={inputJson} 
                onChange={(e) => setInputJson(e.target.value)}
                placeholder="Paste the JSON response from AI here..."
                className={`w-full h-48 bg-neutral-950 font-mono text-sm p-4 rounded-xl border focus:outline-none transition-colors resize-y ${
                  error ? "border-red-500/50 focus:border-red-500" : parsedCount ? "border-emerald-500/50 focus:border-emerald-500" : "border-neutral-800 focus:border-amber-500/50"
                }`}
             />

             {error && (
               <div className="mt-3 p-3 rounded-xl bg-red-950/40 border border-red-900/50 flex items-start gap-2.5">
                 <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                 <span className="text-sm text-red-200">{error}</span>
               </div>
             )}
             
             {parsedCount !== null && (
               <div className="mt-3 p-3 rounded-xl bg-emerald-950/40 border border-emerald-900/50 flex items-start gap-2.5">
                 <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                 <span className="text-sm text-emerald-200">Valid JSON: {parsedCount} highlights detected!</span>
               </div>
             )}
          </div>

          <div className="p-6 border-t border-neutral-800 flex justify-end gap-3 bg-neutral-900/50 rounded-b-2xl">
             <button onClick={onClose} disabled={isSubmitting} className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors">
               Cancel
             </button>
             <button 
                onClick={handleFinalSubmit}
                disabled={isSubmitting || !!error || inputJson.trim() === ""}
                className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold bg-amber-500 text-amber-950 hover:bg-amber-400 disabled:opacity-50 transition-colors"
             >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                Resume Job
             </button>
          </div>
       </div>
    </div>
  );
};
