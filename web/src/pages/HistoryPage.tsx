import React from "react";
import { useNavigate } from "react-router-dom";
import { HistoryList } from "../components/HistoryList";
import { AppContext } from "../App";

export const HistoryPage: React.FC = () => {
  const ctx = React.useContext(AppContext);
  const navigate = useNavigate();

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <header className="mb-2 sm:mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-text-primary">History</h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1">
          View your previously rendered clips and AI jobs.
        </p>
      </header>

      <HistoryList
        onResume={(id) => {
          ctx.startPolling(id);
          navigate("/");
        }}
        onResumeManual={(id, manualPrompt) => {
          ctx.stopPolling();
          ctx.startPolling(id);
          ctx.setActivePrompt(manualPrompt);
          ctx.setIsPromptModalOpen(true);
        }}
        onViewResults={(job) => {
          ctx.setActiveHistoryJob(job);
          ctx.setIsResultsModalOpen(true);
        }}
      />
    </div>
  );
};
