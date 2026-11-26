import axios from "axios";
import { API_URL } from "../platform/backendUrl";

// Signed /video links (spec 4.5). The backend makes every link: in the clip data
// (video_url) or through POST /video-url. This file only puts the backend address
// in front and adds parameters the signature does not cover (v, dl).

/** An absolute address for a backend video_url ("" when there is none). */
export function videoHref(videoUrl: string, apiUrl: string, extra: { v?: number; dl?: boolean } = {}): string {
  if (!videoUrl) return "";
  const base = /^https?:\/\//i.test(videoUrl) ? videoUrl : `${apiUrl}${videoUrl.startsWith("/") ? "" : "/"}${videoUrl}`;
  const params: string[] = [];
  if (extra.v !== undefined) params.push(`v=${encodeURIComponent(String(extra.v))}`);
  if (extra.dl) params.push("dl=1");
  if (!params.length) return base;
  return `${base}${base.includes("?") ? "&" : "?"}${params.join("&")}`;
}

/** A fresh signed link for a file on the backend machine. Throws when the backend refuses. */
export async function requestVideoUrl(path: string): Promise<string> {
  const res = await axios.post(`${API_URL}/video-url`, { path });
  const url = res.data?.video_url;
  if (typeof url !== "string" || !url) throw new Error("The backend sent no video_url.");
  return url;
}

export interface VideoLinkState {
  /** The relative signed link in use ("" when the clip data had none). */
  url: string;
  /** A new link was already asked for once. */
  refreshed: boolean;
  /** Give up: show the error card. */
  failed: boolean;
}

export function initialVideoLink(videoUrl?: string): VideoLinkState {
  return { url: videoUrl || "", refreshed: false, failed: false };
}

/** After the player could not load the link: ask once for a new one; a second failure is final. */
export async function recoverVideoLink(
  state: VideoLinkState,
  path: string,
  fetchUrl: (path: string) => Promise<string> = requestVideoUrl,
): Promise<VideoLinkState> {
  if (state.refreshed) return { ...state, failed: true };
  try {
    return { url: await fetchUrl(path), refreshed: true, failed: false };
  } catch (err) {
    console.error("The backend refused a new video link:", err);
    return { ...state, refreshed: true, failed: true };
  }
}
