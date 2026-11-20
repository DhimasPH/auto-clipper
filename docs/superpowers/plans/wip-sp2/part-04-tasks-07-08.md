### Task 7: Preflight notices and blocking card

Spec 4.4 (last bullet) and spec 1 ("Hasil pemeriksaan awal SP0 belum ditampilkan"). The create screen calls `GET /api/preflight` when it opens and again when the connection comes back. `warn` results show as small notes; a `block` result shows as an error card with "Periksa lagi", and Mulai stays off until a check passes.

**Files:**
- Create: `src/lib/preflight.ts`, `src/lib/preflight.test.ts`
- Create: `src/hooks/usePreflight.ts`, `src/hooks/usePreflight.test.tsx`
- Create: `src/components/create/PreflightNotices.tsx`, `src/components/create/PreflightNotices.test.tsx`
- Modify: `src/locales/{id,en}.json` (`create.recheck`, `create.notes_label`)

**Interfaces:**
- Consumes: `GET /api/preflight` → `{status, checks: [{id, level: "ok"|"warn"|"block", title, message, title_en, message_en, code?, technical?}]}` (`backend/main.py api_preflight`); `ErrorCard`; `localizedText`, `toLang` (`src/lib/errorInfo.ts`); `JobWarning`, `ErrorInfo` (`src/types/errorInfo.ts`).
- Produces:
  - `splitPreflight(checks: unknown): { notes: JobWarning[]; blockers: ErrorInfo[] }`, `blockerInfo(check: JobWarning): ErrorInfo` (`src/lib/preflight.ts`)
  - `usePreflight(connected: boolean): { state: "loading" | "ready" | "unavailable"; notes: JobWarning[]; blockers: ErrorInfo[]; recheck: () => void }`
  - `<PreflightNotices notes blockers checking onRecheck />`

- [ ] **Step 1: Write the failing tests**

`src/lib/preflight.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { blockerInfo, splitPreflight } from "./preflight";

const check = (id: string, level: string, extra: Record<string, string> = {}) => ({
  id, level, title: `t-${id}`, message: `m-${id}`, title_en: `te-${id}`, message_en: `me-${id}`, ...extra,
});

describe("splitPreflight (spec 4.4)", () => {
  it("keeps warnings as notes and blocks as error cards, and drops passed checks", () => {
    const result = splitPreflight([check("disk", "ok"), check("gpu", "warn"), check("ffmpeg", "block", { code: "FFMPEG_MISSING", technical: "not on PATH" })]);
    expect(result.notes.map((n) => n.id)).toEqual(["gpu"]);
    expect(result.blockers).toEqual([
      { code: "FFMPEG_MISSING", title: "t-ffmpeg", message: "m-ffmpeg", title_en: "te-ffmpeg", message_en: "me-ffmpeg", actions: [], technical: "not on PATH" },
    ]);
  });

  it("survives a missing or odd answer", () => {
    expect(splitPreflight(undefined)).toEqual({ notes: [], blockers: [] });
    expect(splitPreflight([null, "x", 3])).toEqual({ notes: [], blockers: [] });
  });

  it("names a blocker by its check id when it has no error code", () => {
    expect(blockerInfo(check("drive", "block")).code).toBe("drive");
  });
});
```

`src/hooks/usePreflight.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePreflight } from "./usePreflight";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let latest: ReturnType<typeof usePreflight>;
function Probe({ connected }: { connected: boolean }) {
  latest = usePreflight(connected);
  return null;
}

describe("usePreflight", () => {
  let root: Root;

  beforeEach(() => {
    root = createRoot(document.createElement("div"));
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.restoreAllMocks();
  });

  it("checks on open, again when the connection comes back, and on request", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: { checks: [{ id: "gpu", level: "warn", title: "t", message: "m" }] } });
    await act(async () => root.render(<Probe connected />));
    expect(get).toHaveBeenCalledTimes(1);
    expect(String(get.mock.calls[0][0])).toMatch(/\/api\/preflight$/);
    expect(latest.state).toBe("ready");
    expect(latest.notes).toHaveLength(1);

    await act(async () => root.render(<Probe connected={false} />));
    await act(async () => root.render(<Probe connected />));
    expect(get).toHaveBeenCalledTimes(2);

    await act(async () => latest.recheck());
    expect(get).toHaveBeenCalledTimes(3);
  });

  it("does not block the start when the check itself cannot run", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("offline"));
    await act(async () => root.render(<Probe connected />));
    expect(latest.state).toBe("unavailable");
    expect(latest.blockers).toEqual([]);
  });
});
```

