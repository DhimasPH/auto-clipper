import { CHOOSE_STAGES, PREPARE_STAGES } from "./createFlow";
import { summarizeTimings } from "./timings";

// The progress screen (spec 4.3) from the live `current` stage (GET /jobs/{id}) and the finished
// `metadata.timings`. Only real facts: no time-based messages, no rotating texts. No React.

export interface LiveStage {
  stage: string;
  started_at: number;
  /** Seconds the stage has run, by the backend's clock (the phone's clock may differ). */
  elapsed_seconds?: number;
  device?: string;
  clip?: number;
  clips_total?: number;
  percent?: number;
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export function asLiveStage(value: unknown): LiveStage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.stage !== "string" || !v.stage) return null;
  const out: LiveStage = { stage: v.stage, started_at: num(v.started_at) ?? 0 };
  for (const key of ["elapsed_seconds", "clip", "clips_total", "percent"] as const) {
    const n = num(v[key]);
    if (n !== undefined) out[key] = n;
  }
  if (typeof v.device === "string" && v.device) out.device = v.device;
  return out;
}

export function stagesFor(step: 2 | 3 | 4, opts: { autoAi: boolean; tracking: boolean }): string[] {
  if (step === 4) return opts.tracking ? ["tracking", "render", "publish"] : ["render", "publish"];
  return opts.autoAi ? [...PREPARE_STAGES, ...CHOOSE_STAGES] : [...PREPARE_STAGES];
}

export type RowState = "done" | "running" | "todo";

export interface ProgressRow {
  stage: string;
  state: RowState;
  /** Finished: total seconds. Running: seconds so far. Waiting: null. */
  seconds: number | null;
  percent: number | null;
  clip: number | null;
  clipsTotal: number | null;
}

/** Adding the opening hook is part of making the clip. */
const SHOWN_AS: Record<string, string> = { hook_concat: "render" };
const shownAs = (stage: string) => SHOWN_AS[stage] ?? stage;

export function progressRows(stages: string[], timings: unknown, current: LiveStage | null): ProgressRow[] {
  const finished = new Map<string, number>();
  for (const row of summarizeTimings(timings)) {
    const stage = shownAs(row.stage);
    finished.set(stage, (finished.get(stage) ?? 0) + row.seconds);
  }
  const running = current ? shownAs(current.stage) : null;
  const list = running && !stages.includes(running) ? [running, ...stages] : stages;
  const runningAt = running ? list.indexOf(running) : -1;

  const rows: ProgressRow[] = list.map((stage, i) => {
    if (current && stage === running) {
      return {
        stage,
        state: "running",
        seconds: current.elapsed_seconds ?? null,
        percent: current.percent ?? null,
        clip: current.clip ?? null,
        clipsTotal: current.clips_total ?? null,
      };
    }
    // Finished, and not a stage that runs again later (tracking and render repeat per clip).
    const done = finished.has(stage) && (runningAt < 0 || i < runningAt);
    return { stage, state: done ? "done" : "todo", seconds: done ? finished.get(stage)! : null, percent: null, clip: null, clipsTotal: null };
  });

  // A stage that did not run while a later one did is not used for this video: leave it out.
  const lastStarted = rows.reduce((last, row, i) => (row.state !== "todo" ? i : last), -1);
  return rows.filter((row, i) => row.state !== "todo" || i > lastStarted);
}

export type DeviceNote = "cpu_subtitle" | "cpu_render";

export function deviceNotes(current: LiveStage | null, timings: unknown, stages: string[]): DeviceNote[] {
  const notes = new Set<DeviceNote>();
  const look = (stage: unknown, device: unknown) => {
    if (typeof stage !== "string" || !stages.includes(shownAs(stage))) return;
    if (stage === "transcribe" && device === "cpu") notes.add("cpu_subtitle");
    if (shownAs(stage) === "render" && device === "libx264") notes.add("cpu_render");
  };
  if (current) look(current.stage, current.device);
  if (Array.isArray(timings)) {
    for (const entry of timings) {
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      look(e.stage, e.whisper_device);
      look(e.stage, e.encoder);
    }
  }
  return [...notes];
}
