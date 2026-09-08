import React, { useState, useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthGate } from "./components/AuthGate";
import { AppLayout } from "./layouts/AppLayout";
import { WorkspacePage } from "./pages/WorkspacePage";
import { HistoryPage } from "./pages/HistoryPage";
import { PromptJsonModal } from "./components/Dashboard/PromptJsonModal";
import { ResultsModal } from "./components/Dashboard/ResultsModal";
import { useJobPolling } from "./hooks/useJobPolling";
import type { JobResponse } from "./types/job";

export const AppContext = React.createContext<any>(null);

function MainApp() {
  const [resetKey, setResetKey] = useState(0);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);

  const [activePrompt, setActivePrompt] = useState<string>("");
  const [activeHistoryJob, setActiveHistoryJob] = useState<JobResponse | null>(null);
  const [shownResultsForJobId, setShownResultsForJobId] = useState<string | null>(null);

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

  const contextValue = {
    resetKey,
    activeJob,
    isLoading,
    isPolling,
    handleHeroSubmit,
    error,
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
          </Route>
        </Routes>
      </HashRouter>

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
        onResetApp={handleResetToNewJob}
      />
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
