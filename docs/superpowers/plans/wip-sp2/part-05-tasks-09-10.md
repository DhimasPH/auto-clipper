### Task 9: Progress logic (`src/lib/progress.ts`)

Spec 4.3 (stage list, real progress only, device note) as pure functions over `current` (Task 2) and `metadata.timings`. Rules: a stage is "done" only when it finished before the running one; a stage that never ran while a later one did is hidden (it is not used for this video); the running stage shows its own percent or clip number; a running stage outside the step's list (e.g. the source video downloaded again before re-rendering) is shown first.

**Files:**
- Create: `src/lib/progress.ts`, `src/lib/progress.test.ts`

**Interfaces:**
- Consumes: `PREPARE_STAGES`, `CHOOSE_STAGES` (Task 6); `summarizeTimings` (`src/lib/timings.ts`); the `current` object of `GET /jobs/{id}` (Task 2).
- Produces:
  - `interface LiveStage { stage: string; started_at: number; elapsed_seconds?: number; device?: string; clip?: number; clips_total?: number; percent?: number }`
  - `asLiveStage(value: unknown): LiveStage | null`
  - `stagesFor(step: 2 | 3 | 4, opts: { autoAi: boolean; tracking: boolean }): string[]`
  - `type RowState = "done" | "running" | "todo"`; `interface ProgressRow { stage: string; state: RowState; seconds: number | null; percent: number | null; clip: number | null; clipsTotal: number | null }`
  - `progressRows(stages: string[], timings: unknown, current: LiveStage | null): ProgressRow[]`
  - `type DeviceNote = "cpu_subtitle" | "cpu_render"`; `deviceNotes(current: LiveStage | null, timings: unknown, stages: string[]): DeviceNote[]`

