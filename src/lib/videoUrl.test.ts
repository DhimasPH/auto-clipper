import { readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import React, { StrictMode, act } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import { describe, expect, it, vi } from "vitest";
import { useSignedVideo } from "../hooks/useSignedVideo";
import { sourceFiles } from "../test/sourceFiles";
import { initialVideoLink, recoverVideoLink, videoHref } from "./videoUrl";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SIGNED = "/video?path=C%3A%5Cclips%5Cclip_1.mp4&sig=abc";

describe("videoHref", () => {
  it("puts the backend address in front of the backend's relative link", () => {
    expect(videoHref(SIGNED, "http://127.0.0.1:5123")).toBe(`http://127.0.0.1:5123${SIGNED}`);
  });

  it("keeps an absolute link as it is", () => {
    expect(videoHref(`https://be.example.com${SIGNED}`, "http://127.0.0.1:5123")).toBe(`https://be.example.com${SIGNED}`);
  });

  it("adds the cache-buster and the download flag after the signature", () => {
    expect(videoHref(SIGNED, "https://be.example.com", { v: 3, dl: true })).toBe(`https://be.example.com${SIGNED}&v=3&dl=1`);
    expect(videoHref("/video", "https://be.example.com", { dl: true })).toBe("https://be.example.com/video?dl=1");
  });

  it("gives no address for a clip without a link", () => {
    expect(videoHref("", "https://be.example.com", { v: 1 })).toBe("");
  });
});

describe("recoverVideoLink", () => {
  it("asks the backend once for a new link after the player was refused", async () => {
    const fetchUrl = vi.fn(async () => "/video?path=x&sig=new");

    const next = await recoverVideoLink(initialVideoLink(SIGNED), "C:\\clips\\clip_1.mp4", fetchUrl);

    expect(fetchUrl).toHaveBeenCalledWith("C:\\clips\\clip_1.mp4");
    expect(next).toEqual({ url: "/video?path=x&sig=new", refreshed: true, failed: false });
  });

  it("gives up when the new link is refused too", async () => {
    const fetchUrl = vi.fn(async () => "/video?path=x&sig=newer");

    const after = await recoverVideoLink({ url: "/video?path=x&sig=new", refreshed: true, failed: false }, "x", fetchUrl);

    expect(fetchUrl).not.toHaveBeenCalled();
    expect(after).toEqual({ url: "/video?path=x&sig=new", refreshed: true, failed: true });
  });

  it("gives up when the backend will not sign a new link", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchUrl = vi.fn(async () => {
      throw new Error("403");
    });

    const after = await recoverVideoLink(initialVideoLink(SIGNED), "x", fetchUrl);

    expect(after).toEqual({ url: SIGNED, refreshed: true, failed: true });
    vi.restoreAllMocks();
  });
});

describe("useSignedVideo", () => {
  it("asks POST /video-url only once under StrictMode when a clip has no link, and not at all when it has one", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { video_url: SIGNED } });
    const seen: string[] = [];
    function Probe({ path, videoUrl }: { path: string; videoUrl?: string }) {
      const v = useSignedVideo(path, videoUrl);
      seen.push(v.src);
      return React.createElement("span", null, v.src);
    }

    const box = document.createElement("div");
    const root = createRoot(box);
    await act(async () => {
      root.render(React.createElement(StrictMode, null, React.createElement(Probe, { path: "c1.mp4", videoUrl: SIGNED })));
    });
    expect(post).not.toHaveBeenCalled();

    await act(async () => {
      root.render(React.createElement(StrictMode, null, React.createElement(Probe, { path: "c2.mp4" })));
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(box.textContent).toBe(SIGNED);

    act(() => root.unmount());
    vi.restoreAllMocks();
  });
});

// The backend signs every link (spec 4.5); a link built here would be refused.
const SRC = resolve(process.cwd(), "src");

describe("video links come from the backend", () => {
  it("no source file builds a /video?path= link itself", () => {
    const offenders = sourceFiles(SRC)
      .map((file) => relative(SRC, file).split(sep).join("/"))
      .filter((file) => file !== "lib/videoUrl.ts")
      .filter((file) => readFileSync(join(SRC, file), "utf8").includes("/video?path="));
    expect(offenders).toEqual([]);
  });
});
