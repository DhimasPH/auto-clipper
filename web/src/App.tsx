import { useState, useEffect } from "react";
import {
  Video,
  Sparkles,
  LogOut,
  RotateCcw,
  Cpu,
  History,
  AlertCircle,
} from "lucide-react";
import { AuthGate } from "./components/AuthGate";
import { HistoryList } from "./components/HistoryList";
import { HeroInput } from "./components/Dashboard/HeroInput";
import { PromptJsonModal } from "./components/Dashboard/PromptJsonModal";
import { ResultsModal } from "./components/Dashboard/ResultsModal";
import { useJobPolling } from "./hooks/useJobPolling";
import { clearAuthToken, apiCheckHealth } from "./api";
import type { CreateJobPayload, JobResponse } from "./types/job";

function MainWizard() {
  const [currentView, setCurrentView] = useState<"wizard" | "history">("wizard");
  const [resetKey, setResetKey] = useState(0);

  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);

  const [activePrompt, setActivePrompt] = useState<string>("");
  const [activeHistoryJob, setActiveHistoryJob] = useState<JobResponse | null>(null);
  const [shownResultsForJobId, setShownResultsForJobId] = useState<string | null>(null);

  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const {
    jobId,
    status,
    progress,
    prompt,
    clips,
    error,
    isLoading,
    isPolling,
    activeJob,
    createAndStartJob,
    resumeJobWithJson,
    cancelCurrentJob,
    resetJob,
    stopPolling,
    startPolling,
  } = useJobPolling();

  // Periodic health check
  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      const isOk = await apiCheckHealth();
      if (isMounted) setBackendOnline(isOk);
    };
    check();
    const interval = setInterval(check, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Automatic modal synchronization based on background job status
  useEffect(() => {
    if (jobId) {
      if (status === "AWAITING_MANUAL" && prompt) {
        setIsPromptModalOpen(true);
      } else if (
        status === "DONE" && clips && clips.length > 0 && shownResultsForJobId !== jobId
      ) {
        setIsResultsModalOpen(true);
        setShownResultsForJobId(jobId);
      }
    }
  }, [status, jobId, prompt, clips, shownResultsForJobId]);

  const handleHeroSubmit = async (payload: CreateJobPayload) => {
    try {
      await createAndStartJob(payload);
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleJsonSubmit = async (jsonPayload: string) => {
    try {
      await resumeJobWithJson(jsonPayload);
      setIsPromptModalOpen(false);
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleResetToNewJob = () => {
    setCurrentView("wizard");
    resetJob();
    setResetKey((prev) => prev + 1);
    setIsPromptModalOpen(false);
    setIsResultsModalOpen(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem("ac_draft_hero_input");
      setTimeout(() => localStorage.removeItem("ac_draft_hero_input"), 10);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out and clear your access token?")) {
      clearAuthToken();
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 antialiased py-6 sm:py-10 px-4 sm:px-6 lg:px-8 selection:bg-amber-400 selection:text-neutral-950">
      {/* Subtle Ambient Gradient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden flex items-center justify-center opacity-40">
        <div className="w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[140px] -translate-y-48" />
        <div className="w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-[140px] translate-y-64" />
      </div>

      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 relative z-10">
        {/* Top Header */}
        <header className="flex items-center justify-between border-b border-neutral-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-amber-400 shadow-inner">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight text-neutral-100">
                  Auto Clipper <span className="text-amber-400 font-medium">Cloud</span>
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-800 text-amber-400 border border-amber-400/20">
                  <Sparkles className="w-2.5 h-2.5" />
                  Mobile Web
                </span>
                {backendOnline !== null && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      backendOnline
                        ? "bg-emerald-950/60 border-emerald-800/60 text-emerald-400"
                        : "bg-red-950/60 border-red-800/60 text-red-400"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        backendOnline ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                      }`}
                    />
                    {backendOnline ? "Colab Online" : "Colab Offline"}
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Automated short-form video generation on Google Colab GPU
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetToNewJob}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
              title="Start a new clip project"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>New Job</span>
            </button>
            
            <button
              type="button"
              onClick={() => {
                setCurrentView("history");
                stopPolling();
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800 transition-colors"
              title="View History"
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-xl text-neutral-400 hover:text-neutral-200 bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800 transition-colors"
              title="Log out / Change Token"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {currentView === "history" ? (
          <main className="bg-neutral-900/80 border border-neutral-800/90 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
            <HistoryList
              onResume={(id) => {
                setCurrentView("wizard");
                startPolling(id);
              }}
              onResumeManual={(id, manualPrompt) => {
                setCurrentView("wizard");
                stopPolling();
                startPolling(id); // Ensure the hook knows about this job
                setActivePrompt(manualPrompt);
                setIsPromptModalOpen(true);
              }}
              onViewResults={(job) => {
                setActiveHistoryJob(job);
                setIsResultsModalOpen(true);
              }}
            />
          </main>
        ) : (
          <main>
            <HeroInput
              key={resetKey}
              initialUrl={activeJob?.metadata?.source_video}
              isSubmitting={isLoading || isPolling}
              onSubmit={handleHeroSubmit}
            />

            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-950/40 border border-red-900/50 flex flex-col gap-2 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                <h4 className="text-red-400 font-bold text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Task Failed
                </h4>
                <p className="text-neutral-300 text-sm whitespace-pre-wrap">{error}</p>
                <div className="mt-2">
                  <button
                    onClick={handleResetToNewJob}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium rounded-lg transition-colors border border-neutral-700/60"
                  >
                    Reset and Try Again
                  </button>
                </div>
              </div>
            )}
            
            {status !== "IDLE" && !error && progress && (
              <div className="mt-4 p-4 rounded-xl bg-neutral-900/80 border border-neutral-800/90 shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isPolling ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                    <span className="text-sm font-medium text-neutral-200 capitalize">
                      Status: {status.toLowerCase().replace('_', ' ')}
                    </span>
                  </div>
                  {(status === "AWAITING_MANUAL" || status === "DONE") && (
                    <button
                      onClick={() => status === "DONE" ? setIsResultsModalOpen(true) : setIsPromptModalOpen(true)}
                      className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2"
                    >
                      {status === "DONE" ? "View Results" : "Open AI Prompt"}
                    </button>
                  )}
                </div>
                <p className="text-xs text-neutral-400 font-mono break-all">{progress}</p>
                
                {isPolling && (
                  <button
                    onClick={cancelCurrentJob}
                    className="mt-3 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-medium rounded-lg transition-colors border border-red-500/20"
                  >
                    Cancel Job
                  </button>
                )}
              </div>
            )}
          </main>
        )}

        {/* Global Footer */}
        <footer className="pt-2 text-center text-xs text-neutral-500 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-neutral-800/60 pb-6">
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-amber-400/80" />
            <span>Colab GPU Acceleration • faster-whisper & FFmpeg</span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span>Auto Clipper v1.0 Cloud</span>
            <span>•</span>
            <span>Zero Local GPU Required</span>
          </div>
        </footer>
      </div>

      <PromptJsonModal
        prompt={activePrompt || prompt}
        isOpen={isPromptModalOpen}
        onClose={() => {
          setIsPromptModalOpen(false);
          setActivePrompt("");
        }}
        onSubmitJson={handleJsonSubmit}
        isSubmitting={isLoading}
      />

      <ResultsModal
        isOpen={isResultsModalOpen}
        onClose={() => {
          setIsResultsModalOpen(false);
          setActiveHistoryJob(null);
        }}
        clips={(activeHistoryJob?.clips || (activeHistoryJob as any)?.result_clips || clips || []).map((c: any, i: number) => ({
          id: `clip-${i}`,
          path: c.path,
          title: c.social?.title || c.description
        }))}
        onResetApp={handleResetToNewJob}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      <MainWizard />
    </AuthGate>
  );
}
