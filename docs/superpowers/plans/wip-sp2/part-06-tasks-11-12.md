### Task 11: Step 3: guided manual AI with answer validation

Spec 4.2 step 3 and 5 (validation under the field). When the job reaches `AWAITING_MANUAL` the user stays on "Buat klip" (no jump to Riwayat, Spec gap 7): ① copy the instructions, ② open ChatGPT or Gemini, ③ paste the answer and press "Buat klip". The answer is checked before it is sent and the message says what is missing. The checked JSON (not the raw paste) is sent, so text around the answer does not trip the backend parser. A project waiting for an answer stays in Riwayat; its button "Tempel jawaban AI" brings the user back to this step. API key mode skips the step (the provider is not `manual_ai`, Task 8) and shows "Memilih momen terbaik" in the progress list (Task 10).

**Files:**
- Create: `src/lib/aiAnswer.ts`, `src/lib/aiAnswer.test.ts`, `src/lib/clipboard.ts`
- Create: `src/components/create/MomentStep.tsx`, `src/components/create/MomentStep.test.tsx`
- Modify: `src/hooks/useClipJobs.ts`, `src/App.tsx` (context), `src/pages/CreatePage.tsx`, `src/pages/HistoryPage.tsx` ("Lanjut Manual" button)
- Delete: `src/components/ManualResumeModal.tsx`
- Modify: `src/locales/{id,en}.json` (`moment.*`)

**Interfaces:**
- Consumes: `POST /jobs/{id}/resume-manual {json_payload, pexels_api_key}` → `{status: "success", job_id}` (the same id; `backend/jobs.py resume_manual_job`); `metadata.manual_prompt` and `metadata.title` of the job status; `requestError` (`src/lib/errorInfo.ts`); `platform().openExternal`.
- Produces:
  - `type AiAnswerProblem = "empty" | "cut_off" | "not_answer" | "no_moments" | "missing_times"`
  - `type AiAnswerCheck = { ok: true; moments: number; payload: string } | { ok: false; problem: AiAnswerProblem; moment?: number }`
  - `stripCodeFence(text: string): string`, `checkAiAnswer(text: string): AiAnswerCheck`
  - `copyText(text: string): Promise<boolean>` (`src/lib/clipboard.ts`)
  - `interface AwaitingAnswer { jobId: string; prompt: string; title: string }`; `useClipJobs` returns `awaiting: AwaitingAnswer | null`, `sendingAnswer: boolean`, `answerError: { message: string; info: ErrorInfo | null } | null`, `submitAiAnswer(payload: string): Promise<void>`, `openAwaiting(job: { id: string; metadata?: { manual_prompt?: string; title?: string } | null }): void`, `leaveAwaiting(): void` (all in App context)
  - `<MomentStep prompt projectTitle submitting error onSubmit onLater />`
  - `CHATGPT_URL = "https://chatgpt.com/"`, `GEMINI_URL = "https://gemini.google.com/app"` (exported from `MomentStep.tsx`)

- [ ] **Step 1: Write the failing tests**

`src/lib/aiAnswer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkAiAnswer, stripCodeFence } from "./aiAnswer";

const moment = (extra: Record<string, unknown> = {}) => ({ start_time: "00:01:05.200", end_time: "00:01:50.000", description_id: "Lucu", ...extra });
const answer = JSON.stringify({ highlights: [moment(), moment({ start_time: "00:03:00", end_time: "00:03:40" })] });

describe("checkAiAnswer (spec 4.2 step 3)", () => {
  it("accepts a whole answer and sends clean JSON", () => {
    const result = checkAiAnswer(answer);
    expect(result).toMatchObject({ ok: true, moments: 2 });
    if (result.ok) expect(JSON.parse(result.payload).highlights).toHaveLength(2);
  });

  it("accepts the answer inside a code block or with chat text around it", () => {
    expect(checkAiAnswer("```json\n" + answer + "\n```")).toMatchObject({ ok: true, moments: 2 });
    expect(checkAiAnswer("Berikut jawabannya:\n" + answer + "\nSemoga membantu!")).toMatchObject({ ok: true, moments: 2 });
    expect(checkAiAnswer(JSON.stringify([moment()]))).toMatchObject({ ok: true, moments: 1 });
  });

  it("says an answer is cut off", () => {
    expect(checkAiAnswer(answer.slice(0, answer.length - 20))).toEqual({ ok: false, problem: "cut_off" });
  });

  it("says a pasted text is not the answer", () => {
    expect(checkAiAnswer("Maaf, saya tidak bisa membantu dengan permintaan ini.")).toEqual({ ok: false, problem: "not_answer" });
  });

  it("says the box is empty", () => {
    expect(checkAiAnswer("   \n ")).toEqual({ ok: false, problem: "empty" });
  });

  it("says an answer has no moments", () => {
    expect(checkAiAnswer('{"highlights": []}')).toEqual({ ok: false, problem: "no_moments" });
    expect(checkAiAnswer('{"note": "nothing"}')).toEqual({ ok: false, problem: "no_moments" });
  });

  it("names the moment without a start or end time", () => {
    const bad = JSON.stringify({ highlights: [moment(), moment({ end_time: undefined }), moment()] });
    expect(checkAiAnswer(bad)).toEqual({ ok: false, problem: "missing_times", moment: 2 });
    expect(checkAiAnswer(JSON.stringify([moment({ start_time: "soon" })]))).toEqual({ ok: false, problem: "missing_times", moment: 1 });
  });
});

describe("stripCodeFence (same as backend/ai_utils.py _clean_json_response)", () => {
  it("takes the inside of a code block", () => {
    expect(stripCodeFence("Ini:\n```json\n[1]\n```\nSelesai")).toBe("[1]");
    expect(stripCodeFence("```\n[1]")).toBe("[1]");
  });
});
```

`src/components/create/MomentStep.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { setPlatform, type Platform } from "../../platform";
import { CHATGPT_URL, GEMINI_URL, MomentStep } from "./MomentStep";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const good = JSON.stringify({ highlights: [{ start_time: "00:00:10", end_time: "00:00:40" }] });

