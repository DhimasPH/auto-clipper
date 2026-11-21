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