`src/components/create/PreflightNotices.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { CAPS, setPlatform, type Platform } from "../../platform";
import { PreflightNotices } from "./PreflightNotices";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const blocker = { code: "FFMPEG_MISSING", title: "FFmpeg tidak ada", message: "Pasang ulang.", title_en: "", message_en: "", actions: [], technical: "" };
const note = { id: "gpu", level: "warn", title: "Tanpa GPU", message: "Proses lebih lama." };

describe("PreflightNotices", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setPlatform({ caps: CAPS.desktop } as Platform);
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    setPlatform(null);
  });

  it("shows a blocker as an error card with a check-again button", () => {
    const onRecheck = vi.fn();
    act(() => root.render(<PreflightNotices notes={[]} blockers={[blocker]} checking={false} onRecheck={onRecheck} />));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("FFmpeg tidak ada");
    const button = [...container.querySelectorAll("button")].find((b) => b.textContent === i18n.t("create.recheck"))!;
    act(() => button.click());
    expect(onRecheck).toHaveBeenCalledTimes(1);
  });

  it("shows a warning as a small note and nothing when all is fine", () => {
    act(() => root.render(<PreflightNotices notes={[note]} blockers={[]} checking={false} onRecheck={vi.fn()} />));
    expect(container.textContent).toContain("Tanpa GPU");
    expect(container.querySelector('[role="alert"]')).toBeNull();
    act(() => root.render(<PreflightNotices notes={[]} blockers={[]} checking={false} onRecheck={vi.fn()} />));
    expect(container.innerHTML).toBe("");
  });
});
```

Run: `npx vitest run src/lib/preflight.test.ts src/hooks/usePreflight.test.tsx src/components/create` → FAIL (modules missing).

- [ ] **Step 2: Implement**

`src/lib/preflight.ts`:

```ts
import type { ErrorInfo, JobWarning } from "../types/errorInfo";

// GET /api/preflight results (backend/preflight.py) for the create screen (spec 4.4):
// "warn" becomes a small note, "block" an error card that keeps Mulai off.

export interface PreflightSplit {
  notes: JobWarning[];
  blockers: ErrorInfo[];
}

export function blockerInfo(check: JobWarning): ErrorInfo {
  return {
    code: check.code || check.id,
    title: check.title,
    message: check.message,
    title_en: check.title_en || "",
    message_en: check.message_en || "",
    actions: [],
    technical: check.technical || "",
  };
}

export function splitPreflight(checks: unknown): PreflightSplit {
  const result: PreflightSplit = { notes: [], blockers: [] };
  if (!Array.isArray(checks)) return result;
  for (const item of checks) {
    if (!item || typeof item !== "object") continue;
    const check = item as JobWarning;
    if (check.level === "warn") result.notes.push(check);
    else if (check.level === "block") result.blockers.push(blockerInfo(check));
  }
  return result;
}
```

`src/hooks/usePreflight.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { API_URL } from "../platform/backendUrl";
import { splitPreflight, type PreflightSplit } from "../lib/preflight";

export type PreflightState = "loading" | "ready" | "unavailable";

/** Runs the environment check when the create screen opens, when the connection comes back, and on request. */
export function usePreflight(connected: boolean) {
  const [state, setState] = useState<PreflightState>("loading");
  const [split, setSplit] = useState<PreflightSplit>({ notes: [], blockers: [] });
  const [round, setRound] = useState(0);
  const recheck = useCallback(() => setRound((n) => n + 1), []);

  useEffect(() => {
    if (!connected) return;
    let active = true;
    setState("loading");
    axios
      .get(`${API_URL}/api/preflight`, { timeout: 30000 })
      .then((res) => {
        if (!active) return;
        setSplit(splitPreflight(res.data?.checks));
        setState("ready");
      })
      .catch((err) => {
        if (!active) return;
        // The check could not run (backend gone): the connection banner explains it; nothing is blocked here.
        console.error("Preflight check failed:", err);
        setSplit({ notes: [], blockers: [] });
        setState("unavailable");
      });
    return () => {
      active = false;
    };
  }, [connected, round]);

  return { state, ...split, recheck };
}
```

`src/components/create/PreflightNotices.tsx`:

```tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import type { ErrorInfo, JobWarning } from "../../types/errorInfo";
import { localizedText, toLang } from "../../lib/errorInfo";
import { ErrorCard } from "../ErrorCard";
import { Button } from "../ui/Button";

interface PreflightNoticesProps {
  notes: JobWarning[];
  blockers: ErrorInfo[];
  checking: boolean;
  onRecheck: () => void;
}

/** Spec 4.4: notes above the start button; a blocking problem as an error card with "Periksa lagi". */
export const PreflightNotices: React.FC<PreflightNoticesProps> = ({ notes, blockers, checking, onRecheck }) => {
  const { t, i18n } = useTranslation();
  if (notes.length === 0 && blockers.length === 0) return null;
  const lang = toLang(i18n.language);
  return (
    <div className="flex flex-col gap-3">
      {blockers.map((info) => (
        <ErrorCard key={info.code} info={info} announce>
          <Button icon={RefreshCw} loading={checking} onClick={onRecheck}>
            {t("create.recheck")}
          </Button>
        </ErrorCard>
      ))}
      {notes.length > 0 && (
        <ul aria-label={t("create.notes_label")} className="flex flex-col gap-2">
          {notes.map((note) => {
            const { title, message } = localizedText(note, lang);
            return (
              <li key={note.id} className="rounded-card border border-border bg-bg-surface p-3">
                <p className="text-body font-semibold text-text-primary">{title}</p>
                {message && <p className="text-body text-text-primary">{message}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
```

Texts (`node scripts/add-locale-keys.mjs`):

```json
{
  "id": { "create": { "recheck": "Periksa lagi", "notes_label": "Catatan sebelum mulai" } },
  "en": { "create": { "recheck": "Check again", "notes_label": "Notes before you start" } }
}
```

