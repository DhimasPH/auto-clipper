import { useState, useEffect } from "react";
import {
  Video,
  Sparkles,
  Check,
  LogOut,
  RotateCcw,
  Cpu,
  History,
} from "lucide-react";
import { AuthGate } from "./components/AuthGate";
import { HistoryList } from "./components/HistoryList";
import { StepInput } from "./components/Steps/StepInput";
import { StepPrompt } from "./components/Steps/StepPrompt";
import { StepPaste } from "./components/Steps/StepPaste";
import { StepResult } from "./components/Steps/StepResult";
import { useJobPolling } from "./hooks/useJobPolling";
import { clearAuthToken, apiCheckHealth } from "./api";
import type { CreateJobPayload } from "./types/job";

export type WizardStep = 1 | 2 | 3 | 4;

const STORAGE_STEP_KEY = "ac_wizard_current_step";

function MainWizard() {
  const [currentView, setCurrentView] = useState<"wizard" | "history">("wizard");
  const [resetKey, setResetKey] = useState(0);
  const [currentStep, setCurrentStep] = useState<WizardStep>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_STEP_KEY);
      if (saved) {
        const num = parseInt(saved, 10);
        if (num >= 1 && num <= 4) return num as WizardStep;
      }
    }
    return 1;
  });

  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  const {
    jobId,
    status,
    progress,
    prompt,
    clips,
    error,
    failedCount,
    isLoading,
    activeJob,
    createAndStartJob,
    resumeJobWithJson,
    cancelCurrentJob,
    resetJob,
    stopPolling,
    startPolling,
  } = useJobPolling();

  // Save current step to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_STEP_KEY, currentStep.toString());
    }
  }, [currentStep]);

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

  // Automatic step synchronization based on background job status
  useEffect(() => {
    if (jobId) {
      if (status === "AWAITING_MANUAL" && prompt) {
        if (currentStep !== 2 && currentStep !== 3) setCurrentStep(2);
      } else if (
        status === "CROPPING" ||
        status === "PROCESSING" ||
        status === "DONE" ||
        status === "ERROR"
      ) {
        if (currentStep !== 4) setCurrentStep(4);
      } else if (status === "DOWNLOADING" || status === "TRANSCRIBING") {
        if (currentStep !== 2 && currentStep !== 3) setCurrentStep(2);
      }
    }
  }, [status, jobId, prompt, currentStep]);

  const handleStep1Submit = async (payload: CreateJobPayload) => {
    try {
      await createAndStartJob(payload);
      setCurrentStep(2);
    } catch (err) {
      // Error handled in hook / displayed in Step
    }
  };

  const handleStep2Next = () => {
    setCurrentStep(3);
  };

  const handleStep3Submit = async (jsonPayload: string) => {
    try {
      await resumeJobWithJson(jsonPayload);
      setCurrentStep(4);
    } catch (err) {
      // Error handled in hook
    }
  };

  const handleResetToNewJob = () => {
    setCurrentView("wizard");
    resetJob();
    setCurrentStep(1);
    setResetKey((prev) => prev + 1);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_STEP_KEY);
      localStorage.removeItem("ac_draft_step_input");
      setTimeout(() => localStorage.removeItem("ac_draft_step_input"), 10);
    }
  };

  const handleRetryJob = () => {
    setCurrentView("wizard");
    resetJob();
    setCurrentStep(1);
    setResetKey((prev) => prev + 1);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_STEP_KEY);
      localStorage.removeItem("ac_draft_step_input");
      setTimeout(() => localStorage.removeItem("ac_draft_step_input"), 10);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out and clear your access token?")) {
      clearAuthToken();
    }
  };

  const STEPS_CONFIG = [
    { num: 1 as WizardStep, label: "Input", desc: "URL & Style" },
    { num: 2 as WizardStep, label: "AI Prompt", desc: "Transcribe" },
    { num: 3 as WizardStep, label: "Highlights", desc: "Paste JSON" },
    { num: 4 as WizardStep, label: "Export", desc: "Render & Download" },
  ];

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
            />
          </main>
        ) : (
          <>
            {/* Wizard Step Navigation Bar */}
            <nav aria-label="Progress" className="bg-neutral-900/70 border border-neutral-800/80 rounded-2xl p-2 sm:p-3 backdrop-blur-md shadow-lg">
              <ol className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {STEPS_CONFIG.map((step) => {
                  const isActive = currentStep === step.num;
                  const isCompleted = currentStep > step.num;

                  return (
                    <li key={step.num}>
                      <button
                        type="button"
                        disabled={!jobId && step.num > 1}
                        onClick={() => {
                          if (jobId || step.num === 1) {
                            setCurrentStep(step.num);
                          }
                        }}
                        className={`w-full text-left p-2 sm:p-3 rounded-xl transition-all flex flex-col justify-between ${
                          isActive
                            ? "bg-amber-400/15 border border-amber-400/40 text-amber-300 shadow-sm"
                            : isCompleted
                            ? "bg-neutral-950/40 border border-neutral-800 text-neutral-300 hover:bg-neutral-800/60"
                            : "opacity-40 border border-transparent text-neutral-500 cursor-not-allowed"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">
                            Step 0{step.num}
                          </span>
                          {isCompleted ? (
                            <div className="w-3.5 h-3.5 rounded-full bg-emerald-400/20 text-emerald-400 flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </div>
                          ) : (
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-amber-400" : "bg-neutral-700"}`} />
                          )}
                        </div>
                        <span className="text-xs sm:text-sm font-bold truncate block">
                          {step.label}
                        </span>
                        <span className="text-[10px] text-neutral-400 hidden sm:block truncate">
                          {step.desc}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>

            {/* Wizard Step Body Card */}
            <main className="bg-neutral-900/80 border border-neutral-800/90 rounded-3xl p-5 sm:p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
              {/* Active Step Content */}
              {currentStep === 1 && (
                <StepInput
                  key={resetKey}
                  initialUrl={activeJob?.metadata?.source_video}
                  isSubmitting={isLoading}
                  onSubmit={handleStep1Submit}
                />
              )}

              {currentStep === 2 && (
                <StepPrompt
                  prompt={prompt}
                  jobId={jobId || "new_job"}
                  status={status}
                  progress={progress}
                  onNext={handleStep2Next}
                  onBack={() => setCurrentStep(1)}
                />
              )}

              {currentStep === 3 && (
                <StepPaste
                  jobId={jobId || "new_job"}
                  isSubmitting={isLoading}
                  onSubmit={handleStep3Submit}
                  onBack={() => setCurrentStep(2)}
                />
              )}

              {currentStep === 4 && (
                <StepResult
                  jobId={jobId || "job"}
                  status={status}
                  progress={progress}
                  clips={clips}
                  failedCount={failedCount}
                  error={error}
                  activeJob={activeJob}
                  onReset={handleResetToNewJob}
                  onCancel={cancelCurrentJob}
                  onRetry={handleRetryJob}
                />
              )}
            </main>
          </>
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
