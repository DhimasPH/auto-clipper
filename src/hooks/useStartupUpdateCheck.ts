import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { check } from "@tauri-apps/plugin-updater";
import axios from "axios";
import { API_URL } from "../App";
import { ToastKind } from "./useToasts";

interface UseStartupUpdateCheckOptions {
  notify: (text: string, kind?: ToastKind) => void;
}

export function useStartupUpdateCheck({ notify }: UseStartupUpdateCheckOptions) {
  const { t } = useTranslation();
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    // Only run when within Tauri environment
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (!isTauri) return;

    const performUpdateCheck = async () => {
      try {
        // Wrap check() in a timeout to prevent hanging if network stalls
        const checkPromise = check();
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Update check timed out after 10s")), 10000)
        );

        const update = await Promise.race([checkPromise, timeoutPromise]);

        if (update) {
          const version = update.version || "latest";
          notify(
            t("updater.startup_update_available", {
              version,
              defaultValue: `Versi baru (${version}) telah tersedia. Silakan perbarui aplikasi pada menu pengaturan.`,
            }),
            "info"
          );
        }
      } catch (err: any) {
        const errorMsg = err?.toString() || "Unknown startup update check error";
        // Silent fail in UI: log error to backend_error.log via API
        try {
          axios.post(`${API_URL}/log-error`, {
            context: "StartupUpdaterCheck",
            error_msg: errorMsg,
          }).catch(() => {});
        } catch (_) {}
      }
    };

    // Non-blocking asynchronous trigger
    performUpdateCheck();
  }, [notify, t]);
}
