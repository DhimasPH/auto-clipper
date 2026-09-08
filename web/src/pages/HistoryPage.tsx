import React from "react";
import { HistoryList } from "../components/HistoryList";
import { AppContext } from "../App";

export const HistoryPage: React.FC = () => {
  const ctx = React.useContext(AppContext);

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto space-y-6">
      <header className="mb-6">
        <h1 className="text-page-title text-text-primary">History</h1>
        <p className="text-body text-text-secondary mt-1">
          View your previously rendered clips and AI jobs.
        </p>
      </header>

      <div className="bg-bg-surface border border-border rounded-xl p-5 shadow-sm">
        <HistoryList
          onResume={(id) => {
            // Note: need to navigate to "/" here, so we could use useNavigate, 
            // but for simplicity we will handle it via context or just let the user click workspace manually after resume.
            // Ideally we pass navigate to it, or handle it inside HistoryList.
            ctx.startPolling(id);
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
    </div>
  );
};
