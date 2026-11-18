import React, { useState, useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthGate } from "./components/AuthGate";
import { AppLayout } from "./layouts/AppLayout";
import { WorkspacePage } from "./pages/WorkspacePage";
import { HistoryPage } from "./pages/HistoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { PromptJsonModal } from "./components/Dashboard/PromptJsonModal";
import { ResultsModal } from "./components/Dashboard/ResultsModal";
import { ClipEditModal } from "./components/ClipEditModal";
import { BusyOverlay } from "./components/BusyOverlay";
import { CookiesModal } from "./components/CookiesModal";
import { JobWarnings } from "./components/JobWarnings";
import { TimingDetails } from "./components/TimingDetails";
import { useJobPolling } from "./hooks/useJobPolling";
import type { JobResponse } from "./types/job";
import { DEFAULT_CANVAS_CONFIG } from "./types/canvas";
import { DEFAULT_SUBTITLE_CONFIG } from "./types/subtitle";

export const AppContext = React.createContext<any>(null);

function MainApp() {
  const [resetKey, setResetKey] = useState(0);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);

  const [activePrompt, setActivePrompt] = useState<string>("");
  const [activeHistoryJob, setActiveHistoryJob] = useState<JobResponse | null>(null);
  const [shownResultsForJobId, setShownResultsForJobId] = useState<string | null>(null);
  const [activeEditModalClip, setActiveEditModalClip] = useState<{ jobId: string; index: number; jobMeta?: any } | null>(null);
  // Cookies upload opened from an error card. `onRetry` runs the failed step again.
  const [cookiesModal, setCookiesModal] = useState<{ onRetry?: () => void } | null>(null);
  // Set by the "pick a video from Google Drive" action; the workspace form opens the Drive browser once.
  const [driveBrowserRequested, setDriveBrowserRequested] = useState(false);

  const {
    jobId,
    status,
    progress,
    prompt,
    clips,
    error,
    errorInfo,
    queuePosition,
    isLoading,
    isPolling,
    activeJob,
    createAndStartJob,
    resumeJob,
    resumeJobWithJson,
    cancelCurrentJob,
    resetJob,
    stopPolling,
    startPolling,
  } = useJobPolling();

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

  const handleHeroSubmit = async (payload: any) => {
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
      setIsPromptModalOpen(false); // Close so they can see the error!
    }
  };

  const handleResetToNewJob = () => {
    resetJob();
    setResetKey((prev) => prev + 1);
    setIsPromptModalOpen(false);
    setIsResultsModalOpen(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem("ac_draft_hero_input");
      setTimeout(() => localStorage.removeItem("ac_draft_hero_input"), 10);
    }
  };

  const isRunning =
    isLoading ||
    (isPolling &&
      status !== "IDLE" &&
      status !== "DONE" &&
      status !== "ERROR" &&
      status !== "CANCELLED" &&
      status !== "AWAITING_MANUAL");

  // The job whose clips the results modal shows: one opened from History, else the current job.
  const resultsMeta = activeHistoryJob?.metadata || activeJob?.metadata;

  const contextValue = {
    resetKey,
    jobId,
    activeJob,
    isLoading,
    isPolling,
    isRunning,
    handleHeroSubmit,
    resumeJob,
    error,
    errorInfo,
    queuePosition,
    openCookies: (onRetry?: () => void) => setCookiesModal({ onRetry }),
    driveBrowserRequested,
    requestDriveBrowser: () => setDriveBrowserRequested(true),
    clearDriveBrowserRequest: () => setDriveBrowserRequested(false),
    status,
    progress,
    setIsResultsModalOpen,
    setIsPromptModalOpen,
    cancelCurrentJob,
    handleResetToNewJob,
    startPolling,
    stopPolling,
    setActivePrompt,
    setActiveHistoryJob,
  };

  return (
    <AppContext.Provider value={contextValue}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<WorkspacePage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>

      {/* Busy Overlay Modal (Persistent Modal like Desktop Auto Clipper) */}
      <BusyOverlay />

      {cookiesModal && (
        <CookiesModal onClose={() => setCookiesModal(null)} onRetry={cookiesModal.onRetry} />
      )}

      {/* Global Modals for Job Flow */}
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
          title: c.social?.title || c.description,
          social: c.social
        }))}
        onEditSubtitle={(clipIdx) => {
          const targetJobId = activeHistoryJob?.id || jobId;
          if (targetJobId) {
            setActiveEditModalClip({
              jobId: targetJobId,
              index: clipIdx,
              jobMeta: activeHistoryJob?.metadata || activeJob?.metadata,
            });
          }
        }}
        onResetApp={handleResetToNewJob}
        notice={
          <>
            <JobWarnings warnings={resultsMeta?.warnings} className="mb-3 sm:mb-4" />
            <TimingDetails metadata={resultsMeta} className="mb-3 sm:mb-4" />
          </>
        }
      />

      {activeEditModalClip && (
        <ClipEditModal
          jobId={activeEditModalClip.jobId}
          clipIndex={activeEditModalClip.index}
          clipTitle={`Clip #${activeEditModalClip.index + 1}`}
          initialOutputStyle={
            activeEditModalClip.jobMeta?.aspect_ratio === "16:9" &&
            activeEditModalClip.jobMeta?.canvas_config?.enabled
              ? "canvas_blur"
              : activeEditModalClip.jobMeta?.aspect_ratio === "16:9"
                ? "landscape"
                : activeEditModalClip.jobMeta?.aspect_ratio === "1:1"
                  ? "square"
                  : "face_crop"
          }
          initialCanvasConfig={activeEditModalClip.jobMeta?.canvas_config || DEFAULT_CANVAS_CONFIG}
          initialSubtitleConfig={activeEditModalClip.jobMeta?.subtitle_config || DEFAULT_SUBTITLE_CONFIG}
          onClose={() => setActiveEditModalClip(null)}
          onRerenderStart={(newJobId) => {
            setActiveEditModalClip(null);
            setIsResultsModalOpen(false);
            startPolling(newJobId);
          }}
        />
      )}
    </AppContext.Provider>
  );
}

export default function App() {
  return (
    <AuthGate>
      <MainApp />
    </AuthGate>
  );
}
