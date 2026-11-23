import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { API_URL } from "../../platform/backendUrl";
import { copyText } from "../../lib/clipboard";
import { Button } from "../ui/Button";

type LogType = "app" | "error" | "ai";
const LOG_TYPES: LogType[] = ["app", "error", "ai"];

type CopyState = "idle" | "copied" | "failed";

/** "Detail teknis" in Bantuan: the backend logs, closed by default and loaded only when opened. */
export const LogViewer: React.FC = () => {
  const { t } = useTranslation();
  const [logType, setLogType] = useState<LogType>("app");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [copy, setCopy] = useState<CopyState>("idle");
  const box = useRef<HTMLPreElement>(null);
  const request = useRef(0);
  const isOpen = useRef(false);

  const load = async (type: LogType) => {
    const id = ++request.current;
    setLoading(true);
    setLoadFailed(false);
    setCopy("idle");
    try {
      const res = await axios.get(`${API_URL}/logs/${type}`);
      if (id !== request.current) return;
      setContent(typeof res.data?.content === "string" ? res.data.content : "");
    } catch {
      if (id !== request.current) return;
      setContent("");
      setLoadFailed(true);
    } finally {
      if (id === request.current) setLoading(false);
    }
  };

  // Newest lines are at the end.
  useEffect(() => {
    if (box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [content]);

  useEffect(() => {
    if (copy !== "copied") return;
    const timer = setTimeout(() => setCopy("idle"), 2000);
    return () => clearTimeout(timer);
  }, [copy]);

  const copyLog = async () => {
    setCopy((await copyText(content)) ? "copied" : "failed");
  };

  return (
    <details
      className="rounded-card border border-border bg-bg-secondary p-5"
      // Loaded each time it is opened, so the newest lines show.
      onToggle={(e) => {
        const nowOpen = e.currentTarget.open;
        if (nowOpen && !isOpen.current) void load(logType);
        isOpen.current = nowOpen;
      }}
    >
      <summary className="flex min-h-[44px] cursor-pointer items-center rounded text-card-title text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        {t("settings.logs_title")}
      </summary>
      <p className="mt-1 text-body text-text-secondary">{t("settings.logs_desc")}</p>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="group" aria-label={t("settings.logs_kind_label")} className="flex flex-wrap gap-2">
            {LOG_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={logType === type}
                onClick={() => {
                  setLogType(type);
                  void load(type);
                }}
                className={`min-h-[44px] rounded-button border px-3 text-label transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary ${
                  logType === type
                    ? "border-accent bg-accent-muted text-text-primary"
                    : "border-border-active bg-bg-secondary text-text-primary hover:bg-bg-surface"
                }`}
              >
                {t(`settings.logs_type_${type}`)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" type="button" loading={loading} onClick={() => void load(logType)}>
              {t("settings.logs_refresh")}
            </Button>
            <Button variant="outline" type="button" disabled={!content || loading} onClick={() => void copyLog()}>
              {t(copy === "copied" ? "settings.logs_copied" : "settings.logs_copy")}
            </Button>
          </div>
        </div>

        {loadFailed && (
          <p role="alert" className="text-body text-error">
            {t("settings.logs_fetch_error")}
          </p>
        )}
        {copy === "failed" && (
          <p role="alert" className="text-body text-error">
            {t("settings.logs_copy_failed")}
          </p>
        )}

        {loading && !content ? (
          <p role="status" className="text-body text-text-secondary">
            {t("settings.logs_loading")}
          </p>
        ) : !loadFailed && !content.trim() ? (
          <p className="text-body text-text-secondary">{t("settings.logs_empty")}</p>
        ) : content ? (
          <pre
            ref={box}
            tabIndex={0}
            aria-label={t(`settings.logs_type_${logType}`)}
            className="max-h-[400px] min-h-[160px] overflow-auto whitespace-pre-wrap break-words rounded-input border border-border bg-bg-surface p-3 font-mono text-body text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {content}
          </pre>
        ) : null}
      </div>
    </details>
  );
};
