# Auto Clipper Cloud Dashboard Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the current 4-step wizard UI in `web/src/` into a single-page dashboard with a Hero Input form and a unified History/Job list using Modals for manual interactions, ensuring 100% feature parity.

**Architecture:** We will break the linear wizard down by migrating its individual steps into independent components. `StepInput` becomes `HeroInput`. `StepPrompt` and `StepPaste` merge into `PromptJsonModal`. `StepResult` and the current `HistoryList` rendering logic merge into `ResultsModal` and `JobCard`. `App.tsx` will be simplified to render just the `HeroInput` and `HistoryList` vertically. 

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS, Lucide React. (Note: No automated testing framework is present in `web/`, so testing relies on TypeScript checks and Vite build).

---

### Task 1: Create HeroInput Component (Migrate Step 1)

**Files:**
- Create: `web/src/components/Dashboard/HeroInput.tsx`

- [ ] **Step 1: Copy StepInput to HeroInput**
```bash
mkdir -p web/src/components/Dashboard
cp web/src/components/Steps/StepInput.tsx web/src/components/Dashboard/HeroInput.tsx
```

- [ ] **Step 2: Rename component in HeroInput.tsx**
Modify `web/src/components/Dashboard/HeroInput.tsx`. Find `export const StepInput : React.FC` and change it to `export const HeroInput : React.FC`. Remove the outer styling classes that make it look like a wizard step, replacing `<div className="space-y-6">` with `<div className="w-full bg-neutral-900/80 border border-neutral-800/90 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-md space-y-6">` at the root return to give it a hero card look.

- [ ] **Step 3: Run TypeScript check**
Run: `cd web && npm run build` 
Expected: Build passes.

- [ ] **Step 4: Commit**
Check `.agent/config.yml` for `auto_commit` setting.
If `auto_commit: true` (default when absent):
```bash
git add web/src/components/Dashboard/HeroInput.tsx
git commit -m "feat(web): scaffold HeroInput component from StepInput"
```

---

### Task 2: Create PromptJsonModal (Migrate Steps 2 & 3)

**Files:**
- Create: `web/src/components/Dashboard/PromptJsonModal.tsx`

- [ ] **Step 1: Create PromptJsonModal.tsx**
Create the new file `web/src/components/Dashboard/PromptJsonModal.tsx` that combines the prompt display and JSON paste functionality into a modal overlay.

```tsx
import React, { useState, useEffect } from "react";
import { MessageSquareQuote, FileJson, Copy, Check, Share2, Clipboard, RotateCcw, Play, Loader2, Info, AlertCircle, Layers, HelpCircle, Code2, ExternalLink } from "lucide-react";

export const PromptJsonModal: React.FC<{
  jobId: string;
  prompt: string;
  status: string;
  progress: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmitJson: (json: string) => Promise<void>;
  isSubmitting: boolean;
}> = ({ jobId, prompt, status, progress, isOpen, onClose, onSubmitJson, isSubmitting }) => {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [inputJson, setInputJson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [parsedCount, setParsedCount] = useState<number | null>(null);
  const [showExample, setShowExample] = useState(false);

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
      let items = [];
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
    } catch (err: any) {
      setError(err.message || "Invalid JSON syntax");
      setParsedCount(null);
    }
  }, [inputJson]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (err) {}
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
      } catch (err) {}
    }
  };
  
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInputJson(text);
    } catch (err) {}
  };

  const handleLLMLaunch = (url: string) => {
    navigator.clipboard.writeText(prompt).catch(() => {});
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto py-10">
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
                     <Share2 className="w-4 h-4" />
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
```

- [ ] **Step 2: Run TypeScript check**
Run: `cd web && npm run build`
Expected: Build passes.

- [ ] **Step 3: Commit**
```bash
git add web/src/components/Dashboard/PromptJsonModal.tsx
git commit -m "feat(web): create PromptJsonModal combining StepPrompt and StepPaste"
```

---

### Task 3: Create ResultsModal (Migrate Step 4 / HistoryList clips grid)

**Files:**
- Create: `web/src/components/Dashboard/ResultsModal.tsx`