- [ ] **Step 3: Run the tests and checks**

`npx vitest run src/lib/preflight.test.ts src/hooks/usePreflight.test.tsx src/components/create` → PASS (3 + 2 + 2). Whole suite → 190 passing (record the total). `npx oxlint src` 0 errors (the `set-state-in-effect` warning in `usePreflight` is accepted, like `LocalGate`). `npm run build` exit 0.

- [ ] **Step 4: Log and commit**

PROGRESS-LOG entry; ledger `Task 7: complete (...)`.

```bash
git add src/lib/preflight.ts src/lib/preflight.test.ts src/hooks/usePreflight.ts src/hooks/usePreflight.test.tsx src/components/create src/locales tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): preflight notes and blocking card for the create screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Step 1 screen (`CreatePage`, `VideoStep`, `ClipOptions`, `pickVideo()`)

Spec 4.2 step 1, 4.7 (`pickVideo()` used, SP1 review M6) and 5 (field validation under the field). One page replaces Workspace and Manual AI Editor: a step indicator, the video choice (link checked as you type, "Pilih file video" through `platform().pickVideo()`, "Pilih dari Google Drive" on cloud), the always-visible "Bentuk klip", the collapsed "Atur tampilan klip" with remembered values, preflight notes, and Mulai. The provider is manual AI unless API key mode is on (Spec gap 12); the project name is made automatically when left empty (Spec gap 5). Steps 2–4 still use the old overlay and the History redirect until Tasks 10 and 11.

**Files:**
- Create: `src/components/create/StepIndicator.tsx`, `VideoStep.tsx`, `ClipOptions.tsx`, `VideoStep.test.tsx`, `ClipOptions.test.tsx`
- Create: `src/pages/CreatePage.tsx`
- Modify: `src/App.tsx` (clip choices state, `aiMode`, index route), `src/hooks/useUserSettings.ts` (`aiMode`), `src/hooks/useClipJobs.ts` (`handleGenerate(overrideProvider?, overrideTitle?)`)
- Delete: `src/pages/WorkspacePage.tsx`, `src/pages/ManualAIEditorPage.tsx`, `src/components/GenerateForm.tsx`
- Modify: `src/locales/{id,en}.json` (`create.*`)

**Interfaces:**
- Consumes: `activeStep`, `stepStates`, `linkProblem`, `autoProjectTitle`, `effectiveProvider`, `FlowState`, `FlowStep`, `VideoSourceName`, `AiMode` (Task 6); `ClipChoices`, `ShapeValue`, `loadClipChoices`, `saveClipChoices`, `MAX_CLIP_OPTIONS` (Task 6); `usePreflight`, `PreflightNotices` (Task 7); `useBackendStatus` (Task 5); `platform().pickVideo()`; `fileName` (`src/platform/paths.ts`); `ErrorCard`, `useErrorActions`, `ClipsResult`.
- Produces:
  - `<StepIndicator states={StepState[]} />`
  - `<VideoStep link onLinkChange chosenFile onClearFile onPickFile onPickDrive? shape onShapeChange pickButtonRef? />`
  - `<ClipOptions choices onChange={(patch: Partial<ClipChoices>) => void} title onTitleChange quality onQualityChange showQuality hasPexelsKey />`
  - App context (consumed by Tasks 10–14): `choices`, `patchChoices(patch)`, `aiMode`, `setAiMode(mode)`, plus the old setters (`setAspectRatio`, `setBurnSubtitles`, `setCanvasConfig`, `setSubtitleConfig`, `setCaptionStyle`, `setTrackingMode`, `setEnableHook`, `setEnableBroll`, `setMaxClips`, `setIsGamingVideo`) now writing into `choices`.
  - `useClipJobs.handleGenerate(overrideProvider?: string, overrideTitle?: string)`.
  - `CreatePage` reads, when present, `ctx.current` (Task 10), `ctx.awaiting` (Task 11), `ctx.makePhase` (Task 10), `ctx.resultJobId` (Task 12); absent values count as empty.

- [ ] **Step 1: Write the failing tests**

`src/components/create/VideoStep.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { VideoStep } from "./VideoStep";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const base = {
  link: "", onLinkChange: vi.fn(), chosenFile: null, onClearFile: vi.fn(), onPickFile: vi.fn(),
  shape: "9:16" as const, onShapeChange: vi.fn(),
};

