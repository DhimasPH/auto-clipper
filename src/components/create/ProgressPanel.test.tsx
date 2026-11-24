import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { CAPS, setPlatform, type Platform } from "../../platform";
import { MemoryRouter } from "react-router-dom";
import { ROUTES, SETTINGS_ANCHORS } from "../../lib/routes";
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
        <ProgressPanel
          {...base}
          step={4}
          timings={[{ stage: "tracking", seconds: 4, ok: true }]}
          current={{ stage: "render", started_at: 1, elapsed_seconds: 3, clip: 3, clips_total: 10, device: "h264_nvenc" }}
        />,
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
        <ProgressPanel
          {...base}
          step={2}
          timings={[
            { stage: "download", seconds: 8, ok: true },
            { stage: "extract_audio", seconds: 2, ok: true },
          ]}
          current={{ stage: "transcribe", started_at: 1, elapsed_seconds: 30, device: "cpu" }}
        />,
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

  it("says when Teliti was not installed and Standar was used, with a link to install it where add-ons exist (SP3)", () => {
    const meta = { tracking_engine_requested: "mediapipe", tracking_engine_used: "haar", tracking_fallback_reason: "addon_not_installed" };
    const timings = [{ stage: "tracking", seconds: 4, ok: true, ...meta }];
    const panel = (m: typeof meta) => (
      <MemoryRouter>
        <ProgressPanel {...base} step={4} timings={timings} current={{ stage: "render", started_at: 1, clip: 1 }} meta={m} />
      </MemoryRouter>
    );
    act(() => root.render(panel(meta)));
    expect(container.textContent).toContain(i18n.t("progress.fallback_tracking"));
    const link = [...container.querySelectorAll("a")].find((a) => a.textContent === i18n.t("progress.fallback_tracking_link"))!;
    expect(link.getAttribute("href")).toBe(`${ROUTES.settings}#${SETTINGS_ANCHORS.faceTracking}`);

    setPlatform({ caps: CAPS.cloud } as Platform);
    act(() => root.render(panel({ ...meta })));
    expect(container.textContent).not.toContain(i18n.t("progress.fallback_tracking"));
    expect(container.textContent).toContain(i18n.t("progress.fallback_tracking_unavailable"));
    expect(container.querySelector("a")).toBeNull();
  });

  it("does not repeat an old project's tracker note before this run's tracking has reported (Resume)", () => {
    const stale = { tracking_engine_requested: "mediapipe", tracking_engine_used: "haar", tracking_fallback_reason: "addon_not_installed" };
    act(() => root.render(<ProgressPanel {...base} step={4} timings={[]} current={{ stage: "tracking", started_at: 1, clip: 1 }} meta={stale} />));
    expect(container.textContent).not.toContain(i18n.t("progress.fallback_tracking"));
  });
});
