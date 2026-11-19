/** The folder part of a Windows or POSIX path, keeping its separators. */
export function parentDir(p: string): string {
  const lastSlash = p.replace(/\\/g, "/").lastIndexOf("/");
  return p.substring(0, lastSlash);
}

/** The last part of a path. */
export function fileName(p: string, fallback = "clip.mp4"): string {
  return p.replace(/\\/g, "/").split("/").pop() || fallback;
}

/** The folder to open for a file: its parent, or the path itself when it has none (never ""). */
export function folderToOpen(p: string): string {
  return parentDir(p) || p;
}