describe("VideoStep (spec 4.2 step 1)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => act(() => root.unmount()));

  const render = (props: Partial<typeof base> & { onPickDrive?: () => void }) =>
    act(() => root.render(<VideoStep {...base} {...props} />));
  const button = (label: string) => [...container.querySelectorAll("button")].find((b) => b.textContent === label)!;

  it("says under the field when a link cannot be used", () => {
    render({ link: "https://vimeo.com/1" });
    const input = container.querySelector("input[type='url']")!;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(input.getAttribute("aria-describedby")!)?.textContent ?? container.textContent).toContain(
      i18n.t("create.link_unsupported"),
    );
  });

  it("accepts a YouTube link without a message", () => {
    render({ link: "https://youtu.be/abc" });
    expect(container.textContent).not.toContain(i18n.t("create.link_unsupported"));
    expect(container.querySelector("input[type='url']")!.getAttribute("aria-invalid")).toBeNull();
  });

  it("picks a file, and offers Google Drive only where it exists", () => {
    const onPickFile = vi.fn();
    render({ onPickFile });
    act(() => button(i18n.t("create.pick_file")).click());
    expect(onPickFile).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain(i18n.t("create.pick_drive"));
    const onPickDrive = vi.fn();
    render({ onPickDrive });
    act(() => button(i18n.t("create.pick_drive")).click());
    expect(onPickDrive).toHaveBeenCalledTimes(1);
  });

  it("shows the chosen file instead of the link box, with a way to change it", () => {
    const onClearFile = vi.fn();
    render({ chosenFile: "podcast.mp4", onClearFile });
    expect(container.textContent).toContain(i18n.t("create.chosen_file", { name: "podcast.mp4" }));
    expect(container.querySelector("input[type='url']")).toBeNull();
    act(() => button(i18n.t("create.clear_file")).click());
    expect(onClearFile).toHaveBeenCalledTimes(1);
  });

  it("offers the three clip shapes, vertical first", () => {
    const onShapeChange = vi.fn();
    render({ onShapeChange });
    const radios = [...container.querySelectorAll<HTMLInputElement>("input[type='radio']")];
    expect(radios.map((r) => r.value)).toEqual(["9:16", "1:1", "16:9"]);
    expect(radios[0].checked).toBe(true);
    act(() => radios[1].click());
    expect(onShapeChange).toHaveBeenCalledWith("1:1");
  });
});
```

`src/components/create/ClipOptions.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { DEFAULT_CLIP_CHOICES } from "../../lib/clipChoices";
import { CAPS, setPlatform, type Platform } from "../../platform";
import { ClipOptions } from "./ClipOptions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const props = {
  choices: DEFAULT_CLIP_CHOICES, onChange: vi.fn(), title: "", onTitleChange: vi.fn(),
  quality: "best", onQualityChange: vi.fn(), showQuality: true, hasPexelsKey: false,
};

describe("ClipOptions (Atur tampilan klip)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    setPlatform(null);
  });

  it("is closed by default and holds the advanced choices", () => {
    setPlatform({ caps: CAPS.desktop } as Platform);
    act(() => root.render(<ClipOptions {...props} />));
    const details = container.querySelector("details")!;
    expect(details.open).toBe(false);
    expect(details.querySelector("summary")!.textContent).toBe(i18n.t("create.options"));
    expect(container.textContent).toContain(i18n.t("create.hook"));
    expect(container.textContent).toContain(i18n.t("create.max_clips"));
  });

  it("hides B-roll where there are no API keys", () => {
    setPlatform({ caps: CAPS.cloud } as Platform);
    act(() => root.render(<ClipOptions {...props} />));
    expect(container.textContent).not.toContain(i18n.t("create.broll"));
  });
});
```

Run: `npx vitest run src/components/create` → the new files FAIL (modules missing).

- [ ] **Step 2: `aiMode` setting and `handleGenerate` title**

`src/hooks/useUserSettings.ts`: import `type AiMode` from `../lib/createFlow`; add

```ts
  const [aiMode, setAiMode] = useState<AiMode>(() => (localStorage.getItem("ac_ai_mode") === "auto" ? "auto" : "manual"));
