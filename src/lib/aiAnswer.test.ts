import { describe, expect, it } from "vitest";
import { checkAiAnswer, checkWordsAnswer, stripCodeFence } from "./aiAnswer";

const moment = (extra: Record<string, unknown> = {}) => ({
  start_time: "00:01:05.200",
  end_time: "00:01:50.000",
  description_id: "Lucu",
  ...extra,
});
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

describe("checkWordsAnswer", () => {
  const original = [
    { word: "halo", start: 0, end: 0.4 },
    { word: "dunia", start: 0.4, end: 0.9 },
  ];

  it("takes the corrected words and keeps the original times", () => {
    const answer = '```json\n[{"word":"Halo,","start":9,"end":9},{"word":"dunia.","start":9,"end":9}]\n```';
    expect(checkWordsAnswer(answer, original)).toEqual({
      ok: true,
      words: [
        { word: "Halo,", start: 0, end: 0.4 },
        { word: "dunia.", start: 0.4, end: 0.9 },
      ],
    });
  });

  it("accepts {words: [...]} and chat text around the list", () => {
    const r = checkWordsAnswer('Ini hasilnya: {"words":[{"word":"a"},{"word":"b"}]} semoga membantu', original);
    expect(r.ok && r.words.map((w) => w.word)).toEqual(["a", "b"]);
  });

  it("names the problem: empty, cut off, not an answer, different length", () => {
    expect(checkWordsAnswer("  ", original)).toEqual({ ok: false, problem: "empty" });
    expect(checkWordsAnswer('[{"word":"a"},{"wo', original)).toEqual({ ok: false, problem: "cut_off" });
    expect(checkWordsAnswer("tidak ada", original)).toEqual({ ok: false, problem: "not_answer" });
    expect(checkWordsAnswer('[{"text":"a"},{"text":"b"}]', original)).toEqual({ ok: false, problem: "not_answer" });
    expect(checkWordsAnswer('[{"word":"a"}]', original)).toEqual({ ok: false, problem: "wrong_count" });
  });
});
