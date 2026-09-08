import React from "react";
import { HeroInput } from "../components/Dashboard/HeroInput";
import { AlertCircle } from "lucide-react";
import { AppContext } from "../App";

export const WorkspacePage: React.FC = () => {
  const ctx = React.useContext(AppContext);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <header className="mb-2 sm:mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-text-primary">Workspace</h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1">
          Automated short-form video generation on Google Colab GPU
        </p>
      </header>

      <HeroInput
        key={ctx.resetKey}
        initialUrl={ctx.activeJob?.metadata?.source_video}
        isSubmitting={ctx.isLoading || ctx.isPolling}
        onSubmit={ctx.handleHeroSubmit}
      />

      {ctx.error && (
        <div className="mt-4 p-4 rounded-xl bg-error/10 border border-error/20 flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-error" />
          <h4 className="text-error font-bold text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Task Failed
          </h4>
          <p className="text-text-primary text-sm whitespace-pre-wrap">{ctx.error}</p>
          <div className="mt-2">
            <button
              onClick={ctx.handleResetToNewJob}
              className="px-3 py-1.5 bg-bg-elevated hover:bg-bg-surface text-xs font-medium rounded-lg transition-colors border border-border"
            >
              Reset and Try Again
            </button>
          </div>
        </div>
      )}

      {!ctx.isRunning && ctx.status !== "IDLE" && !ctx.error && (
        <div className="mt-4 p-4 rounded-2xl bg-bg-surface border border-border shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-success" />
              <span className="text-sm font-semibold text-text-primary capitalize">
                Status: {ctx.status.toLowerCase().replace(/_/g, ' ')}
              </span>
            </div>
            {(ctx.status === "AWAITING_MANUAL" || ctx.status === "DONE") && (
              <button
                onClick={() => ctx.status === "DONE" ? ctx.setIsResultsModalOpen(true) : ctx.setIsPromptModalOpen(true)}
                className="text-xs font-semibold text-purple-600 hover:text-purple-700 underline underline-offset-2"
              >
                {ctx.status === "DONE" ? "Lihat Hasil Klip" : "Buka Prompt AI"}
              </button>
            )}
          </div>
          {ctx.progress && (
            <p className="text-xs text-text-secondary font-mono mt-2 break-all">{ctx.progress}</p>
          )}
        </div>
      )}
    </div>
  );
};
