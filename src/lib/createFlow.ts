import type { Caps } from "../platform/types";
import type { JobWarning } from "../types/errorInfo";

// The "Buat klip" flow (spec 4.2): which step is active, plus small helpers for step 1. No React.

/** Stages per step, named as in backend/stage_timer.py and timing.stage_*. */
export const PREPARE_STAGES = ["download", "extract_audio", "transcribe"] as const;
export const CHOOSE_STAGES = ["ai_analysis"] as const;
export const MAKE_STAGES = ["tracking", "render", "hook_concat", "publish"] as const;

export type FlowStep = 1 | 2 | 3 | 4;
export type StepState = "done" | "active" | "todo";

export interface FlowState {
  /** Status from useClipJobs: IDLE, GENERATING, PENDING, DOWNLOADING, TRANSCRIBING, CROPPING, DONE, ERROR. */
  status: string;
  running: boolean;
  /** `current.stage` of the job status, or null between stages. */
  currentStage: string | null;
  /** A project waits for the pasted AI answer. */
  awaitingAnswer: boolean;
  /** The running job started at clip making (answer sent, re-render), so "no stage yet" means step 4. */
  makePhase: boolean;
  /** This flow's clips are on screen. */
  hasClips: boolean;
}

const isIn = (list: readonly string[], stage: string | null) => !!stage && list.includes(stage);

export function activeStep(f: FlowState): FlowStep {
  if (f.awaitingAnswer) return 3;
  if (f.running) {
    if (isIn(CHOOSE_STAGES, f.currentStage)) return 3;
    if (isIn(MAKE_STAGES, f.currentStage) || f.status === "CROPPING" || f.makePhase) return 4;
    return 2;
  }
  return f.hasClips ? 4 : 1;
}

export function stepStates(active: FlowStep, finished: boolean): StepState[] {
  return ([1, 2, 3, 4] as const).map((n) =>
    n < active || (finished && n === active) ? "done" : n === active ? "active" : "todo",
  );
}

// Same sites as SUPPORTED_URL_RE in backend/main.py; change both together.
const SUPPORTED_LINK =
  /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be|tiktok\.com|vt\.tiktok\.com|instagram\.com|x\.com|twitter\.com)\/.+/i;

export type LinkProblem = "empty" | "unsupported";

export function linkProblem(text: string): LinkProblem | null {
  const link = text.trim();
  if (!link) return "empty";
  return SUPPORTED_LINK.test(link) ? null : "unsupported";
}

export type VideoSourceName = { kind: "link"; url: string } | { kind: "file"; name: string };

const SITES: [RegExp, string][] = [
  [/youtube\.com|youtu\.be/i, "YouTube"],
  [/tiktok\.com/i, "TikTok"],
  [/instagram\.com/i, "Instagram"],
  [/(^|[/.])(x|twitter)\.com/i, "X"],
];

export function sourceName(source: VideoSourceName): string {
  if (source.kind === "file") return source.name.replace(/\.[^.]+$/, "") || "Video";
  return SITES.find(([re]) => re.test(source.url))?.[1] ?? "Video";
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A unique project name, e.g. "YouTube 2026-11-20 14.05.09" (the backend wants a unique title). */
export function autoProjectTitle(source: VideoSourceName, now: Date): string {
  // Same characters backend/jobs.py sanitize_title keeps, so the folder name matches.
  const base =
    sourceName(source)
      .replace(/[^\w\s\-.,()[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60)
      .trim() || "Video";
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
  return `${base} ${date} ${time}`;
}

export type AiMode = "manual" | "auto";
export const MANUAL_PROVIDER = "manual_ai";

/** Manual AI (copy, ask ChatGPT or Gemini, paste) unless API key mode is on where keys exist. */
export function effectiveProvider(caps: Pick<Caps, "apiKeys">, aiMode: AiMode, provider: string): string {
  return caps.apiKeys && aiMode === "auto" && provider ? provider : MANUAL_PROVIDER;
}

/** Subtitle models that take far longer on the processor (backend `processor_slow_models`). */
export const PROCESSOR_SLOW_MODELS = ["medium", "large-v3"];

/**
 * Ask before Mulai (SP3 4.3): a slow model is chosen and the preflight `gpu` check warned, which
 * it does whenever subtitles would run on the processor (no NVIDIA card, macOS, or the GPU add-on
 * missing). `notes` holds only "warn" checks, so an ok GPU or a check not run yet starts directly.
 */
export function asksAboutProcessorModel(whisperModel: string | undefined, notes: Pick<JobWarning, "id">[]): boolean {
  return !!whisperModel && PROCESSOR_SLOW_MODELS.includes(whisperModel) && notes.some((n) => n.id === "gpu");
}