describe("MomentStep (spec 4.2 step 3)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let openExternal: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    openExternal = vi.fn(async () => {});
    setPlatform({ openExternal } as unknown as Platform);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setPlatform(null);
    vi.unstubAllGlobals();
  });

  const render = (props: Partial<React.ComponentProps<typeof MomentStep>> = {}) =>
    act(() =>
      root.render(
        <MomentStep prompt="PERINTAH" projectTitle="YouTube 2026" submitting={false} error={null} onSubmit={vi.fn()} onLater={vi.fn()} {...props} />,
      ),
    );
  const button = (label: string) => [...container.querySelectorAll("button")].find((b) => b.textContent === label)!;
  const typeAnswer = (value: string) => {
    const area = container.querySelector("textarea:not([readonly])") as HTMLTextAreaElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    act(() => {
      setValue.call(area, value);
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
    return area;
  };

  it("copies the instructions in one tap", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render();
    await act(async () => button(i18n.t("moment.copy")).click());
    expect(writeText).toHaveBeenCalledWith("PERINTAH");
    expect(container.textContent).toContain(i18n.t("moment.copied"));
  });

  it("opens ChatGPT and Gemini in a new tab", () => {
    render();
    act(() => button(i18n.t("moment.open_chatgpt")).click());
    act(() => button(i18n.t("moment.open_gemini")).click());
    expect(openExternal.mock.calls).toEqual([[CHATGPT_URL], [GEMINI_URL]]);
  });

  it("explains under the box what is wrong, and sends nothing", () => {
    const onSubmit = vi.fn();
    render({ onSubmit });
    act(() => button(i18n.t("moment.submit")).click());
    let area = container.querySelector("textarea:not([readonly])")!;
    expect(area.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(area.getAttribute("aria-describedby")!)!.textContent).toBe(i18n.t("moment.problem_empty"));
    area = typeAnswer(good.slice(0, 30));
    act(() => button(i18n.t("moment.submit")).click());
    expect(document.getElementById(area.getAttribute("aria-describedby")!)!.textContent).toBe(i18n.t("moment.problem_cut_off"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sends a good answer", () => {
    const onSubmit = vi.fn();
    render({ onSubmit });
    typeAnswer("```json\n" + good + "\n```");
    act(() => button(i18n.t("moment.submit")).click());
    expect(onSubmit).toHaveBeenCalledWith(good);
  });

  it("says when the instructions are missing instead of offering an empty copy", () => {
    render({ prompt: "" });
    expect(container.textContent).toContain(i18n.t("moment.prompt_missing"));
    expect(button(i18n.t("moment.copy"))).toBeUndefined();
  });
});
```

Run: `npx vitest run src/lib/aiAnswer.test.ts src/components/create/MomentStep.test.tsx` → FAIL (modules missing).

- [ ] **Step 2: Implement `src/lib/aiAnswer.ts`**

```ts
// Step 3 (spec 4.2): check the answer pasted from ChatGPT or Gemini before it is sent,
// and say what is missing. Mirrors backend/ai_utils.py _clean_json_response/_parse_highlights.

export type AiAnswerProblem = "empty" | "cut_off" | "not_answer" | "no_moments" | "missing_times";

export type AiAnswerCheck =
  | { ok: true; moments: number; payload: string }
  | { ok: false; problem: AiAnswerProblem; moment?: number };

export function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) return fenced[1].trim();
  return trimmed.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
}