- [ ] **Step 1: Write the failing tests** (`src/lib/progress.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import { asLiveStage, deviceNotes, progressRows, stagesFor, type LiveStage } from "./progress";

const live = (stage: string, extra: Partial<LiveStage> = {}): LiveStage => ({ stage, started_at: 1, elapsed_seconds: 5, ...extra });
const timing = (stage: string, seconds: number, extra: Record<string, unknown> = {}) => ({ stage, seconds, rss_mb_peak: 1, ok: true, ...extra });
const states = (rows: { stage: string; state: string }[]) => rows.map((r) => `${r.stage}:${r.state}`);

describe("asLiveStage", () => {
  it("reads the current object of the job status", () => {
    expect(asLiveStage({ stage: "render", started_at: 3, elapsed_seconds: 2.5, clip: 2, clips_total: 4, device: "libx264", extra: 1 })).toEqual({
      stage: "render", started_at: 3, elapsed_seconds: 2.5, clip: 2, clips_total: 4, device: "libx264",
    });
  });

  it("is null for nothing or nonsense", () => {
    expect(asLiveStage(null)).toBeNull();
    expect(asLiveStage({ stage: "" })).toBeNull();
    expect(asLiveStage("render")).toBeNull();
  });
});

describe("stagesFor", () => {
  it("lists the stages of each step", () => {
    expect(stagesFor(2, { autoAi: false, tracking: true })).toEqual(["download", "extract_audio", "transcribe"]);
    expect(stagesFor(2, { autoAi: true, tracking: true })).toEqual(["download", "extract_audio", "transcribe", "ai_analysis"]);
    expect(stagesFor(4, { autoAi: false, tracking: true })).toEqual(["tracking", "render", "publish"]);
    expect(stagesFor(4, { autoAi: false, tracking: false })).toEqual(["render", "publish"]);
  });
});

describe("progressRows (spec 4.3: real progress only)", () => {
  const prepare = ["download", "extract_audio", "transcribe"];
  const make = ["tracking", "render", "publish"];

  it("shows every stage as waiting before anything runs", () => {
    expect(states(progressRows(prepare, [], null))).toEqual(["download:todo", "extract_audio:todo", "transcribe:todo"]);
  });

  it("shows the download percent while downloading", () => {
    const rows = progressRows(prepare, [], live("download", { percent: 42.5 }));
    expect(rows[0]).toEqual({ stage: "download", state: "running", seconds: 5, percent: 42.5, clip: null, clipsTotal: null });
    expect(states(rows).slice(1)).toEqual(["extract_audio:todo", "transcribe:todo"]);
  });

  it("ticks finished stages with how long they took", () => {
    const rows = progressRows(prepare, [timing("download", 10), timing("extract_audio", 3)], live("transcribe"));
    expect(states(rows)).toEqual(["download:done", "extract_audio:done", "transcribe:running"]);
    expect(rows[0].seconds).toBe(10);
  });

  it("hides a stage this video does not use", () => {
    expect(states(progressRows(prepare, [timing("download", 10)], live("transcribe")))).toEqual(["download:done", "transcribe:running"]);
  });

  it("says which clip of how many, and does not tick a stage that runs again for the next clip", () => {
    const rows = progressRows(make, [timing("tracking", 4, { clip: 1 }), timing("render", 20, { clip: 1 })], live("tracking", { clip: 2, clips_total: 3 }));
    expect(states(rows)).toEqual(["tracking:running", "render:todo", "publish:todo"]);
    expect([rows[0].clip, rows[0].clipsTotal]).toEqual([2, 3]);
  });

  it("counts adding the opening hook as making the clip", () => {
    expect(states(progressRows(make, [timing("tracking", 4)], live("hook_concat", { clip: 1 })))).toEqual([
      "tracking:done", "render:running", "publish:todo",
    ]);
  });

  it("shows a running stage from outside the list first", () => {
    expect(states(progressRows(make, [], live("download")))).toEqual(["download:running", "tracking:todo", "render:todo", "publish:todo"]);
  });
});

describe("deviceNotes (spec 4.3: the device really used)", () => {
  const prepare = ["download", "extract_audio", "transcribe"];

  it("notes subtitles made on the processor", () => {
    expect(deviceNotes(live("transcribe", { device: "cpu" }), [], prepare)).toEqual(["cpu_subtitle"]);
    expect(deviceNotes(null, [timing("transcribe", 30, { whisper_device: "cpu" })], prepare)).toEqual(["cpu_subtitle"]);
  });

  it("says nothing when the GPU did the work", () => {
    expect(deviceNotes(live("transcribe", { device: "cuda" }), [], prepare)).toEqual([]);
  });

  it("notes clips made on the processor, only on the step that makes them", () => {
    const timings = [timing("transcribe", 30, { whisper_device: "cpu" }), timing("render", 9, { encoder: "libx264" })];
    expect(deviceNotes(null, timings, ["tracking", "render", "publish"])).toEqual(["cpu_render"]);
  });
});
```

Run: `npx vitest run src/lib/progress.test.ts` → FAIL (module missing).

- [ ] **Step 2: Implement `src/lib/progress.ts`**

```ts
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
```

- [ ] **Step 3: Run the tests**

`npx vitest run src/lib/progress.test.ts` → PASS (2 + 1 + 7 + 3 = 13). Whole suite → 210 passing (record the total). `npx oxlint src` 0 errors. `npm run build` exit 0.

- [ ] **Step 4: Log and commit**

PROGRESS-LOG entry; ledger `Task 9: complete (...)`.

```bash
git add src/lib/progress.ts src/lib/progress.test.ts tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): progress rows and device notes from the live stage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Progress screen replaces `BusyOverlay`

Spec 4.3 in full: the progress screen is part of the page (navigation stays usable), lists the stages with real durations, shows percent / "Membuat klip 3 dari 10", the device note, the per-platform "may I close this?" line, the queue position, and "Batalkan" with a confirmation. `useClipJobs` keeps `current`, the live metadata and `makePhase`. Other pages show a slim "Sedang diproses · Lihat progres" bar (Spec gap 18). Toast texts lose their emoji and technical words, and `toast` joins the plain-words test.

**Files:**
- Create: `src/hooks/useNow.ts`, `src/components/create/ProgressPanel.tsx`, `src/components/create/ProgressPanel.test.tsx`, `src/components/nav/RunningBar.tsx`
- Modify: `src/hooks/useClipJobs.ts`, `src/App.tsx` (context), `src/pages/CreatePage.tsx`, `src/layouts/AppLayout.tsx`
- Delete: `src/components/BusyOverlay.tsx`
- Modify: `src/locales/{id,en}.json` (`progress.*`, `toast.*` values), `src/locales/plainWords.test.ts` (`"toast"`)

**Interfaces:**
- Consumes: `LiveStage`, `asLiveStage`, `stagesFor`, `progressRows`, `deviceNotes` (Task 9); `effectiveProvider`, `MANUAL_PROVIDER`, `FlowStep` (Task 6); `formatDuration` (`src/lib/timings.ts`); `ConfirmDialog` (Task 4); `caps.keepOpen` (Task 5).
- Produces:
  - `useNow(intervalMs?: number): number`
  - `<ProgressPanel step={2 | 3 | 4} autoAi tracking localSource current timings queuePosition onCancel />`
  - `useClipJobs` returns, in addition: `current: LiveStage | null`, `liveMeta: Record<string, unknown> | null`, `makePhase: boolean`, `jobOrigin: "workspace" | "history"`; App context exposes the same names.
  - `<RunningBar />` in `AppLayout`.

- [ ] **Step 1: Write the failing tests** (`src/components/create/ProgressPanel.test.tsx`)

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { CAPS, setPlatform, type Platform } from "../../platform";
import { ProgressPanel } from "./ProgressPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const base = { autoAi: false, tracking: true, localSource: false, timings: [], queuePosition: null, onCancel: vi.fn() };

describe("ProgressPanel (spec 4.3)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setPlatform({ caps: CAPS.desktop } as Platform);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setPlatform(null);
  });

  it("names the stages like Detail waktu and says which clip of how many", () => {
    act(() =>
      root.render(
        <ProgressPanel {...base} step={4} timings={[{ stage: "tracking", seconds: 4, ok: true }]}
          current={{ stage: "render", started_at: 1, elapsed_seconds: 3, clip: 3, clips_total: 10, device: "h264_nvenc" }} />,
      ),
    );
    const text = container.textContent!;
    expect(text).toContain(i18n.t("timing.stage_tracking"));
    expect(text).toContain(`${i18n.t("timing.stage_render")} ${i18n.t("progress.clip_of", { clip: 3, total: 10 })}`);
    expect(text).not.toContain(i18n.t("progress.cpu_render"));
  });

  it("shows the download percent and the processor note", () => {
    act(() =>
      root.render(
        <ProgressPanel {...base} step={2} timings={[{ stage: "download", seconds: 8, ok: true }, { stage: "extract_audio", seconds: 2, ok: true }]}
          current={{ stage: "transcribe", started_at: 1, elapsed_seconds: 30, device: "cpu" }} />,
      ),
    );
    expect(container.textContent).toContain(i18n.t("progress.cpu_subtitle"));
    act(() => root.render(<ProgressPanel {...base} step={2} current={{ stage: "download", started_at: 1, percent: 42 }} />));
    expect(container.textContent).toContain("42%");
  });

  it("tells cloud users they may close the page, and shows the queue position", () => {
    setPlatform({ caps: CAPS.cloud } as Platform);
    act(() => root.render(<ProgressPanel {...base} step={2} current={null} queuePosition={2} />));
    expect(container.textContent).toContain(i18n.t("progress.keep_open_none"));
    expect(container.textContent).toContain(i18n.t("progress.queue", { n: 2 }));
  });

  it("asks before cancelling", () => {
    const onCancel = vi.fn();
    act(() => root.render(<ProgressPanel {...base} step={2} current={null} onCancel={onCancel} />));
    const button = (label: string) => [...document.querySelectorAll("button")].find((b) => b.textContent === label)!;
    act(() => button(i18n.t("progress.cancel")).click());
    expect(onCancel).not.toHaveBeenCalled();
    act(() => button(i18n.t("progress.cancel_keep")).click());
    expect(onCancel).not.toHaveBeenCalled();
    act(() => button(i18n.t("progress.cancel")).click());
    act(() => button(i18n.t("progress.cancel_confirm")).click());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

In `src/locales/plainWords.test.ts` change `MAIN_NAMESPACES` to `["nav", "create", "progress", "moment", "result", "projects", "banner", "toast"]`.

Run: `npx vitest run src/components/create/ProgressPanel.test.tsx src/locales` → FAIL (module missing; plain words lists the old `toast.*` texts with emoji and "API Key"/"prompt"/"re-render").

- [ ] **Step 2: `useNow` and `ProgressPanel`**

`src/hooks/useNow.ts`:

```ts
import { useEffect, useState } from "react";

/** The time, updated once a second (running timers). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
```

`src/components/create/ProgressPanel.tsx`:

```tsx
import React, { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Circle, CircleCheck, LoaderCircle, X } from "lucide-react";
import { useNow } from "../../hooks/useNow";
import { deviceNotes, progressRows, stagesFor, type LiveStage, type ProgressRow } from "../../lib/progress";
import { formatDuration } from "../../lib/timings";
import { platform } from "../../platform";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";

export interface ProgressPanelProps {
  step: 2 | 3 | 4;
  autoAi: boolean;
  /** Face tracking runs (vertical/square with "Ikuti wajah"). */
  tracking: boolean;
  /** The video came from this device or Drive: "download" is only a copy. */
  localSource: boolean;
  current: LiveStage | null;
  timings: unknown;
  queuePosition: number | null;
  onCancel: () => void;
}

