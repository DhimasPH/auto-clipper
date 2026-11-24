import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { API_URL } from "../platform/backendUrl";
import { asAddonStatus, asAddonStatuses, type AddonId, type AddonStatus } from "../lib/addons";
import { requestError } from "../lib/errorInfo";
import type { ErrorInfo } from "../types/errorInfo";

export type { AddonStatus } from "../lib/addons";

/** Checks again this often while an add-on downloads (SP3 spec 4.2.D). */
export const ADDON_POLL_MS = 500;

export interface AddonFailure {
  action: "install" | "remove";
  /** The server's own words, for "Detail teknis". */
  technical: string;
  info: ErrorInfo | null;
}

/**
 * The optional add-ons (GET /api/settings/addons) with install and remove.
 *
 * `enabled` false asks nothing from the server (cloud, or a server too old to know add-ons).
 * `watch`: poll only while this add-on downloads (each section on the page watches its own).
 * A failed or odd answer leaves the list empty without an error, so the screen keeps working
 * on older servers (Ruling P8). The download runs on the server: leaving the page does not stop
 * it, and the next visit picks the progress up again.
 */
export function useAddons(enabled: boolean, watch?: AddonId) {
  const [addons, setAddons] = useState<Record<string, AddonStatus>>({});
  const [pending, setPending] = useState<Partial<Record<AddonId, "install" | "remove">>>({});
  const [failures, setFailures] = useState<Partial<Record<AddonId, AddonFailure>>>({});
  // Removal waits for the app to open again (ADDON_IN_USE). The server does not report this, so it
  // lasts while the page is open; pressing remove again on a later visit gets the same answer.
  const [scheduled, setScheduled] = useState<Partial<Record<AddonId, boolean>>>({});
  const [round, setRound] = useState(0);
  // Bumped after every answer, also a failed one, so polling goes on through a dropped request.
  const [answers, setAnswers] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void (async () => {
      try {
        const res = await axios.get(`${API_URL}/api/settings/addons`);
        if (active) setAddons(asAddonStatuses(res?.data));
      } catch (err) {
        if (active) console.warn("Add-on status unavailable:", err);
      } finally {
        if (active) setAnswers((n) => n + 1);
      }
    })();
    return () => {
      active = false;
    };
  }, [enabled, round]);

  const downloading = watch ? !!addons[watch]?.downloading : Object.values(addons).some((a) => a.downloading);
  useEffect(() => {
    if (!enabled || !downloading) return;
    const timer = setTimeout(() => setRound((n) => n + 1), ADDON_POLL_MS);
    return () => clearTimeout(timer);
  }, [enabled, downloading, answers]);

  // Requests on their way, set before React draws the busy button: a quick second press sends nothing.
  const inFlight = useRef(new Set<AddonId>());
  const run = useCallback(async (id: AddonId, action: "install" | "remove") => {
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    setPending((p) => ({ ...p, [id]: action }));
    setFailures((f) => ({ ...f, [id]: undefined }));
    // A new try replaces the failure of the last download in the background.
    if (action === "install") setAddons((all) => (all[id]?.error_info ? { ...all, [id]: { ...all[id], error_info: null } } : all));
    try {
      const res =
        action === "install"
          ? await axios.post(`${API_URL}/api/settings/addons/${id}/download`)
          : await axios.delete(`${API_URL}/api/settings/addons/${id}`);
      const status = asAddonStatus(res?.data?.addon);
      if (status) setAddons((all) => ({ ...all, [id]: status }));
      setAnswers((n) => n + 1);
    } catch (err) {
      const { message, info } = requestError(err, "");
      setFailures((f) => ({ ...f, [id]: { action, technical: info?.technical || message, info } }));
      // In use: the files stay until the app opens again, so the card stops offering to remove them.
      if (action === "remove" && info?.code === "ADDON_IN_USE") setScheduled((s) => ({ ...s, [id]: true }));
      // The request failed, but the add-on may have changed (e.g. a download already running): read it again.
      setRound((n) => n + 1);
    } finally {
      inFlight.current.delete(id);
      setPending((p) => ({ ...p, [id]: undefined }));
    }
  }, []);

  const install = useCallback((id: AddonId) => run(id, "install"), [run]);
  const remove = useCallback((id: AddonId) => run(id, "remove"), [run]);

  return { addons, pending, failures, removalScheduled: scheduled, install, remove };
}