/** JSON.parse, or the part from the first bracket to the last (chat text around the answer). */
function parseLoose(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    // Text around the JSON: try the bracketed part.
  }
  const start = body.search(/[[{]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  if (start < 0 || end <= start) return undefined;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

/** Starts like JSON but a bracket or a quote is still open at the end. */
function looksCutOff(body: string): boolean {
  const start = body.search(/[[{]/);
  if (start < 0) return false;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const ch of body.slice(start)) {
    if (escaped) {
      escaped = false;
    } else if (ch === "\\") {
      escaped = true;
    } else if (ch === '"') {
      inString = !inString;
    } else if (!inString && (ch === "{" || ch === "[")) {
      depth++;
    } else if (!inString && (ch === "}" || ch === "]")) {
      depth--;
    }
  }
  return depth > 0 || inString;
}

function momentsOf(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return null;
  const object = parsed as Record<string, unknown>;
  if ("highlights" in object) return Array.isArray(object.highlights) ? object.highlights : null;
  return (Object.values(object).find(Array.isArray) as unknown[] | undefined) ?? null;
}

const TIME = /^\d{1,2}(:\d{1,2}){1,2}([.,]\d+)?$/;

function isTime(value: unknown): boolean {
  return (typeof value === "number" && value >= 0) || (typeof value === "string" && TIME.test(value.trim()));
}

export function checkAiAnswer(text: string): AiAnswerCheck {
  if (!text.trim()) return { ok: false, problem: "empty" };
  const body = stripCodeFence(text);
  const parsed = parseLoose(body);
  if (parsed === undefined) return { ok: false, problem: looksCutOff(body) ? "cut_off" : "not_answer" };
  const moments = momentsOf(parsed);
  if (!moments || moments.length === 0) return { ok: false, problem: "no_moments" };
  const bad = moments.findIndex((m) => {
    const item = m as Record<string, unknown> | null;
    return !item || typeof item !== "object" || !isTime(item.start_time) || !isTime(item.end_time);
  });
  if (bad >= 0) return { ok: false, problem: "missing_times", moment: bad + 1 };
  // The checked JSON is what goes to the backend, so chat text around it cannot trip its parser.
  return { ok: true, moments: moments.length, payload: JSON.stringify(parsed) };
}
```

`src/lib/clipboard.ts`:

```ts
/**
 * Copy text; true when it worked. Falls back to a hidden text area where the Clipboard API is
 * missing (older phone browsers, pages that are not https or localhost).
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Refused: try the old way below.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  } catch {
    return false;
  }
}
```

- [ ] **Step 3: Implement `src/components/create/MomentStep.tsx`**

```tsx
import React, { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, ExternalLink } from "lucide-react";
import { checkAiAnswer, type AiAnswerProblem } from "../../lib/aiAnswer";
import { copyText } from "../../lib/clipboard";
import { platform } from "../../platform";
import type { ErrorInfo } from "../../types/errorInfo";
import { ErrorCard } from "../ErrorCard";
import { Button } from "../ui/Button";

export const CHATGPT_URL = "https://chatgpt.com/";
export const GEMINI_URL = "https://gemini.google.com/app";

export interface MomentStepProps {
  /** metadata.manual_prompt of the waiting project. */
  prompt: string;
  projectTitle: string;
  submitting: boolean;
  error: { message: string; info: ErrorInfo | null } | null;
  onSubmit: (payload: string) => void;
  onLater: () => void;
}

function StepNumber({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-muted text-label font-semibold text-accent">
      {n}
    </span>
  );
}

/** Step 3 (spec 4.2): copy, ask ChatGPT or Gemini, paste the answer. */
export const MomentStep: React.FC<MomentStepProps> = ({ prompt, projectTitle, submitting, error, onSubmit, onLater }) => {
  const { t } = useTranslation();
  const headingId = useId();
  const answerId = useId();
  const problemId = useId();
  const [answer, setAnswer] = useState("");
  const [problem, setProblem] = useState<{ kind: AiAnswerProblem; moment?: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const copy = async () => {
    const ok = await copyText(prompt);
    setCopied(ok);
    setCopyFailed(!ok);
    if (ok) setTimeout(() => setCopied(false), 3000);
  };

  const submit = () => {
    const result = checkAiAnswer(answer);
    if (!result.ok) {
      setProblem({ kind: result.problem, moment: result.moment });
      return;
    }
    setProblem(null);
    onSubmit(result.payload);
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-5 rounded-card border border-border bg-bg-secondary p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-section-title text-text-primary">{t("moment.title")}</h2>
        <p className="text-body text-text-secondary">{t("moment.intro")}</p>
      </div>

      <ol className="flex flex-col gap-6">
        <li className="flex gap-3">
          <StepNumber n={1} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {prompt ? (
              <>
                <Button className="self-start" icon={copied ? Check : Copy} onClick={() => void copy()}>
                  {copied ? t("moment.copied") : t("moment.copy")}
                </Button>
                <p className="text-body text-text-secondary">{t("moment.copy_help")}</p>
                {copyFailed && (
                  <>
                    <p role="alert" className="text-body text-error">{t("moment.copy_failed")}</p>
                    <textarea
                      readOnly
                      aria-label={t("moment.copy_box_label")}
                      value={prompt}
                      className="min-h-[120px] w-full rounded-input border border-border-active bg-bg-surface p-3 text-body text-text-primary"
                    />
                  </>
                )}
              </>
            ) : (
              <p role="alert" className="text-body text-error">{t("moment.prompt_missing")}</p>
            )}
          </div>
        </li>

        <li className="flex gap-3">
          <StepNumber n={2} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              {/* The icon says "opens a new tab". */}
              <Button variant="outline" icon={ExternalLink} onClick={() => void platform().openExternal(CHATGPT_URL)}>
                {t("moment.open_chatgpt")}
              </Button>
              <Button variant="outline" icon={ExternalLink} onClick={() => void platform().openExternal(GEMINI_URL)}>
                {t("moment.open_gemini")}
              </Button>
            </div>
            <p className="text-body text-text-secondary">{t("moment.open_help")}</p>
          </div>
        </li>

        <li className="flex gap-3">
          <StepNumber n={3} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <label htmlFor={answerId} className="text-label text-text-primary">{t("moment.answer_label")}</label>
            <textarea
              id={answerId}
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value);
                setProblem(null);
              }}
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? problemId : undefined}
              className={`min-h-[160px] w-full rounded-input border bg-bg-secondary p-3 text-body text-text-primary ${problem ? "border-error" : "border-border-active"}`}
            />
            {problem && (
              <p id={problemId} className="text-body text-error">
                {t(`moment.problem_${problem.kind}`, { n: problem.moment })}
              </p>
            )}
            {error && (error.info ? <ErrorCard info={error.info} announce /> : <p role="alert" className="text-body text-error">{error.message}</p>)}
            <Button size="lg" className="w-full sm:w-auto sm:self-start" loading={submitting} onClick={submit}>
              {t("moment.submit")}
            </Button>
          </div>
        </li>
      </ol>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <p className="text-body text-text-secondary">{t("moment.saved", { title: projectTitle })}</p>
        <Button variant="ghost" className="self-start" onClick={onLater}>{t("moment.later")}</Button>
      </div>
    </section>
  );
};
```

- [ ] **Step 4: `useClipJobs`, App, CreatePage, HistoryPage**

`src/hooks/useClipJobs.ts`:
- `import type { ErrorInfo } from "../types/errorInfo";` already exists; add:

```ts
export interface AwaitingAnswer {
  jobId: string;
  prompt: string;
  title: string;
}
```

- State:

```ts
  // Step 3 (spec 4.2): a project waits for the pasted AI answer.
  const [awaiting, setAwaiting] = useState<AwaitingAnswer | null>(null);
  const [sendingAnswer, setSendingAnswer] = useState(false);
  const [answerError, setAnswerError] = useState<{ message: string; info: ErrorInfo | null } | null>(null);