const TITLE: Record<2 | 3 | 4, string> = { 2: "progress.title_prepare", 3: "progress.title_choose", 4: "progress.title_make" };

/** Steps 2 and 4 (spec 4.3): part of the page, not an overlay, so the menu stays usable. */
export const ProgressPanel: React.FC<ProgressPanelProps> = ({
  step, autoAi, tracking, localSource, current, timings, queuePosition, onCancel,
}) => {
  const { t } = useTranslation();
  const headingId = useId();
  const now = useNow();
  const [confirming, setConfirming] = useState(false);

  // Count up from the backend's elapsed time between two polls (the phone's clock may differ).
  const [base, setBase] = useState({ at: Date.now(), elapsed: 0 });
  useEffect(() => {
    setBase({ at: Date.now(), elapsed: current?.elapsed_seconds ?? 0 });
  }, [current?.stage, current?.elapsed_seconds, current?.clip]);

  const stages = stagesFor(step, { autoAi, tracking });
  const rows = progressRows(stages, timings, current);
  const notes = deviceNotes(current, timings, stages);
  const units = { hour: t("timing.unit_hour"), minute: t("timing.unit_minute"), second: t("timing.unit_second") };

  const label = (row: ProgressRow) => {
    const name = row.stage === "download" && localSource ? t("progress.stage_copy") : t(`timing.stage_${row.stage}`, { defaultValue: row.stage });
    if (row.clip === null) return name;
    const clip = row.clipsTotal ? t("progress.clip_of", { clip: row.clip, total: row.clipsTotal }) : t("progress.clip_n", { clip: row.clip });
    return `${name} ${clip}`;
  };

  const detail = (row: ProgressRow) => {
    if (row.state === "done" && row.seconds !== null) return t("progress.took", { time: formatDuration(row.seconds, units) });
    if (row.state !== "running") return "";
    const elapsed = base.elapsed + Math.max(0, (now - base.at) / 1000);
    const parts = [t("progress.running_for", { time: formatDuration(elapsed, units) })];
    if (row.percent !== null) parts.unshift(`${Math.round(row.percent)}%`);
    return parts.join(" · ");
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-card border border-border bg-bg-secondary p-4 md:p-6">
      <div className="flex items-center gap-3">
        {/* The spinner says "working"; prefers-reduced-motion stops it (index.css). */}
        <LoaderCircle className="h-6 w-6 shrink-0 animate-spin text-accent" aria-hidden="true" />
        <h2 id={headingId} className="text-section-title text-text-primary">{t(TITLE[step])}</h2>
      </div>

      {queuePosition ? (
        <p role="status" className="text-body text-text-primary">{t("progress.queue", { n: queuePosition })}</p>
      ) : null}

      <ol className="flex flex-col gap-1" aria-live="polite">
        {rows.map((row) => (
          <li key={row.stage} className="flex min-h-[44px] items-start gap-3 py-1">
            {row.state === "done" ? (
              <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-label={t("progress.state_done")} />
            ) : row.state === "running" ? (
              <Circle className="mt-0.5 h-5 w-5 shrink-0 fill-accent text-accent" aria-label={t("progress.state_running")} />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-text-secondary" aria-label={t("progress.state_todo")} />
            )}
            <div className="min-w-0">
              <p className={`text-body ${row.state === "todo" ? "text-text-secondary" : "text-text-primary"} ${row.state === "running" ? "font-semibold" : ""}`}>
                {label(row)}
              </p>
              {detail(row) && <p className="text-caption text-text-secondary">{detail(row)}</p>}
            </div>
          </li>
        ))}
      </ol>

      {notes.map((note) => (
        <p key={note} className="rounded-card border border-border bg-bg-surface p-3 text-body text-text-primary">
          {t(`progress.${note}`)}
        </p>
      ))}

      <p className="text-body text-text-secondary">{t(`progress.keep_open_${platform().caps.keepOpen}`)}</p>

      <Button variant="outline" icon={X} className="self-start" onClick={() => setConfirming(true)}>
        {t("progress.cancel")}
      </Button>
      <ConfirmDialog
        isOpen={confirming}
        title={t("progress.cancel_title")}
        message={t("progress.cancel_body")}
        confirmLabel={t("progress.cancel_confirm")}
        cancelLabel={t("progress.cancel_keep")}
        isDestructive
        onConfirm={() => {
          setConfirming(false);
          onCancel();
        }}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
};
```

- [ ] **Step 3: `useClipJobs`**

In `src/hooks/useClipJobs.ts`:
- import `asLiveStage, type LiveStage` from `../lib/progress`.
- New state after `historyVersion`:

```ts
  // Spec 4.3/4.4: the stage running now and the job's live metadata (finished stage timings).
  const [current, setCurrent] = useState<LiveStage | null>(null);
  const [liveMeta, setLiveMeta] = useState<Record<string, unknown> | null>(null);
  // The running job started at clip making (answer sent, re-render): "no stage yet" means step 4.
  const [makePhase, setMakePhase] = useState(false);
```

- In the polling `else` ("In progress") branch add `setCurrent(asLiveStage(job.current));` and `setLiveMeta(job.metadata || null);`.
- In the `DONE`, `ERROR`, `CANCELLED` and `AWAITING_MANUAL` branches and in `cancelJob` add `setCurrent(null);`. In `DONE` also `setLiveMeta(job.metadata || null);`.
- `handleGenerate` and `handleManualGenerate`, next to `setJobOrigin("workspace")`: `setMakePhase(false); setLiveMeta(null);`.
- `handleRerender`, `handleRerenderClip`, `startManualResumePolling`: `setMakePhase(true); setLiveMeta(null);`. `handleRerunAI`, `handleResumeJob`: `setMakePhase(false); setLiveMeta(null);`.
- `resetJobState`: add `setCurrent(null); setLiveMeta(null); setMakePhase(false);`.
- Replace every `t('toast.clip_failed', { num: '', msg: t('toast.X', '…') })` with `t('toast.clip_failed', { msg: t('toast.X') })`, and drop the default-text second argument of every other `t('toast.…', '…')` call in this file (the keys exist in both locale files; defaults carried emoji).
- Return additionally `current, liveMeta, makePhase, jobOrigin`.

`src/App.tsx`: take `current, liveMeta, makePhase, jobOrigin` from `useClipJobs` and add them to `contextValue`.

- [ ] **Step 4: Page, bar, layout**

`src/pages/CreatePage.tsx`: import `ProgressPanel` and `MANUAL_PROVIDER`; after the `{finished && …}` block add (and keep partial clips visible while clips are being made):

```tsx
      {flow.running && step !== 1 && (
        <ProgressPanel
          step={step as 2 | 3 | 4}
          autoAi={effectiveProvider(caps, ctx.aiMode, ctx.provider) !== MANUAL_PROVIDER}
          tracking={ctx.choices.trackingMode === "auto" && ctx.choices.aspectRatio !== "16:9"}
          localSource={!!chosenFile}
          current={ctx.current}
          timings={ctx.liveMeta?.timings}
          queuePosition={ctx.queuePosition}
          onCancel={ctx.cancelJob}
        />
      )}
```

`src/components/nav/RunningBar.tsx`:

```tsx
import React, { useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppContext } from "../../App";
import { ROUTES } from "../../lib/routes";

/** A job runs and this page is not "Buat klip": say so, and link to the progress. */
export const RunningBar: React.FC = () => {
  const { t } = useTranslation();
  const ctx = useContext(AppContext);
  const { pathname } = useLocation();
  if (!ctx?.isRunning || pathname === ROUTES.create) return null;
  return (
    <div role="status" className="border-b border-border bg-accent-muted px-4 md:px-8">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <p className="text-body text-text-primary">{t("progress.running_bar")}</p>
        <Link to={ROUTES.create} className="inline-flex min-h-[44px] items-center text-body font-semibold text-accent underline">
          {t("progress.running_bar_link")}
        </Link>
      </div>
    </div>
  );
};
```

`src/layouts/AppLayout.tsx`: remove `BusyOverlay` (import and element); add `<RunningBar />` right after `<BackendBanner />`. Delete `src/components/BusyOverlay.tsx`.

- [ ] **Step 5: Texts**

Add with `node scripts/add-locale-keys.mjs`:

```json
{
  "id": { "progress": {
    "title_prepare": "Menyiapkan video",
    "title_choose": "Memilih momen terbaik",
    "title_make": "Membuat klip",
    "queue": "Menunggu giliran. Urutan ke-{{n}}.",
    "stage_copy": "Menyiapkan video",
    "clip_of": "{{clip}} dari {{total}}",
    "clip_n": "ke-{{clip}}",
    "took": "selesai dalam {{time}}",
    "running_for": "berjalan {{time}}",
    "state_done": "Selesai",
    "state_running": "Sedang berjalan",
    "state_todo": "Belum mulai",
    "cpu_subtitle": "Subtitle dibuat dengan prosesor, bukan GPU. Untuk video panjang bisa jauh lebih lama.",
    "cpu_render": "Klip dibuat dengan prosesor, bukan GPU. Untuk video panjang bisa jauh lebih lama.",
    "keep_open_app": "Jangan tutup aplikasi sampai selesai.",
    "keep_open_window": "Jangan tutup jendela Auto Clipper Web.",
    "keep_open_none": "Halaman ini boleh ditutup. Proses tetap jalan selama Colab menyala; lihat hasilnya di Riwayat.",
    "cancel": "Batalkan",
    "cancel_title": "Batalkan proses ini?",
    "cancel_body": "Klip yang belum jadi tidak akan dibuat. Proyek ini tetap ada di Riwayat.",
    "cancel_confirm": "Ya, batalkan",
    "cancel_keep": "Lanjutkan proses",
    "running_bar": "Ada proses yang sedang berjalan.",
    "running_bar_link": "Lihat progres"
  }, "toast": {
    "starting_resume": "Melanjutkan proses.",
    "resume_fail": "Proses belum bisa dilanjutkan."
  } },
  "en": { "progress": {
    "title_prepare": "Preparing the video",
    "title_choose": "Picking the best moments",
    "title_make": "Making the clips",
    "queue": "Waiting for a turn. Number {{n}} in line.",
    "stage_copy": "Preparing the video",
    "clip_of": "{{clip}} of {{total}}",
    "clip_n": "no. {{clip}}",
    "took": "took {{time}}",
    "running_for": "running for {{time}}",
    "state_done": "Done",
    "state_running": "Running",
    "state_todo": "Not started",
    "cpu_subtitle": "Subtitles are made on the processor, not the GPU. Long videos can take much longer.",
    "cpu_render": "Clips are made on the processor, not the GPU. Long videos can take much longer.",
    "keep_open_app": "Keep the app open until it finishes.",
    "keep_open_window": "Keep the Auto Clipper Web window open.",
    "keep_open_none": "You can close this page. The work continues while Colab is running; see the result in History.",
    "cancel": "Cancel",
    "cancel_title": "Cancel this process?",
    "cancel_body": "Clips that are not finished will not be made. The project stays in History.",
    "cancel_confirm": "Yes, cancel",
    "cancel_keep": "Keep going",
    "running_bar": "A job is running.",
    "running_bar_link": "See progress"
  }, "toast": {
    "starting_resume": "Continuing.",
    "resume_fail": "Could not continue."
  } }
}
```

("Membuat klip 3 dari 10" is `timing.stage_render` + `progress.clip_of`.)

Then replace the existing `toast.*` values (the add script refuses changed texts). Run once from the repo root:

```bash
node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";
const texts = {
  id: {
    clip_failed: "Belum bisa mulai: {{msg}}", title_required: "Nama proyek belum diisi.",
    api_key_req: "Kunci API belum diisi. Isi di Pengaturan, bagian Lanjutan.",
    done_partial: "Selesai. {{count}} klip jadi, {{failed}} gagal.", done_all: "Selesai. {{count}} klip siap diunduh.",
    os_notify_title: "Auto Clipper selesai", cancelled: "Proses dibatalkan.", url_empty: "Link video belum diisi.",
    local_file_empty: "File video belum dipilih.", uploading: "Mengunggah video…", starting_bg: "Mulai memproses video.",
    starting_rerender: "Mulai membuat ulang klip.", rerender_fail: "Pembuatan ulang klip belum bisa dimulai.",
    starting_ai_correct: "Mulai memilih ulang momen dengan AI.", ai_correct_fail: "Pemilihan ulang momen belum bisa dimulai.",
    custom_config_req: "Alamat dan nama model untuk AI kustom belum diisi. Isi di Pengaturan, bagian Lanjutan.",
    manual_prompt_ready: "Video siap. Lanjutkan di langkah Pilih momen."
  },
  en: {
    clip_failed: "Cannot start yet: {{msg}}", title_required: "The project name is empty.",
    api_key_req: "The API key is empty. Add it in Settings, Advanced.",
    done_partial: "Done. {{count}} clips made, {{failed}} failed.", done_all: "Done. {{count}} clips are ready to download.",
    os_notify_title: "Auto Clipper is done", cancelled: "Cancelled.", url_empty: "The video link is empty.",
    local_file_empty: "No video file chosen yet.", uploading: "Uploading the video…", starting_bg: "Started processing the video.",
    starting_rerender: "Started making the clips again.", rerender_fail: "Could not start making the clips again.",
    starting_ai_correct: "Started picking moments again with AI.", ai_correct_fail: "Could not start picking moments again.",
    custom_config_req: "The custom AI address and model name are empty. Add them in Settings, Advanced.",
    manual_prompt_ready: "The video is ready. Continue at Pick moments."
  }
};
for (const lang of ["id", "en"]) {
  const file = `src/locales/${lang}.json`;
  const data = JSON.parse(readFileSync(file, "utf8"));
  Object.assign(data.toast, texts[lang]);
  writeFileSync(file, JSON.stringify(data, null, 2));
}'
```

- [ ] **Step 6: Run all checks and look at it**

`npx vitest run` → 214 passing (210 + 4; record the total). `npx oxlint src` 0 errors. `npm run build`, `npm run build:cloud` exit 0. With a short real video through `backend.main --web`: step 2 lists Mengunduh video (with %), Mengambil suara dari video, Membuat subtitle, each ticked with its time; on a machine without a GPU the processor note appears; the menu stays usable during the job and Riwayat shows the "Lihat progres" bar; Batalkan asks first; at 360 px nothing overflows. No message ever changes because of time alone (search `ProgressPanel.tsx` for `setTimeout`/time thresholds: none).

- [ ] **Step 7: Log and commit**

PROGRESS-LOG entry; ledger `Task 10: complete (...)`; roadmap `T2.x Teks layar proses (BusyOverlay) jujur` ticked with the hash.

```bash
git add -A src/hooks src/components/create src/components/nav src/components/BusyOverlay.tsx src/pages/CreatePage.tsx src/layouts/AppLayout.tsx src/App.tsx src/locales tasks/PROGRESS-LOG.md tasks/sp2-ledger.md tasks/roadmap-todo.md
git commit -m "feat(sp2): honest in-page progress screen replaces the busy overlay

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
