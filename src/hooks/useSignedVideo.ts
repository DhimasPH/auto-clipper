import { useCallback, useEffect, useRef, useState } from "react";
import { initialVideoLink, recoverVideoLink, type VideoLinkState } from "../lib/videoUrl";

/**
 * The signed link of one clip (spec 4.5). When the player is refused, asks the
 * backend once for a new link (spec 5); after that `failed` is true and the
 * clip shows an error card whose "Coba lagi" tries once more.
 */
export function useSignedVideo(path: string, videoUrl?: string) {
  const key = `${path}\0${videoUrl || ""}`;
  const [entry, setEntry] = useState<{ key: string; link: VideoLinkState }>(() => ({
    key,
    link: initialVideoLink(videoUrl),
  }));
  const requestedKey = useRef<string | null>(null);
  const link = entry.key === key ? entry.link : initialVideoLink(videoUrl);

  const recover = useCallback(
    (from: VideoLinkState) => {
      recoverVideoLink(from, path).then((next) => setEntry({ key, link: next }));
    },
    [key, path],
  );

  // Clip data without a link (a backend from before SP1): ask for one straight away, once per (path, videoUrl).
  useEffect(() => {
    if (!link.url && !link.refreshed && requestedKey.current !== key) {
      requestedKey.current = key;
      recover(link);
    }
  }, [key, link, recover]);

  return {
    src: link.url,
    failed: link.failed,
    onError: () => recover(link),
    retry: () => recover({ ...link, refreshed: false, failed: false }),
  };
}