```

- Replace the `AWAITING_MANUAL` branch with:

```ts
          } else if (job.status === "AWAITING_MANUAL") {
            setStatus("IDLE");
            setCurrent(null);
            setHistoryVersion((v) => v + 1);
            if (jobOrigin === "workspace") {
              // Stay on "Buat klip", step 3; the project also waits in Riwayat.
              setAwaiting({ jobId: activeJobId, prompt: job.metadata?.manual_prompt || "", title: job.metadata?.title || "" });
              setAnswerError(null);
              notify(t("toast.manual_prompt_ready"), "success");
            }
            setActiveJobId(null);
            setProgress("");
            setQueuePosition(null);
```

- Add the actions:

```ts
  const submitAiAnswer = async (payload: string) => {
    if (!awaiting) return;
    setSendingAnswer(true);
    setAnswerError(null);
    try {
      // History keeps no API keys: B-roll needs the Pexels key from Settings.
      const res = await axios.post(`${API_URL}/jobs/${awaiting.jobId}/resume-manual`, {
        json_payload: payload,
        pexels_api_key: p.pexelsApiKey,
      });
      if (res.data.status !== "success") throw new Error(res.data.message || "resume-manual failed");
      platform().askNotifyPermission();
      clearError();
      setAwaiting(null);
      setClips([]);
      setFailedCount(0);
      setJobMeta(null);
      setLiveMeta(null);
      setJobOrigin("workspace");
      setMakePhase(true);
      setStatus("PENDING");
      setActiveJobId(res.data.job_id);
    } catch (err) {
      console.error(err);
      setAnswerError(requestError(err, t("moment.send_failed")));
    } finally {
      setSendingAnswer(false);
    }
  };

  /** "Tempel jawaban AI" in Riwayat: back to step 3 for that project. */
  const openAwaiting = (job: { id: string; metadata?: { manual_prompt?: string; title?: string } | null }) => {
    resetJobState();
    setAwaiting({ jobId: job.id, prompt: job.metadata?.manual_prompt || "", title: job.metadata?.title || "" });
  };

  const leaveAwaiting = () => {
    setAwaiting(null);
    setAnswerError(null);
  };
```

- `resetJobState` also does `setAwaiting(null); setAnswerError(null);` (placed before the `setAwaiting` in `openAwaiting`, so the later call wins).
- Return `awaiting, sendingAnswer, answerError, submitAiAnswer, openAwaiting, leaveAwaiting`.

`src/App.tsx`: add those six names to the destructuring of `useClipJobs` and to `contextValue`.

`src/pages/CreatePage.tsx`: import `MomentStep`; after the error card add:

```tsx
      {ctx.awaiting && (
        <MomentStep
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
```

`src/pages/HistoryPage.tsx` (replaced in Task 13): remove `ManualResumeModal` (import, `activeManualJob` state, the modal block); import `useNavigate` and `ROUTES`; the `AWAITING_MANUAL` button becomes:

```tsx
                  <Button variant="primary" icon={Play} onClick={() => { ctx.openAwaiting(job); navigate(ROUTES.create); }}>
                    {t("projects.action_paste_answer")}
                  </Button>
```

Delete `src/components/ManualResumeModal.tsx`.

- [ ] **Step 5: Texts** (`node scripts/add-locale-keys.mjs`)

```json
{
  "id": {
    "moment": {
      "title": "Pilih momen terbaik dengan bantuan AI",
      "intro": "Tiga langkah di bawah memakai ChatGPT atau Gemini. Tidak perlu kunci API.",
      "copy": "Salin perintah",
      "copied": "Tersalin",
      "copy_help": "Teks ini berisi transkrip video dan petunjuk untuk AI.",
      "copy_failed": "Perintah belum tersalin otomatis. Tekan lama teks di bawah, pilih semua, lalu salin.",
      "copy_box_label": "Teks perintah",
      "open_chatgpt": "Buka ChatGPT",
      "open_gemini": "Buka Gemini",
      "open_help": "Tempel perintah tadi, lalu kirim.",
      "answer_label": "Tempel jawaban AI di sini",
      "submit": "Buat klip",
      "problem_empty": "Kotak jawaban masih kosong. Tempel jawaban dari ChatGPT atau Gemini di sini.",
      "problem_cut_off": "Jawaban belum lengkap. Salin seluruh jawaban AI, termasuk tanda kurung di awal dan akhir.",
      "problem_not_answer": "Teks ini bukan jawaban untuk perintah tadi. Salin jawaban AI yang dimulai dengan tanda kurung { atau [.",
      "problem_no_moments": "Jawaban AI tidak berisi momen apa pun. Kirim ulang perintah ke AI, lalu salin jawabannya lagi.",
      "problem_missing_times": "Momen ke-{{n}} tidak punya waktu mulai dan selesai. Minta AI mengirim ulang jawabannya, lalu salin lagi.",
      "prompt_missing": "Teks perintah untuk proyek ini tidak ditemukan. Buka proyek ini dari Riwayat, atau mulai lagi dari video.",
      "send_failed": "Jawaban belum terkirim. Periksa sambungan, lalu tekan Buat klip lagi.",
      "saved": "Proyek ini tersimpan di Riwayat. Kamu bisa menempel jawabannya nanti.",
      "later": "Buat klip dari video lain"
    },
    "projects": { "action_paste_answer": "Tempel jawaban AI" }
  },
  "en": {
    "moment": {
      "title": "Pick the best moments with an AI chat",
      "intro": "The three steps below use ChatGPT or Gemini. No API key needed.",
      "copy": "Copy the instructions",
      "copied": "Copied",
      "copy_help": "This text holds the video transcript and instructions for the AI.",
      "copy_failed": "The instructions were not copied automatically. Press and hold the text below, select all, then copy.",
      "copy_box_label": "Instructions text",
      "open_chatgpt": "Open ChatGPT",
      "open_gemini": "Open Gemini",
      "open_help": "Paste the instructions, then send.",
      "answer_label": "Paste the AI's answer here",
      "submit": "Make clips",
      "problem_empty": "The answer box is empty. Paste the answer from ChatGPT or Gemini here.",
      "problem_cut_off": "The answer is not complete. Copy the AI's whole answer, including the brackets at the start and end.",
      "problem_not_answer": "This text is not the answer to the instructions. Copy the AI's answer that starts with a { or [ bracket.",
      "problem_no_moments": "The AI's answer has no moments in it. Send the instructions to the AI again, then copy the new answer.",
      "problem_missing_times": "Moment {{n}} has no start and end time. Ask the AI to send its answer again, then copy it.",
      "prompt_missing": "The instructions for this project were not found. Open it from History, or start again from the video.",
      "send_failed": "The answer was not sent. Check the connection, then press Make clips again.",
      "saved": "This project is saved in History. You can paste the answer later.",
      "later": "Make clips from another video"
    },
    "projects": { "action_paste_answer": "Paste the AI answer" }
  }
}
```

- [ ] **Step 6: Run all checks and walk the flow**

`npx vitest run` → 230 passing (214 + 8 + 5 + plain-words unchanged; record the total). `npx oxlint src` 0 errors. `npm run build`, `npm run build:cloud` exit 0. Real walk (web local or cloud build against a dev backend): start with a short YouTube link → step 2 progress → step 3 appears on the same page; "Salin perintah" copies; "Buka ChatGPT" opens a new tab; pasting half the answer shows the cut-off message under the box; the full answer starts step 4 on the same project id; Riwayat shows the project as "Menunggu jawaban AI" before the answer, and its button brings back step 3. At 360 px the three numbered steps fit without horizontal scroll.

- [ ] **Step 7: Log and commit**

PROGRESS-LOG entry; ledger `Task 11: complete (...)`.

```bash
git add -A src/lib/aiAnswer.ts src/lib/aiAnswer.test.ts src/lib/clipboard.ts src/components/create src/components/ManualResumeModal.tsx src/hooks/useClipJobs.ts src/App.tsx src/pages src/locales tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): guided manual AI step with answer checks on the create screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Results: `saveClips`, "⋯" menu, result cards, `Unduh semua`

Spec 4.5 (Hasil): one column on a phone, a grid on large screens; per clip the player (signed link), the AI title, the duration, **Unduh** and **Bagikan** (Social Kit), and a "⋯" menu with "Ubah subtitle atau tampilan" (question 4) and "Buka folder" (`caps.openFolder`); **Unduh semua** above the list; "Detail waktu" collapsed. New platform member `saveClips` (Spec gap 8). After a single-clip edit the result reloads from `GET /jobs/{id}`.

**Files:**
- Modify: `src/platform/types.ts` (`saveClips`), `src/platform/browser.ts` (`browserDownloadAll`, `browserPlatformParts`), `src/platform/desktop/index.ts`, `src/platform/browser.test.ts`, `src/platform/desktop/index.test.ts`
- Create: `src/components/ui/OverflowMenu.tsx`, `src/components/ui/OverflowMenu.test.tsx`
- Create: `src/lib/clipInfo.ts`, `src/lib/clipInfo.test.ts`
- Modify: `src/components/ClipCard.tsx`, `src/components/ClipsResult.tsx`, `src/components/ClipsResult.test.tsx` (create)
- Modify: `src/hooks/useClipJobs.ts` (`resultJobId`, reload after a clip edit), `src/App.tsx`, `src/pages/CreatePage.tsx`
- Delete: `src/components/ClipRerenderModal.tsx` (unused)
- Modify: `src/locales/{id,en}.json` (`result.*`)

**Interfaces:**
- Consumes: `ClipRef` (`src/platform/types.ts`), `browserDownload`, `useSignedVideo`, `videoHref`, `fileName`, `SocialKitModal`, `ClipEditModal`, `JobWarnings`, `TimingDetails`.
- Produces:
  - `Platform.saveClips(clips: ClipRef[]): Promise<void>`; `browserDownloadAll(clips: ClipRef[], gapMs?: number): Promise<void>`
  - `interface OverflowItem { id: string; label: string; onSelect: () => void; danger?: boolean }`; `<OverflowMenu label items />` (used by Task 13)
  - `timeToSeconds(v: unknown): number | null`, `clipSeconds(clip: { start?: unknown; end?: unknown }): number | null`, `formatClock(seconds: number): string`, `clipTitle(clip: Clip, lang: "id" | "en"): string | null`
  - `<ClipsResult clips status failedCount jobId metadata? onEditClip? onNew? />` (Task 13 uses it on the project page)
  - `useClipJobs` returns `resultJobId: string | null`; context exposes it.

- [ ] **Step 1: Write the failing tests**

`src/lib/clipInfo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clipSeconds, clipTitle, formatClock, timeToSeconds } from "./clipInfo";

describe("clip info for the result card (spec 4.5)", () => {
  it("reads the times the AI wrote", () => {
    expect(timeToSeconds("00:01:05.500")).toBe(65.5);
    expect(timeToSeconds("1:05")).toBe(65);
    expect(timeToSeconds("00:00:07,250")).toBe(7.25);
    expect(timeToSeconds(12)).toBe(12);
    expect(timeToSeconds("soon")).toBeNull();
  });

  it("gives the clip length, or nothing when it is unknown", () => {
    expect(clipSeconds({ start: "00:01:00", end: "00:01:45" })).toBe(45);
    expect(clipSeconds({ start: "00:01:00" })).toBeNull();
    expect(formatClock(45)).toBe("0:45");
    expect(formatClock(3725)).toBe("1:02:05");
  });

  it("takes the AI title in the app language, then the description", () => {
    const clip = { path: "a", description: "desc", start: "", end: "", subs: true, v: 0, social: { titles_id: ["Judul"], titles_en: ["Title"] } };
    expect(clipTitle(clip, "id")).toBe("Judul");
    expect(clipTitle(clip, "en")).toBe("Title");
    expect(clipTitle({ ...clip, social: undefined, description_id: "Deskripsi" }, "id")).toBe("Deskripsi");
    expect(clipTitle({ ...clip, social: undefined, description: "" }, "id")).toBeNull();
  });
});
```

`src/components/ui/OverflowMenu.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import { OverflowMenu } from "./OverflowMenu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("OverflowMenu", () => {
  let container: HTMLDivElement;
  let root: Root;
  const edit = vi.fn();
  const folder = vi.fn();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() =>
      root.render(
        <OverflowMenu label="Pilihan lain" items={[{ id: "edit", label: "Ubah", onSelect: edit }, { id: "folder", label: "Folder", onSelect: folder }]} />,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  const toggle = () => container.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
  const items = () => [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];

  it("is a labelled button that opens a menu and focuses its first item", () => {
    expect(toggle().getAttribute("aria-label")).toBe("Pilihan lain");
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    act(() => toggle().click());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(items().map((i) => i.textContent)).toEqual(["Ubah", "Folder"]);
    expect(document.activeElement).toBe(items()[0]);
  });

  it("moves with the arrow keys and closes with Escape, back on the button", () => {
    act(() => toggle().click());
    act(() => {
      items()[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    expect(document.activeElement).toBe(items()[1]);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(items()).toHaveLength(0);
    expect(document.activeElement).toBe(toggle());
  });

  it("runs the chosen item and closes", () => {
    act(() => toggle().click());
    act(() => items()[1].click());
    expect(folder).toHaveBeenCalledTimes(1);
    expect(items()).toHaveLength(0);
  });

  it("draws nothing without items", () => {
    act(() => root.render(<OverflowMenu label="x" items={[]} />));
    expect(container.innerHTML).toBe("");
  });
});
```

`src/components/ClipsResult.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { CAPS, setPlatform, type Platform } from "../platform";
import { setApiUrl } from "../platform/backendUrl";
import ClipsResult from "./ClipsResult";

vi.mock("./SocialKitModal", () => ({ SocialKitModal: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const clip = (n: number) => ({
  path: `C:\\lib\\clip_${n}.mp4`, video_url: `/video?p=clip_${n}&sig=s`, description: `Momen ${n}`,
  start: "00:00:10", end: "00:00:40", subs: true, v: 0,
});

describe("ClipsResult (spec 4.5)", () => {
  let container: HTMLDivElement;
  let root: Root;
  const saveClips = vi.fn(async () => {});

  beforeEach(() => {
    setApiUrl("http://127.0.0.1:5123");
    setPlatform({ caps: CAPS.local, saveClips, saveClip: vi.fn(), openFolder: vi.fn() } as unknown as Platform);
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    setPlatform(null);
  });

  it("downloads every clip with one button above the list", async () => {
    act(() => root.render(<ClipsResult clips={[clip(1), clip(2)]} status="DONE" failedCount={0} jobId="j1" />));
    const all = [...container.querySelectorAll("button")].find((b) => b.textContent === i18n.t("result.download_all"))!;
    await act(async () => all.click());
    expect(saveClips).toHaveBeenCalledWith([
      { path: "C:\\lib\\clip_1.mp4", filename: "clip_1.mp4", videoUrl: "http://127.0.0.1:5123/video?p=clip_1&sig=s&dl=1" },
      { path: "C:\\lib\\clip_2.mp4", filename: "clip_2.mp4", videoUrl: "http://127.0.0.1:5123/video?p=clip_2&sig=s&dl=1" },
    ]);
  });

  it("gives every clip Unduh, Bagikan and its duration", () => {
    act(() => root.render(<ClipsResult clips={[clip(1)]} status="DONE" failedCount={0} jobId="j1" />));
    const text = container.textContent!;
    expect(text).toContain(i18n.t("result.download"));
    expect(text).toContain(i18n.t("result.share"));
    expect(text).toContain("0:30");
  });
});
```

(`videoHref` in `src/lib/videoUrl.ts` appends `&dl=1` to a link that already has a query.)

Append to `src/platform/browser.test.ts`:

```ts
describe("browserDownloadAll", () => {
  it("downloads the clips one after another", async () => {
    const { browserDownloadAll } = await import("./browser");
    const names: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    await browserDownloadAll(
      [
        { path: "a", filename: "clip_1.mp4", videoUrl: "http://x/video?p=1" },
        { path: "b", filename: "clip_2.mp4", videoUrl: "http://x/video?p=2" },
      ],
      0,
    );
    expect(names).toEqual(["clip_1.mp4", "clip_2.mp4"]);
    click.mockRestore();
  });
});
```

In `src/platform/desktop/index.test.ts` change the dialog mock to a named mock:

```ts
const openDialog = vi.fn(async (_opts: unknown): Promise<string | null> => null);
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: openDialog, save: saveDialog }));
```

and add:

```ts
  it("saves all clips into one chosen folder, or nothing when cancelled", async () => {
    setApiUrl("http://127.0.0.1:5123");
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: {} });
    openDialog.mockResolvedValueOnce("D:\\out").mockResolvedValueOnce(null);
    const p = createPlatform();
    const clips = [
      { path: "C:\\app\\clip_1.mp4", filename: "clip_1.mp4" },
      { path: "C:\\app\\clip_2.mp4", filename: "clip_2.mp4" },
    ];
    await p.saveClips(clips);
    await p.saveClips(clips);
    expect(post.mock.calls).toEqual([
      ["http://127.0.0.1:5123/save_file", { src: "C:\\app\\clip_1.mp4", dest: "D:\\out" }],
      ["http://127.0.0.1:5123/save_file", { src: "C:\\app\\clip_2.mp4", dest: "D:\\out" }],
    ]);
  });
```

Run: `npx vitest run src/lib/clipInfo.test.ts src/components/ui/OverflowMenu.test.tsx src/components/ClipsResult.test.tsx src/platform` → FAIL.

- [ ] **Step 2: Platform**

`src/platform/types.ts`, in `Platform` after `saveClip`:

```ts
  /** Save several clips at once ("Unduh semua"): desktop asks for one folder, browsers download one by one. */
  saveClips(clips: ClipRef[]): Promise<void>;
```

`src/platform/browser.ts`: after `browserDownload` add

```ts
/** Several clips one after another; the short pause lets the browser start each download. */
export async function browserDownloadAll(clips: ClipRef[], gapMs = 400): Promise<void> {
  for (const [i, clip] of clips.entries()) {
    if (i > 0) await new Promise((resolve) => setTimeout(resolve, gapMs));
    await browserDownload(clip);
  }
}
```

add `| "saveClips"` to the `Pick<…>` of `browserPlatformParts` and `saveClips: (clips) => browserDownloadAll(clips),` to its object.

`src/platform/desktop/index.ts`, after `saveClip`:

```ts
    async saveClips(clips) {
      // One folder for all clips, not one save dialog per clip (plan Spec gap 8).
      const folder = await openDialog({ directory: true, multiple: false });
      if (typeof folder !== "string") return;
      for (const clip of clips) await axios.post(`${API_URL}/save_file`, { src: clip.path, dest: folder });
    },
```

- [ ] **Step 3: `clipInfo` and `OverflowMenu`**

`src/lib/clipInfo.ts`:

```ts
import type { Clip } from "../components/ClipCard";

// What the result card says about a clip (spec 4.5): its AI title and its length.

/** "00:01:05.500", "1:05", "00:00:07,250" or a number of seconds. */
export function timeToSeconds(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}:)?(\d{1,2}):(\d{1,2})([.,]\d+)?$/);
  if (!match) return null;
  const hours = match[1] ? Number(match[1].slice(0, -1)) : 0;
  const fraction = match[4] ? Number(`0.${match[4].slice(1)}`) : 0;
  return hours * 3600 + Number(match[2]) * 60 + Number(match[3]) + fraction;
}

export function clipSeconds(clip: { start?: unknown; end?: unknown }): number | null {
  const start = timeToSeconds(clip.start);
  const end = timeToSeconds(clip.end);
  return start !== null && end !== null && end > start ? Math.round((end - start) * 10) / 10 : null;
}

/** "0:45", "1:02:05". */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function clipTitle(clip: Clip, lang: "id" | "en"): string | null {
  const titles = lang === "en" ? clip.social?.titles_en : clip.social?.titles_id;
  const description = lang === "en" ? clip.description_en : clip.description_id;
  return titles?.find((x) => x?.trim()) || description?.trim() || clip.description?.trim() || null;
}
```

`src/components/ui/OverflowMenu.tsx`:

```tsx
import React, { useEffect, useId, useRef, useState } from "react";
import { Ellipsis } from "lucide-react";
import { Button } from "./Button";

export interface OverflowItem {
  id: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
}

/** The "⋯" menu (spec 4.5): a labelled 44 px button, arrow keys inside, Escape closes. */
export const OverflowMenu: React.FC<{ label: string; items: OverflowItem[] }> = ({ label, items }) => {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  if (items.length === 0) return null;

  const move = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const list = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const at = list.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === "ArrowDown" ? (at + 1) % list.length : (at - 1 + list.length) % list.length;
    list[next]?.focus();
  };

  return (
    <div className="relative shrink-0">
      <Button
        ref={buttonRef}
        variant="ghost"
        icon={Ellipsis}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={move}
          className="absolute right-0 z-20 mt-1 min-w-[240px] rounded-card border border-border bg-bg-secondary py-1 shadow-dropdown"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`flex min-h-[44px] w-full items-center px-4 text-left text-body hover:bg-bg-surface focus:bg-bg-surface focus:outline-none ${
                item.danger ? "text-error" : "text-text-primary"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: Result card and list**

`src/components/ClipCard.tsx`: keep the `SocialData`, `Clip` exports and the `useSignedVideo`/`ErrorCard` player; replace the component body's returned JSX and handlers with:

```tsx
export default function ClipCard({ clip, index, jobId, onEdit }: ClipCardProps) {
  const { t, i18n } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [localSocial, setLocalSocial] = useState<SocialData | undefined>(clip.social);
  const video = useSignedVideo(clip.path, clip.video_url);
  const caps = platform().caps;
  const lang = toLang(i18n.language);
  const title = clipTitle({ ...clip, social: localSocial }, lang) ?? t("result.clip_n", { n: index + 1 });
  const seconds = clipSeconds(clip);
  const description = lang === "en" ? clip.description_en || clip.description : clip.description_id || clip.description;

  const save = async () => {
    setSaveFailed(false);
    try {
      await platform().saveClip({
        path: clip.path,
        filename: fileName(clip.path),
        videoUrl: videoHref(video.src, API_URL, { dl: true }) || undefined,
      });
    } catch (err) {
      console.error("Save failed", err);
      setSaveFailed(true);
    }
  };

  const items: OverflowItem[] = [
    ...(onEdit ? [{ id: "edit", label: t("result.edit"), onSelect: onEdit }] : []),
    ...(caps.openFolder
      ? [{ id: "folder", label: t("result.open_folder"), onSelect: () => void platform().openFolder(clip.path).catch((err) => console.error("Open folder failed", err)) }]
      : []),
  ];

  return (
    <article className="flex flex-col gap-3 rounded-card border border-border bg-bg-secondary p-3">
      <div className="mx-auto aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-input bg-black">
        {video.failed ? (
          <ErrorCard info={localErrorInfo("VIDEO_LINK_REFUSED")} handlers={{ retry: video.retry }} className="h-full overflow-y-auto rounded-none border-0" />
        ) : (
          <video
            key={`${clip.v}-${video.src}`}
            src={videoHref(video.src, API_URL, { v: clip.v }) || undefined}
            onError={video.onError}
            controls
            playsInline
            preload="metadata"
            className="h-full w-full object-contain"
          />
        )}
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-card-title text-text-primary break-words">{title}</h3>
          <p className="text-caption text-text-secondary">
            {t("result.clip_n", { n: index + 1 })}
            {seconds !== null && ` · ${formatClock(seconds)}`}
          </p>
        </div>
        <OverflowMenu label={t("result.more", { n: index + 1 })} items={items} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" icon={Download} onClick={() => void save()}>{t("result.download")}</Button>
        {(description || localSocial) && (
          <Button variant="ghost" icon={Share2} onClick={() => setShowModal(true)}>{t("result.share")}</Button>
        )}
      </div>
      {saveFailed && <p role="alert" className="text-body text-error">{t("result.download_failed")}</p>}
      {(description || localSocial) && (
        <SocialKitModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          social={localSocial}
          clip={clip}
          jobId={jobId}
          clipIndex={index}
          onUpdate={(next) => setLocalSocial(next)}
        />
      )}
    </article>
  );
}
```

with imports `Download, Share2` from lucide, `Button`, `OverflowMenu, type OverflowItem`, `clipSeconds, clipTitle, formatClock` from `../lib/clipInfo`, `toLang` from `../lib/errorInfo`, and `useState` moved to the top import (drop `Folder`, `Sparkles`, `Pencil`, `Star`).

`src/components/ClipsResult.tsx`:

```tsx
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Plus } from "lucide-react";
import ClipCard, { type Clip } from "./ClipCard";
import { Button } from "./ui/Button";
import { JobWarnings } from "./JobWarnings";
import { TimingDetails } from "./TimingDetails";
import { platform } from "../platform";
import { fileName } from "../platform/paths";
import { API_URL } from "../platform/backendUrl";
import { videoHref } from "../lib/videoUrl";

interface ClipsResultProps {
  clips: Clip[];
  status: string;
  failedCount: number;
  jobId: string;
  /** Job metadata: warnings and timings. */
  metadata?: Record<string, unknown> | null;
  onEditClip?: (index: number) => void;
  onNew?: () => void;
}

/** The clips of one project (spec 4.5): one column on a phone, a grid on large screens. */
export default function ClipsResult({ clips, status, failedCount, jobId, metadata, onEditClip, onNew }: ClipsResultProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const [saving, setSaving] = useState(false);
  if (clips.length === 0) return null;
  const done = status === "DONE";

  const saveAll = async () => {
    setSaving(true);
    try {
      await platform().saveClips(
        clips.map((clip) => ({
          path: clip.path,
          filename: fileName(clip.path),
          videoUrl: videoHref(clip.video_url || "", API_URL, { dl: true }) || undefined,
        })),
      );
    } catch (err) {
      console.error("Save all failed", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id={headingId} className="text-section-title text-text-primary">
            {done ? t("result.title_done", { count: clips.length }) : t("result.title_partial", { count: clips.length })}
          </h2>
          {failedCount > 0 && <p className="text-body text-error">{t("result.failed", { count: failedCount })}</p>}
        </div>
        {done && clips.length > 1 && (
          <Button size="lg" icon={Download} loading={saving} onClick={() => void saveAll()}>
            {t("result.download_all")}
          </Button>
        )}
      </div>
      {done && <JobWarnings warnings={metadata?.warnings} />}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {clips.map((clip, i) => (
          <ClipCard key={clip.path} clip={clip} index={i} jobId={jobId} onEdit={onEditClip ? () => onEditClip(i) : undefined} />
        ))}
      </div>
      {done && <TimingDetails metadata={metadata} />}
      {done && onNew && (
        <Button variant="outline" icon={Plus} className="self-start" onClick={onNew}>
          {t("result.new")}
        </Button>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Result project id and the page**

`src/hooks/useClipJobs.ts`:
- `const [resultJobId, setResultJobId] = useState<string | null>(null);`
- In the `DONE` branch for `jobOrigin === "workspace"`: `setResultJobId(activeJobId);`. For the history branch: after `setHistoryVersion`, `if (resultJobId) void reloadResult(resultJobId);`.
- `handleGenerate`, `handleManualGenerate`, `resetJobState`: `setResultJobId(null);`.
- Add:

```ts
  /** After a single clip was made again from the results: show the new clip files. */
  const reloadResult = async (jobId: string) => {
    try {
      const res = await axios.get(`${API_URL}/jobs/${jobId}`);
      const stamp = Date.now();
      setClips((res.data.clips || []).map((clip: Clip) => ({ ...clip, v: stamp })));
      setJobMeta(res.data.metadata || null);
    } catch (e) {
      console.error("Reloading the result failed", e);
    }
  };
```

- Return `resultJobId`; App puts it in context.

`src/pages/CreatePage.tsx`: import `ClipEditModal` and add `const [editClip, setEditClip] = useState<number | null>(null);`. Replace the `{finished && …}` block with:

```tsx
      {flow.hasClips && (finished || flow.running) && (
        <ClipsResult
          clips={ctx.clips}
          status={ctx.status}
          failedCount={ctx.failedCount}
          jobId={ctx.resultJobId ?? ""}
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
```

Delete `src/components/ClipRerenderModal.tsx` (no importer: `git grep ClipRerenderModal` shows only the file).

- [ ] **Step 6: Texts** (`node scripts/add-locale-keys.mjs`)

```json
{
  "id": { "result": {
    "title_done": "{{count}} klip siap",
    "title_partial": "{{count}} klip sudah jadi, sisanya sedang dibuat",
    "failed": "{{count}} klip gagal dibuat.",
    "download_all": "Unduh semua",
    "download": "Unduh",
    "download_failed": "Klip belum terunduh. Tekan Unduh sekali lagi.",
    "share": "Bagikan",
    "more": "Pilihan lain untuk klip {{n}}",
    "edit": "Ubah subtitle atau tampilan",
    "open_folder": "Buka folder",
    "clip_n": "Klip {{n}}",
    "new": "Buat klip dari video lain"
  } },
  "en": { "result": {
    "title_done": "{{count}} clips ready",
    "title_partial": "{{count}} clips done, the rest are being made",
    "failed": "{{count}} clips could not be made.",
    "download_all": "Download all",
    "download": "Download",
    "download_failed": "The clip was not downloaded. Press Download once more.",
    "share": "Share",
    "more": "More for clip {{n}}",
    "edit": "Change subtitles or look",
    "open_folder": "Open folder",
    "clip_n": "Clip {{n}}",
    "new": "Make clips from another video"
  } }
}
```

- [ ] **Step 7: Run all checks and look at it**

`npx vitest run` → 245 passing (230 + 3 clipInfo + 4 menu + 2 result + 1 browser + 1 desktop + plain words; record the total). `npx oxlint src` 0 errors. `npm run build`, `npm run build:cloud` exit 0. In the browser: 360 px one column, 800 px two, 1280 px three; "⋯" opens with Enter, arrows move, Escape closes; Bagikan opens the Social Kit and its copy buttons copy in one tap; Unduh semua downloads every clip (web) or asks for one folder (desktop, owner checklist). antislop lines for the ledger: the only filled button on the result screen is "Unduh semua" (or none with one clip), no star/sparkle icons left, the score badge is gone.

- [ ] **Step 8: Log and commit**

PROGRESS-LOG entry; ledger `Task 12: complete (...)` plus `Ruling: the AI score badge is dropped from the card (decoration, not in spec 4.5) — cost if wrong: one line to add back`.

```bash
git add -A src/platform src/components/ui/OverflowMenu.tsx src/components/ui/OverflowMenu.test.tsx src/lib/clipInfo.ts src/lib/clipInfo.test.ts src/components/ClipCard.tsx src/components/ClipsResult.tsx src/components/ClipsResult.test.tsx src/components/ClipRerenderModal.tsx src/hooks/useClipJobs.ts src/App.tsx src/pages/CreatePage.tsx src/locales tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): result cards with Unduh, Bagikan, a menu and Unduh semua

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