```

an effect `useEffect(() => { localStorage.setItem("ac_ai_mode", aiMode); }, [aiMode]);`, and return `aiMode, setAiMode`.

`src/hooks/useClipJobs.ts`, `handleGenerate`:
- signature `const handleGenerate = async (overrideProvider?: string, overrideTitle?: string) => {`
- add as the first line `const title = (overrideTitle ?? p.title ?? "").trim();`
- the title check becomes `if (!title) {` (same toast)
- the request body uses `title,` instead of `title: p.title,`.

- [ ] **Step 3: Step indicator**

`src/components/create/StepIndicator.tsx`:

```tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import type { StepState } from "../../lib/createFlow";

const STEP_KEYS = ["create.step_video", "create.step_prepare", "create.step_choose", "create.step_clips"];

/** 1 Video → 2 Siapkan → 3 Pilih momen → 4 Klip (spec 4.2). On a phone only the active step shows its name. */
export const StepIndicator: React.FC<{ states: StepState[] }> = ({ states }) => {
  const { t } = useTranslation();
  return (
    <ol aria-label={t("create.steps_label")} className="flex items-center gap-2">
      {STEP_KEYS.map((key, i) => {
        const state = states[i];
        return (
          <li key={key} aria-current={state === "active" ? "step" : undefined} className="flex min-w-0 items-center gap-2">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-label ${
                state === "active"
                  ? "bg-accent text-on-accent"
                  : state === "done"
                    ? "bg-accent-muted text-accent"
                    : "border border-border-active text-text-secondary"
              }`}
            >
              {state === "done" ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
            </span>
            <span className={`text-label ${state === "active" ? "font-semibold text-text-primary" : "sr-only sm:not-sr-only text-text-secondary"}`}>
              {t(key)}
              {state === "done" && <span className="sr-only">{t("create.step_done_sr")}</span>}
            </span>
            {i < STEP_KEYS.length - 1 && <span aria-hidden="true" className="h-px w-4 shrink-0 bg-border-active sm:w-6" />}
          </li>
        );
      })}
    </ol>
  );
};
```

- [ ] **Step 4: Video step**

`src/components/create/VideoStep.tsx`:

```tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { FileVideo, HardDrive } from "lucide-react";
import { linkProblem } from "../../lib/createFlow";
import type { ShapeValue } from "../../lib/clipChoices";
import { Button } from "../ui/Button";
import { InputGroup } from "../ui/InputGroup";

const SHAPES: { value: ShapeValue; key: string; box: string }[] = [
  { value: "9:16", key: "create.shape_vertical", box: "h-6 w-[14px]" },
  { value: "1:1", key: "create.shape_square", box: "h-5 w-5" },
  { value: "16:9", key: "create.shape_wide", box: "h-[14px] w-6" },
];

export interface VideoStepProps {
  link: string;
  onLinkChange: (value: string) => void;
  /** Name of the chosen file (upload or Drive), or null when a link is used. */
  chosenFile: string | null;
  onClearFile: () => void;
  onPickFile: () => void;
  /** Cloud only (caps.driveBrowser). */
  onPickDrive?: () => void;
  shape: ShapeValue;
  onShapeChange: (shape: ShapeValue) => void;
  pickButtonRef?: React.Ref<HTMLButtonElement>;
}

/** Step 1 (spec 4.2): which video, and which clip shape. */
export const VideoStep: React.FC<VideoStepProps> = ({
  link, onLinkChange, chosenFile, onClearFile, onPickFile, onPickDrive, shape, onShapeChange, pickButtonRef,
}) => {
  const { t } = useTranslation();
  const problem = link.trim() ? linkProblem(link) : null;

  return (
    <section className="flex flex-col gap-5 rounded-card border border-border bg-bg-secondary p-4 md:p-6">
      {chosenFile ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body text-text-primary break-all">{t("create.chosen_file", { name: chosenFile })}</p>
          <Button variant="outline" onClick={onClearFile}>{t("create.clear_file")}</Button>
        </div>
      ) : (
        <InputGroup
          type="url"
          inputMode="url"
          autoComplete="off"
          label={t("create.link_label")}
          placeholder="https://youtube.com/…"
          value={link}
          onChange={(e) => onLinkChange(e.target.value)}
          error={problem !== null}
          helperText={problem ? t("create.link_unsupported") : undefined}
        />
      )}

      <div className="flex flex-col gap-3">
        <p className="text-label text-text-secondary">{t("create.or")}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Icons tell a file from Google Drive at a glance; the text says it. */}
          <Button ref={pickButtonRef} variant="outline" icon={FileVideo} onClick={onPickFile}>
            {t("create.pick_file")}
          </Button>
          {onPickDrive && (
            <Button variant="outline" icon={HardDrive} onClick={onPickDrive}>
              {t("create.pick_drive")}
            </Button>
          )}
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label text-text-primary">{t("create.shape_label")}</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SHAPES.map(({ value, key, box }) => (
            <label
              key={value}
              className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-card border p-3 ${
                shape === value ? "border-accent bg-accent-muted" : "border-border-active bg-bg-secondary hover:bg-bg-surface"
              }`}
            >
              <input
                type="radio"
                name="clip-shape"
                value={value}
                checked={shape === value}
                onChange={() => onShapeChange(value)}
                className="h-5 w-5 shrink-0 accent-[var(--accent)]"
              />
              {/* The outline shows the shape itself: it is the meaning, not decoration. */}
              <span aria-hidden="true" className={`shrink-0 rounded-sm border-2 border-current text-text-secondary ${box}`} />
              <span className="text-body text-text-primary">{t(key)}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
};
```

- [ ] **Step 5: Clip options**

`src/components/create/ClipOptions.tsx`:

```tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { MAX_CLIP_OPTIONS, type ClipChoices } from "../../lib/clipChoices";
import { platform } from "../../platform";
import { CanvasConfigControls } from "../ui/CanvasConfigControls";
import { InputGroup } from "../ui/InputGroup";
import { Select } from "../ui/Select";
import { SubtitleConfigControls } from "../ui/SubtitleConfigControls";
import { ToggleSwitch } from "../ui/ToggleSwitch";

export interface ClipOptionsProps {
  choices: ClipChoices;
  onChange: (patch: Partial<ClipChoices>) => void;
  title: string;
  onTitleChange: (title: string) => void;
  quality: string;
  onQualityChange: (quality: string) => void;
  /** Download quality only matters for links. */
  showQuality: boolean;
  hasPexelsKey: boolean;
}

const QUALITIES = ["2160p", "1440p", "1080p", "720p", "480p"];

function Row({ label, help, children }: { label?: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t border-border pt-4">
      {label && <p className="text-label text-text-primary">{label}</p>}
      {children}
      {help && <p className="text-caption text-text-secondary">{help}</p>}
    </div>
  );
}

/** "Atur tampilan klip" (spec 4.2): closed by default, good defaults, remembered by App. */
export const ClipOptions: React.FC<ClipOptionsProps> = ({
  choices, onChange, title, onTitleChange, quality, onQualityChange, showQuality, hasPexelsKey,
}) => {
  const { t } = useTranslation();
  const caps = platform().caps;
  const wide = choices.aspectRatio === "16:9";

  return (
    <details className="group rounded-card border border-border bg-bg-secondary">
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 px-4 text-body font-semibold text-text-primary [&::-webkit-details-marker]:hidden">
        {t("create.options")}
        <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="flex flex-col gap-4 px-4 pb-4">
        <InputGroup
          label={t("create.project_name")}
          helperText={t("create.project_name_help")}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
        />

        <Row>
          <ToggleSwitch label={t("create.subtitles")} checked={choices.burnSubtitles} onChange={(v) => onChange({ burnSubtitles: v })} />
          {choices.burnSubtitles && (
            <SubtitleConfigControls
              config={choices.subtitleConfig}
              onChange={(subtitleConfig) => onChange({ subtitleConfig })}
              showModeSwitch={true}
              aspectRatio={choices.aspectRatio}
            />
          )}
        </Row>

        {wide ? (
          <Row>
            <CanvasConfigControls config={choices.canvasConfig} onChange={(canvasConfig) => onChange({ canvasConfig })} showModeSwitch={true} />
          </Row>
        ) : (
          <Row label={t("create.face_label")}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(["auto", "center"] as const).map((mode) => (
                <label key={mode} className="flex min-h-[44px] cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="tracking-mode"
                    checked={choices.trackingMode === mode}
                    onChange={() => onChange({ trackingMode: mode })}
                    className="h-5 w-5 accent-[var(--accent)]"
                  />
                  <span className="text-body">{t(mode === "auto" ? "create.face_follow" : "create.face_center")}</span>
                </label>
              ))}
            </div>
          </Row>
        )}

        <Row help={t("create.hook_help")}>
          <ToggleSwitch label={t("create.hook")} checked={choices.enableHook} onChange={(v) => onChange({ enableHook: v })} />
        </Row>

        {caps.apiKeys && (
          <Row help={t(hasPexelsKey ? "create.broll_help" : "create.broll_needs_key")}>
            <ToggleSwitch
              label={t("create.broll")}
              checked={choices.enableBroll && hasPexelsKey}
              disabled={!hasPexelsKey}
              onChange={(v) => onChange({ enableBroll: v })}
            />
          </Row>
        )}

        {choices.aspectRatio === "9:16" && (
          <Row help={t("create.game_help")}>
            <ToggleSwitch label={t("create.game")} checked={choices.isGamingVideo} onChange={(v) => onChange({ isGamingVideo: v })} />
          </Row>
        )}

        {showQuality && (
          <Select
            label={t("create.quality")}
            value={quality}
            onChange={(e) => onQualityChange(e.target.value)}
            options={[
              { label: t("create.quality_auto"), value: "best" },
              ...QUALITIES.map((q) => ({ label: q === "2160p" ? "2160p (4K)" : q === "1440p" ? "1440p (2K)" : q, value: q })),
            ]}
          />
        )}

        <Select
          label={t("create.max_clips")}
          value={String(choices.maxClips)}
          onChange={(e) => onChange({ maxClips: Number(e.target.value) })}
          options={MAX_CLIP_OPTIONS.map((n) => ({ label: n === 0 ? t("create.max_clips_auto") : String(n), value: String(n) }))}
        />
      </div>
    </details>
  );
};
```

- [ ] **Step 6: The page**

`src/pages/CreatePage.tsx`:

```tsx
import React, { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppContext } from "../App";
import ClipsResult from "../components/ClipsResult";
import { ErrorCard } from "../components/ErrorCard";
import { ClipOptions } from "../components/create/ClipOptions";
import { PreflightNotices } from "../components/create/PreflightNotices";
import { StepIndicator } from "../components/create/StepIndicator";
import { VideoStep } from "../components/create/VideoStep";
import { Button } from "../components/ui/Button";
import { useBackendStatus } from "../hooks/useBackendStatus";
import { useErrorActions } from "../hooks/useErrorActions";
import { usePreflight } from "../hooks/usePreflight";
import { activeStep, autoProjectTitle, effectiveProvider, linkProblem, stepStates, type FlowState, type FlowStep, type VideoSourceName } from "../lib/createFlow";
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
  useEffect(() => {
    if (flow.running) setStoppedAt(step);
  }, [flow.running, step]);
  const failed = ctx.status === "ERROR" && !!ctx.errorMsg;
  const shownStep: FlowStep = failed ? stoppedAt : step;

  // "Unggah file video" on an error card elsewhere: bring the user to the file button.
  useEffect(() => {
    if (!ctx.pendingLocalUpload) return;
    pickButton.current?.focus();
    ctx.clearPendingLocalUpload();
  }, [ctx.pendingLocalUpload]);

  const localPath = ctx.inputType === "url" && ctx.url.startsWith(LOCAL_PREFIX) ? ctx.url.slice(LOCAL_PREFIX.length) : null;
  const chosenFile: string | null =
    ctx.inputType === "local" && ctx.localFile ? ctx.localFile.name : localPath ? fileName(localPath) : null;
  const hasVideo = !!chosenFile || linkProblem(ctx.url) === null;
  const canStart = hasVideo && connected && preflight.blockers.length === 0 && !ctx.isRunning;
  const jobErrorActions = useErrorActions({ jobId: ctx.failedJobId, origin: "workspace" });

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
    ctx.handleGenerate(effectiveProvider(caps, ctx.aiMode, ctx.provider), title);
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-page-title text-text-primary">{t("create.title")}</h1>
      <StepIndicator states={stepStates(shownStep, finished)} />

      {failed && ctx.errorInfo && <ErrorCard info={ctx.errorInfo} handlers={jobErrorActions} announce />}

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
          {ctx.errorMsg && !ctx.errorInfo && (
            <p role="alert" className="text-body text-error break-words">{ctx.errorMsg}</p>
          )}
          <div className="flex flex-col gap-2">
            <Button size="lg" className="w-full sm:w-auto sm:self-start" disabled={!canStart} onClick={start}>
              {t("create.start")}
            </Button>
            {!hasVideo && <p className="text-body text-text-secondary">{t("create.start_hint")}</p>}
          </div>
        </>
      )}

      {finished && !ctx.isRunning && (
        <ClipsResult clips={ctx.clips} status={ctx.status} failedCount={ctx.failedCount} jobId={ctx.resultJobId ?? ""} />
      )}
    </div>
  );
};
```

- [ ] **Step 7: App wiring**

In `src/App.tsx`:
- Imports: remove `WorkspacePage`, `ManualAIEditorPage`, `DEFAULT_CANVAS_CONFIG`, `DEFAULT_SUBTITLE_CONFIG`; add `CreatePage` from `./pages/CreatePage`, `loadClipChoices`, `saveClipChoices`, `type ClipChoices`, `type ShapeValue` from `./lib/clipChoices`; keep `CanvasConfig`, `SubtitleConfig` types.
- Add above `export default function App()`:

```ts
function storageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
```

- Take `aiMode, setAiMode` from `useUserSettings()`.
- Delete the `useState` lines for `aspectRatio`, `trackingMode`, `captionStyle`, `canvasConfig`, `subtitleConfig`, `burnSubtitles`, `enableBroll`, `enableHook`, `maxClips`, `isGamingVideo`, and add in their place:

```ts
  // "Atur tampilan klip" (spec 4.2): remembered for the next video.
  const [choices, setChoices] = useState<ClipChoices>(() => loadClipChoices(storageOrNull()));
  useEffect(() => saveClipChoices(storageOrNull(), choices), [choices]);
  const patchChoices = (patch: Partial<ClipChoices>) => setChoices((c) => ({ ...c, ...patch }));
  const { aspectRatio, trackingMode, burnSubtitles, canvasConfig, subtitleConfig, enableBroll, enableHook, maxClips, isGamingVideo } = choices;
```

- `handleResetWorkspace` becomes:

```ts
  const handleResetWorkspace = () => {
    setUrl("");
    setTitle("");
    setLocalFile(null);
    setInputType("url");
    resetJobState();
  };
```

- In `contextValue`, replace the old setter entries with:

```ts
    choices,
    patchChoices,
    aiMode,
    setAiMode,
    aspectRatio,
    setAspectRatio: (v: ShapeValue) => patchChoices({ aspectRatio: v }),
    trackingMode,
    setTrackingMode: (v: "auto" | "center") => patchChoices({ trackingMode: v }),
    captionStyle: subtitleConfig.style,
    setCaptionStyle: (style: SubtitleConfig["style"]) =>
      setChoices((c) => ({ ...c, subtitleConfig: { ...c.subtitleConfig, style } })),
    burnSubtitles,
    setBurnSubtitles: (v: boolean) => patchChoices({ burnSubtitles: v }),
    canvasConfig,
    setCanvasConfig: (v: CanvasConfig) => patchChoices({ canvasConfig: v }),
    subtitleConfig,
    setSubtitleConfig: (cfgOrFn: SubtitleConfig | ((prev: SubtitleConfig) => SubtitleConfig)) =>
      setChoices((c) => ({ ...c, subtitleConfig: typeof cfgOrFn === "function" ? cfgOrFn(c.subtitleConfig) : cfgOrFn })),
    enableBroll,
    setEnableBroll: (v: boolean) => patchChoices({ enableBroll: v }),
    enableHook,
    setEnableHook: (v: boolean) => patchChoices({ enableHook: v }),
    maxClips,
    setMaxClips: (v: number) => patchChoices({ maxClips: v }),
    isGamingVideo,
    setIsGamingVideo: (v: boolean) => patchChoices({ isGamingVideo: v }),
```

(the `useClipJobs({...})` call keeps passing `aspectRatio`, `trackingMode`, `burnSubtitles: burnSubtitles`, `canvasConfig`, `subtitleConfig`, `captionStyle: subtitleConfig.style`, `enableBroll`, `enableHook`, `maxClips`, `isGamingVideo` from the destructured `choices`).
- Index route: `<Route index element={<CreatePage />} />`.

Delete `src/pages/WorkspacePage.tsx`, `src/pages/ManualAIEditorPage.tsx`, `src/components/GenerateForm.tsx`. Run `npx tsc --noEmit` and fix any remaining import of them.

- [ ] **Step 8: Texts** (`node scripts/add-locale-keys.mjs`)

```json
{
  "id": { "create": {
    "title": "Buat klip",
    "steps_label": "Langkah membuat klip",
    "step_video": "Video", "step_prepare": "Siapkan", "step_choose": "Pilih momen", "step_clips": "Klip",
    "step_done_sr": " (selesai)",
    "link_label": "Tempel link YouTube, TikTok, atau Instagram",
    "link_unsupported": "Link ini belum bisa dipakai. Tempel link video dari YouTube, TikTok, atau Instagram.",
    "or": "Atau pakai video dari perangkat ini:",
    "pick_file": "Pilih file video",
    "pick_drive": "Pilih dari Google Drive",
    "chosen_file": "Video dipilih: {{name}}",
    "clear_file": "Ganti video",
    "shape_label": "Bentuk klip",
    "shape_vertical": "Vertikal untuk TikTok/Reels/Shorts",
    "shape_square": "Persegi",
    "shape_wide": "Lebar",
    "options": "Atur tampilan klip",
    "project_name": "Nama proyek (boleh kosong)",
    "project_name_help": "Kalau kosong, namanya dibuat dari video dan waktu sekarang.",
    "subtitles": "Tampilkan subtitle",
    "face_label": "Posisi gambar",
    "face_follow": "Ikuti wajah",
    "face_center": "Tetap di tengah",
    "hook": "Hook pembuka",
    "hook_help": "3–5 detik paling menarik diputar di awal klip.",
    "broll": "Video ilustrasi (B-roll)",
    "broll_help": "Menambah potongan video dari Pexels yang cocok dengan isi klip.",
    "broll_needs_key": "Butuh kunci Pexels. Isi di Pengaturan, bagian Lanjutan.",
    "game": "Video game dengan kamera wajah",
    "game_help": "Kamera wajah di atas, permainan di bawah.",
    "quality": "Kualitas unduhan",
    "quality_auto": "Otomatis (sampai 1080p)",
    "max_clips": "Jumlah klip",
    "max_clips_auto": "Otomatis (sesuai panjang video)",
    "start": "Mulai",
    "start_hint": "Tempel link atau pilih file video dulu."
  } },
  "en": { "create": {
    "title": "Make clips",
    "steps_label": "Steps to make clips",
    "step_video": "Video", "step_prepare": "Prepare", "step_choose": "Pick moments", "step_clips": "Clips",
    "step_done_sr": " (done)",
    "link_label": "Paste a YouTube, TikTok, or Instagram link",
    "link_unsupported": "This link cannot be used yet. Paste a video link from YouTube, TikTok, or Instagram.",
    "or": "Or use a video from this device:",
    "pick_file": "Choose a video file",
    "pick_drive": "Choose from Google Drive",
    "chosen_file": "Chosen video: {{name}}",
    "clear_file": "Change video",
    "shape_label": "Clip shape",
    "shape_vertical": "Vertical for TikTok/Reels/Shorts",
    "shape_square": "Square",
    "shape_wide": "Wide",
    "options": "Adjust how the clips look",
    "project_name": "Project name (optional)",
    "project_name_help": "Left empty, the name comes from the video and the current time.",
    "subtitles": "Show subtitles",
    "face_label": "Framing",
    "face_follow": "Follow the face",
    "face_center": "Keep it centred",
    "hook": "Opening hook",
    "hook_help": "The most gripping 3–5 seconds play at the start of the clip.",
    "broll": "Illustration footage (B-roll)",
    "broll_help": "Adds matching footage from Pexels.",
    "broll_needs_key": "Needs a Pexels key. Add it in Settings, Advanced.",
    "game": "Game video with a face camera",
    "game_help": "Face camera on top, game below.",
    "quality": "Download quality",
    "quality_auto": "Automatic (up to 1080p)",
    "max_clips": "Number of clips",
    "max_clips_auto": "Automatic (by video length)",
    "start": "Start",
    "start_hint": "Paste a link or choose a video file first."
  } }
}
```

- [ ] **Step 9: Run all checks and look at it**

`npx vitest run` → 197 passing (190 + 5 + 2; record the total). `npx oxlint src` 0 errors. `npm run build`, `npm run build:cloud` exit 0. In the browser at 360 px and 1280 px: link box with live message for `https://vimeo.com/1`; "Pilih file video" opens the system picker (desktop/local) and shows `Video dipilih: …`; on the cloud build the Drive button opens the Drive browser; Mulai is off until a video is chosen and while a preflight block is shown; "Atur tampilan klip" opens and its choices survive a page reload; a started job still shows the old overlay (replaced in Task 10). Keyboard: Tab order link → file → shape radios (arrow keys move) → options summary (Enter opens) → Mulai.

antislop checks for this screen (record PASS/FAIL lines in the ledger entry): one focal point (Mulai is the only filled button), no decorative icons (each icon has a written reason in code comments), no text below 16 px except labels/captions, touch targets ≥ 44 px, no horizontal scroll at 360 px.

- [ ] **Step 10: Log and commit**

PROGRESS-LOG entry; ledger `Task 8: complete (...)` plus the antislop lines.

```bash
git add -A src/components/create src/pages src/App.tsx src/hooks/useUserSettings.ts src/hooks/useClipJobs.ts src/components/GenerateForm.tsx src/locales tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): step 1 of the create flow with pickVideo, clip shape and remembered options

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
