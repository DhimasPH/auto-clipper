import { describe, expect, it } from "vitest";
import { fileName, parentDir } from "./paths";

describe("paths", () => {
  it("finds the folder of a Windows or POSIX path and keeps its separators", () => {
    expect(parentDir("C:\\Users\\a\\clips\\clip_1.mp4")).toBe("C:\\Users\\a\\clips");
    expect(parentDir("/content/drive/MyDrive/x/clip_1.mp4")).toBe("/content/drive/MyDrive/x");
  });

  it("finds the file name, with a fallback for an empty path", () => {
    expect(fileName("C:\\a\\clip_1.mp4")).toBe("clip_1.mp4");
    expect(fileName("/a/b/clip_2.mp4")).toBe("clip_2.mp4");
    expect(fileName("", "clip.mp4")).toBe("clip.mp4");
  });
});