- [ ] **Step 1: Create ResultsModal.tsx**
```tsx
import React, { useState } from "react";
import { CheckCircle2, Clock, Download, Share2, ExternalLink, Pencil, XCircle } from "lucide-react";
import { API_URL } from "../../api";

export const ResultsModal: React.FC<{
  job: any;
  isOpen: boolean;
  onClose: () => void;
  onEditClip: (jobId: string, index: number, title: string, jobObj: any) => void;
}> = ({ job, isOpen, onClose, onEditClip }) => {
  const [downloadingIndex, setDownloadingIndex] = useState<string | null>(null);

  if (!isOpen || !job || !job.clips) return null;

  const handleDownload = async (clip: any, index: number) => {
    try {
      const dlId = `${job.id}-${index}`;
      setDownloadingIndex(dlId);
      const videoUrl = `${API_URL}/video?path=${encodeURIComponent(clip.path)}&v=${clip.v || 0}`;
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error("Failed");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      const cleanName = (clip.description || `clip_${index + 1}`).slice(0, 30).replace(/[^a-zA-Z0-9_-]/g, "_");
      link.download = `${cleanName}_${job.id.slice(0, 6)}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.open(`${API_URL}/video?path=${encodeURIComponent(clip.path)}&v=${clip.v || 0}`, "_blank");
    } finally {
      setDownloadingIndex(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto py-10">
       <div className="bg-neutral-900 border border-neutral-800 w-full max-w-6xl rounded-2xl flex flex-col my-auto">
          <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
             <div className="flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                <h2 className="text-xl font-bold">Render Complete ({job.clips.length} Clips)</h2>
             </div>
             <button onClick={onClose} className="text-neutral-400 hover:text-white"><XCircle className="w-6 h-6" /></button>
          </div>
          
          <div className="p-6 overflow-y-auto max-h-[75vh]">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {job.clips.map((clip: any, i: number) => (
                <div key={i} className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl bg-neutral-950 border border-neutral-800">
                  <div className="w-full sm:w-40 shrink-0 aspect-[9/16] bg-black rounded-xl overflow-hidden relative">
                    <video src={`${API_URL}/video?path=${encodeURIComponent(clip.path)}&v=${clip.v || 0}`} controls playsInline preload="metadata" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 text-xs font-bold font-mono">Clip #{(i+1).toString().padStart(2, '0')}</span>
                    </div>
                    <h3 className="font-semibold text-neutral-100 text-sm mb-3 line-clamp-2">{clip.description || clip.title || `Highlight ${i+1}`}</h3>
                    <div className="mt-auto flex flex-wrap gap-2">
                      <button onClick={() => onEditClip(job.id, i, clip.description || `Clip ${i+1}`, job)} className="flex-1 flex items-center justify-center gap-1.5 p-2 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-xs font-bold transition-colors">
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button onClick={() => handleDownload(clip, i)} className="flex-1 flex items-center justify-center gap-1.5 p-2 rounded-xl bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-xs font-bold transition-colors">
                        <Download className="w-3.5 h-3.5" /> {downloadingIndex === `${job.id}-${i}` ? '...' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
       </div>
    </div>
  );
};
```

- [ ] **Step 2: Run TypeScript check**
Run: `cd web && npm run build`
Expected: Build passes.

- [ ] **Step 3: Commit**
```bash
git add web/src/components/Dashboard/ResultsModal.tsx
git commit -m "feat(web): create ResultsModal component"
```

---

### Task 4: Refactor App.tsx for Unified Layout

**Files:**
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Simplify App.tsx**
Update `App.tsx` to remove the wizard steps and simply render `HeroInput` followed by `HistoryList`.

```tsx
import { useState, useEffect } from "react";
import { Video, Sparkles, LogOut, Cpu } from "lucide-react";
import { AuthGate } from "./components/AuthGate";
import { HistoryList } from "./components/HistoryList";
import { HeroInput } from "./components/Dashboard/HeroInput";
import { useJobPolling } from "./hooks/useJobPolling";
import { clearAuthToken, apiCheckHealth } from "./api";

function MainDashboard() {
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  
  const { isLoading, createAndStartJob, activeJob, startPolling } = useJobPolling();

  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      const isOk = await apiCheckHealth();
      if (isMounted) setBackendOnline(isOk);
    };
    check();
    const interval = setInterval(check, 15000);
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) clearAuthToken();
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 antialiased py-6 sm:py-10 px-4 sm:px-6 lg:px-8 selection:bg-amber-400 selection:text-neutral-950">
      <div className="fixed inset-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-40">
        <div className="w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[140px] -translate-y-48" />
        <div className="w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-[140px] translate-y-64" />
      </div>

      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 relative z-10">
        <header className="flex items-center justify-between border-b border-neutral-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-amber-400 shadow-inner">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-neutral-100">Auto Clipper <span className="text-amber-400 font-medium">Cloud</span></h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-800 text-amber-400 border border-amber-400/20">
                  <Sparkles className="w-2.5 h-2.5" /> Mobile Web
                </span>
                {backendOnline !== null && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${backendOnline ? "bg-emerald-950/60 border-emerald-800/60 text-emerald-400" : "bg-red-950/60 border-red-800/60 text-red-400"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${backendOnline ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
                    {backendOnline ? "Colab Online" : "Colab Offline"}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">Automated short-form video generation on Google Colab GPU</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={handleLogout} className="p-2 rounded-xl text-neutral-400 hover:text-neutral-200 bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800 transition-colors" title="Log out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <HeroInput onSubmit={createAndStartJob} isLoading={isLoading} />

        <div className="mt-8">
           <h2 className="text-lg font-bold mb-4">Job History</h2>
           <HistoryList onResume={startPolling} activePolledJob={activeJob} />
        </div>

        <footer className="pt-2 text-center text-xs text-neutral-500 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-neutral-800/60 pb-6">
          <div className="flex items-center gap-2"><Cpu className="w-3.5 h-3.5 text-amber-400/80" /><span>Colab GPU Acceleration • faster-whisper & FFmpeg</span></div>
          <div className="flex items-center gap-3 text-[11px]"><span>Auto Clipper v1.0 Cloud</span><span>•</span><span>Zero Local GPU Required</span></div>
        </footer>
      </div>
    </div>
  );
}

export default function App() {
  return <AuthGate><MainDashboard /></AuthGate>;
}
```

- [ ] **Step 2: Run TypeScript check**
Run: `cd web && npm run build`
Expected: Build passes.

- [ ] **Step 3: Commit**
```bash
git add web/src/App.tsx
git commit -m "refactor(web): implement unified dashboard layout in App.tsx"
```

---

### Task 5: Integrate Modals into HistoryList

**Files:**
- Modify: `web/src/components/HistoryList.tsx`

- [ ] **Step 1: Integrate PromptJsonModal and ResultsModal**
In `HistoryList.tsx`, import `PromptJsonModal` and `ResultsModal`. Add state to track which job is currently being reviewed for prompt/JSON and which is being viewed for results. Render the Modals at the bottom of the component.
*(Note: Full file replacement is large, so use the provided code to add the state hooks and component rendering).*

```tsx
// At the top of HistoryList.tsx, add imports:
import { PromptJsonModal } from "./Dashboard/PromptJsonModal";
import { ResultsModal } from "./Dashboard/ResultsModal";
import { apiResumeManualJob } from "../api";

// Inside HistoryList component, add state:
const [promptModalJob, setPromptModalJob] = useState<any>(null);
const [resultsModalJob, setResultsModalJob] = useState<any>(null);
const [isSubmittingJson, setIsSubmittingJson] = useState(false);

// Add handlers:
const handleOpenPromptModal = (job: any) => setPromptModalJob(job);
const handleClosePromptModal = () => setPromptModalJob(null);

const handleOpenResultsModal = (job: any) => setResultsModalJob(job);
const handleCloseResultsModal = () => setResultsModalJob(null);

const handleSubmitJson = async (json: string) => {
  if (!promptModalJob) return;
  setIsSubmittingJson(true);
  try {
    await apiResumeManualJob(promptModalJob.id, json);
    onResume(promptModalJob.id); // Trigger polling via useJobPolling
    setPromptModalJob(null);
    fetchHistory();
  } catch (err: any) {
    alert(err.message || "Failed to submit JSON");
  } finally {
    setIsSubmittingJson(false);
  }
};

// Modify the AWAITING_MANUAL and DONE rendering in the job list to trigger these modals:
// Find `<Clock className="w-5 h-5 text-amber-400" />` and replace the button with:
// <button onClick={() => handleOpenPromptModal(job)} className="... border-amber-500 ...">Action Required: Review AI Prompt & JSON</button>

// At the bottom of the return statement, before ClipEditModal, add:
<PromptJsonModal 
  jobId={promptModalJob?.id || ""}
  prompt={promptModalJob?.metadata?.manual_prompt || ""}
  status={promptModalJob?.status || ""}
  progress={promptModalJob?.progress || ""}
  isOpen={!!promptModalJob}
  onClose={handleClosePromptModal}
  onSubmitJson={handleSubmitJson}
  isSubmitting={isSubmittingJson}
/>

<ResultsModal
  job={resultsModalJob}
  isOpen={!!resultsModalJob}
  onClose={handleCloseResultsModal}
  onEditClip={(jobId, index, title, job) => setEditingClip({ jobId, index, title, job })}
/>
```

- [ ] **Step 2: Run TypeScript check**
Run: `cd web && npm run build`
Expected: Build passes.

- [ ] **Step 3: Commit**
```bash
git add web/src/components/HistoryList.tsx
git commit -m "feat(web): integrate PromptJsonModal and ResultsModal into HistoryList"
```

---

### Task 6: Cleanup Deprecated Files

**Files:**
- Delete: `web/src/components/Steps/StepInput.tsx`
- Delete: `web/src/components/Steps/StepPrompt.tsx`
- Delete: `web/src/components/Steps/StepPaste.tsx`
- Delete: `web/src/components/Steps/StepResult.tsx`

- [ ] **Step 1: Delete old Step files**
```bash
git rm web/src/components/Steps/StepInput.tsx
git rm web/src/components/Steps/StepPrompt.tsx
git rm web/src/components/Steps/StepPaste.tsx
git rm web/src/components/Steps/StepResult.tsx
```

- [ ] **Step 2: Run final build verification**
Run: `cd web && npm run build`
Expected: Build passes successfully.

- [ ] **Step 3: Commit**
```bash
git commit -m "chore(web): remove deprecated wizard step components"
```
