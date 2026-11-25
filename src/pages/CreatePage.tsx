import React, { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppContext } from "../App";
import ClipsResult from "../components/ClipsResult";
import { ClipEditModal } from "../components/ClipEditModal";
import { ErrorCard } from "../components/ErrorCard";
import { ClipOptions } from "../components/create/ClipOptions";
import { MomentStep } from "../components/create/MomentStep";
import { PreflightNotices } from "../components/create/PreflightNotices";
import { ProgressPanel } from "../components/create/ProgressPanel";
import { StepIndicator } from "../components/create/StepIndicator";
import { VideoStep } from "../components/create/VideoStep";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
import { useBackendStatus } from "../hooks/useBackendStatus";
import { useErrorActions } from "../hooks/useErrorActions";
import { usePreflight } from "../hooks/usePreflight";
import {
  MANUAL_PROVIDER,
  activeStep,
  asksAboutProcessorModel,
  autoProjectTitle,
  effectiveProvider,
  linkProblem,
  stepStates,
  type FlowState,
  type FlowStep,
  type VideoSourceName,
} from "../lib/createFlow";
import { platform } from "../platform";
import { fileName } from "../platform/paths";

const LOCAL_PREFIX = "local:";

/** "Buat klip" (spec 4.2): one screen, four steps. */
export const CreatePage: React.FC = () => {
  const { t } = useTranslation();
  const ctx = useContext(AppContext);
  const caps = platform().caps;
  const { status: backend } = useBackendStatus();
  const connected = backend === "connected";
  const preflight = usePreflight(connected);
  const pickButton = useRef<HTMLButtonElement>(null);
  const useFastButton = useRef<HTMLButtonElement>(null);
  const [editClip, setEditClip] = useState<number | null>(null);
  // Mulai with a slow subtitle model on the processor: the start waits for the user's answer.
  const [processorQuestion, setProcessorQuestion] = useState<{ provider: string; title: string } | null>(null);

  const flow: FlowState = {
    status: ctx.status,
    running: ctx.isRunning,
    currentStage: ctx.current?.stage ?? null,
    awaitingAnswer: !!ctx.awaiting,
    makePhase: !!ctx.makePhase,
    hasClips: (ctx.clips?.length ?? 0) > 0,
  };
  const step = activeStep(flow);
  const finished = ctx.status === "DONE" && flow.hasClips;

  // Spec 5: an error shows at the step where the job stopped.
  const [stoppedAt, setStoppedAt] = useState<FlowStep>(2);
  if (flow.running && stoppedAt !== step) {
    setStoppedAt(step);
  }
  const failed = ctx.status === "ERROR" && !!ctx.errorMsg;
  const shownStep: FlowStep = failed ? stoppedAt : step;

  // "Unggah file video" on an error card elsewhere: bring the user to the file button.
  const { pendingLocalUpload, clearPendingLocalUpload } = ctx;
  useEffect(() => {
    if (!pendingLocalUpload) return;
    pickButton.current?.focus();
    clearPendingLocalUpload();
  }, [pendingLocalUpload, clearPendingLocalUpload]);

  const localPath = ctx.inputType === "url" && ctx.url.startsWith(LOCAL_PREFIX) ? ctx.url.slice(LOCAL_PREFIX.length) : null;
  const chosenFile: string | null =
    ctx.inputType === "local" && ctx.localFile ? ctx.localFile.name : localPath ? fileName(localPath) : null;
  const hasVideo = !!chosenFile || linkProblem(ctx.url) === null;
  const canStart = hasVideo && connected && preflight.blockers.length === 0 && !ctx.isRunning;
  const jobErrorActions = useErrorActions({ jobId: ctx.failedJobId, origin: "workspace" });
  const liveTrackingMode =
    typeof ctx.liveMeta?.tracking_mode === "string" && ctx.liveMeta.tracking_mode ? ctx.liveMeta.tracking_mode : ctx.choices.trackingMode;
  const liveAspectRatio =
    typeof ctx.liveMeta?.aspect_ratio === "string" && ctx.liveMeta.aspect_ratio ? ctx.liveMeta.aspect_ratio : ctx.choices.aspectRatio;

  const setLink = (value: string) => {
    ctx.setInputType("url");
    ctx.setLocalFile(null);
    ctx.setUrl(value);
  };

  const clearFile = () => setLink("");

  // Called straight from the click, so the browser file dialog is allowed to open.
  const pickFile = async () => {
    const picked = await platform().pickVideo();
    if (!picked) return;
    if (picked.kind === "file") {
      ctx.setLocalFile(picked.file);
      ctx.setInputType("local");
    } else {
      setLink(`${LOCAL_PREFIX}${picked.path}`);
    }
  };

  const start = () => {
    const source: VideoSourceName = chosenFile ? { kind: "file", name: chosenFile } : { kind: "link", url: ctx.url };
    const title = ctx.title.trim() || autoProjectTitle(source, new Date());
    const provider = effectiveProvider(caps, ctx.aiMode, ctx.provider);
    if (asksAboutProcessorModel(ctx.whisperModel, preflight.notes)) {
      setProcessorQuestion({ provider, title });
      return;
    }
    // Ruling P9: a direct start keeps the two-argument call.
    ctx.handleGenerate(provider, title);
  };

  // The model goes along as the third argument: setWhisperModel only reaches the job hook on the next render.
  const answerProcessorQuestion = (useFast: boolean) => {
    const question = processorQuestion;
    if (!question) return;
    setProcessorQuestion(null);
    if (useFast) ctx.setWhisperModel?.("small");
    ctx.handleGenerate(question.provider, question.title, useFast ? "small" : ctx.whisperModel);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-page-title text-text-primary">{t("create.title")}</h1>
      <StepIndicator states={stepStates(shownStep, finished)} />

      {failed && ctx.errorInfo && <ErrorCard info={ctx.errorInfo} handlers={jobErrorActions} announce />}
      {failed && !ctx.errorInfo && ctx.errorMsg && (
        <p role="alert" className="text-body text-error break-words">
          {ctx.errorMsg}
        </p>
      )}

      {ctx.awaiting && (
        <MomentStep
          key={ctx.awaiting.jobId}
          prompt={ctx.awaiting.prompt}
          projectTitle={ctx.awaiting.title}
          submitting={ctx.sendingAnswer}
          error={ctx.answerError}
          onSubmit={(payload) => void ctx.submitAiAnswer(payload)}
          onLater={() => {
            ctx.leaveAwaiting();
            ctx.handleResetWorkspace();
          }}
        />
      )}

      {step === 1 && (
        <>
          <VideoStep
            link={localPath ? "" : ctx.url}
            onLinkChange={setLink}
            chosenFile={chosenFile}
            onClearFile={clearFile}
            onPickFile={() => void pickFile()}
            onPickDrive={caps.driveBrowser ? () => ctx.requestDriveBrowser() : undefined}
            shape={ctx.choices.aspectRatio}
            onShapeChange={(aspectRatio) => ctx.patchChoices({ aspectRatio })}
            pickButtonRef={pickButton}
          />
          <ClipOptions
            choices={ctx.choices}
            onChange={ctx.patchChoices}
            title={ctx.title}
            onTitleChange={ctx.setTitle}
            quality={ctx.quality}
            onQualityChange={ctx.setQuality}
            showQuality={!chosenFile}
            hasPexelsKey={!!ctx.apiKeys?.pexels}
          />
          <PreflightNotices
            notes={preflight.notes}
            blockers={preflight.blockers}
            checking={preflight.state === "loading"}
            onRecheck={preflight.recheck}
          />
          {!failed && ctx.errorInfo && <ErrorCard info={ctx.errorInfo} handlers={jobErrorActions} announce />}
          {/* A request that failed without error_info (old backend): its own words, as before SP2. */}
          {!failed && ctx.errorMsg && !ctx.errorInfo && (
            <p role="alert" className="text-body text-error break-words">
              {ctx.errorMsg}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <Button size="lg" className="w-full sm:w-auto sm:self-start" disabled={!canStart} onClick={start}>
              {t("create.start")}
            </Button>
            {!hasVideo && <p className="text-body text-text-secondary">{t("create.start_hint")}</p>}
          </div>
        </>
      )}

      {processorQuestion && (
        <Dialog
          title={t("create.cpu_model_title")}
          onClose={() => setProcessorQuestion(null)}
          initialFocusRef={useFastButton}
          footer={
            <>
              <Button variant="outline" onClick={() => answerProcessorQuestion(false)}>
                {t("create.cpu_model_keep_accurate")}
              </Button>
              <Button ref={useFastButton} variant="primary" onClick={() => answerProcessorQuestion(true)}>
                {t("create.cpu_model_use_fast")}
              </Button>
            </>
          }
        >
          <p className="text-body text-text-primary">{t("create.cpu_model_body")}</p>
        </Dialog>
      )}

      {flow.running && step !== 1 && (
        <ProgressPanel
          step={step as 2 | 3 | 4}
          autoAi={effectiveProvider(caps, ctx.aiMode, ctx.provider) !== MANUAL_PROVIDER}
          tracking={liveTrackingMode === "auto" && liveAspectRatio !== "16:9"}
          localSource={!!chosenFile}
          current={ctx.current}
          timings={ctx.liveMeta?.timings}
          queuePosition={ctx.queuePosition}
          onCancel={ctx.cancelJob}
        />
      )}

      {flow.hasClips && (finished || flow.running) && (
        <ClipsResult
          clips={ctx.clips}
          status={ctx.status}
          failedCount={ctx.failedCount}
          jobId={ctx.resultJobId ?? ctx.jobId ?? ""}
          metadata={ctx.jobMeta}
          onEditClip={finished && ctx.resultJobId ? setEditClip : undefined}
          onNew={ctx.handleResetWorkspace}
        />
      )}
      {editClip !== null && ctx.resultJobId && (
        <ClipEditModal
          jobId={ctx.resultJobId}
          clipIndex={editClip}
          clipTitle={t("result.clip_n", { n: editClip + 1 })}
          initialAspectRatio={ctx.jobMeta?.aspect_ratio || "9:16"}
          initialTrackingMode={ctx.jobMeta?.tracking_mode || "auto"}
          initialFaceTrackingEngine={ctx.jobMeta?.face_tracking_engine || "haar"}
          initialBurnSubs={ctx.jobMeta?.burn_subs ?? true}
          initialCanvasConfig={ctx.jobMeta?.canvas_config}
          initialSubtitleConfig={ctx.jobMeta?.subtitle_config}
          onClose={() => setEditClip(null)}
          onRerenderStart={(newJobId) => {
            setEditClip(null);
            ctx.handleRerenderClip(newJobId);
          }}
        />
      )}
    </div>
  );
};
