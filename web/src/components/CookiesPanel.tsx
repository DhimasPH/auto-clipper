import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldAlert, Trash2, Upload } from "lucide-react";
import { apiDeleteCookies, apiGetCookies, apiUploadCookies } from "../api";
import { ErrorCard } from "./ErrorCard";
import type { CookiesStatus, ErrorInfo } from "../types/errorInfo";
import { requestError } from "../lib/errorInfo";
import { useLang } from "../lib/lang";
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from "../lib/ui";

interface CookiesPanelProps {
  /** Called after a file was accepted and stored. */
  onUploaded?: (status: CookiesStatus) => void;
}

/** Status, export guide, upload and delete for the YouTube cookies.txt. */
export const CookiesPanel: React.FC<CookiesPanelProps> = ({ onUploaded }) => {
  const { lang, t } = useLang();
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<CookiesStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<"upload" | "delete" | null>(null);
  const [uploadError, setUploadError] = useState<{ message: string; info: ErrorInfo | null } | null>(null);
  const [notice, setNotice] = useState("");

  const locale = lang === "en" ? "en-GB" : "id-ID";
  const formatDate = (iso: string | null) => {
    const date = iso ? new Date(iso) : null;
    return date && !isNaN(date.getTime())
      ? date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
      : "";
  };

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      setStatus((await apiGetCookies()) || null);
    } catch (err) {
      console.error("Failed to load cookies status:", err);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const chooseFile = () => fileInput.current?.click();

  const upload = async (file: File) => {
    setBusy("upload");
    setUploadError(null);
    setNotice("");
    try {
      const next = await apiUploadCookies(file);
      setStatus(next);
      setLoadFailed(false);
      setNotice(t("cookies.saved"));
      onUploaded?.(next);
    } catch (err) {
      setUploadError(requestError(err, t("cookies.upload_failed")));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm(t("cookies.delete_confirm"))) return;
    setBusy("delete");
    setUploadError(null);
    setNotice("");
    try {
      setStatus((await apiDeleteCookies()) || null);
      setNotice(t("cookies.deleted"));
    } catch (err) {
      setUploadError(requestError(err, t("cookies.delete_failed")));
    } finally {
      setBusy(null);
    }
  };

  const present = !!status?.present;
  const usable = present && !!status?.valid;
  const until = formatDate(status?.latest_expiry ?? null);
  const uploadedAt = formatDate(status?.uploaded_at ?? null);

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <p className="text-sm text-text-secondary m-0 leading-relaxed">{t("cookies.intro")}</p>

      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-amber-900">{t("cookies.warn_title")}</h4>
          <p className="text-sm text-slate-700 mt-1 leading-relaxed">{t("cookies.warn_body")}</p>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-text-primary mb-2">{t("cookies.guide_title")}</h4>
        <ol className="list-decimal pl-5 m-0 space-y-1.5 text-sm text-text-primary leading-relaxed">
          <li>{t("cookies.step1")}</li>
          <li>{t("cookies.step2")}</li>
          <li>{t("cookies.step3")}</li>
        </ol>
      </div>

      <div className="p-4 rounded-xl bg-bg-surface border border-border flex flex-col gap-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 className="w-4 h-4 animate-spin text-purple-600" aria-hidden="true" />
            {t("cookies.status_loading")}
          </div>
        ) : loadFailed ? (
          <div className="flex items-center gap-3 flex-wrap text-sm text-text-primary">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
            <span className="flex-1 min-w-0">{t("cookies.status_load_failed")}</span>
            <button type="button" onClick={loadStatus} className={BTN_SECONDARY}>
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              {t("cookies.reload")}
            </button>
          </div>
        ) : !present ? (
          <p className="text-sm text-text-primary m-0">{t("cookies.status_none")}</p>
        ) : (
          <>
            {usable && (
              <div className="flex items-start gap-2 text-sm text-text-primary">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="m-0 font-semibold">{t("cookies.status_ok")}</p>
                  {until && <p className="m-0 mt-0.5">{t("cookies.status_until", { date: until })}</p>}
                  {uploadedAt && <p className="m-0 mt-0.5 text-text-secondary">{t("cookies.status_uploaded", { date: uploadedAt })}</p>}
                </div>
              </div>
            )}
            {usable && !status?.logged_in && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0 text-sm text-slate-700 leading-relaxed">
                  <p className="m-0 font-bold text-amber-900">{t("cookies.logged_out_title")}</p>
                  <p className="m-0 mt-0.5">{t("cookies.logged_out_body")}</p>
                </div>
              </div>
            )}
            {!usable && status?.error_info && (
              <ErrorCard info={status.error_info} handlers={{ upload_cookies: chooseFile }} />
            )}
          </>
        )}

        {notice && !uploadError && <p role="status" className="text-sm text-green-700 font-medium m-0">{notice}</p>}

        {uploadError &&
          (uploadError.info ? (
            <ErrorCard info={uploadError.info} handlers={{ upload_cookies: chooseFile }} announce />
          ) : (
            <p role="alert" className="text-sm text-red-600 m-0">{uploadError.message}</p>
          ))}

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept=".txt,text/plain"
            className="sr-only"
            tabIndex={-1}
            aria-label={t("cookies.file_label")}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // picking the same file again must fire onChange
              if (file) upload(file);
            }}
          />
          <button
            type="button"
            onClick={chooseFile}
            disabled={busy !== null || loading}
            className={present ? BTN_SECONDARY : BTN_PRIMARY}
          >
            {busy === "upload" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {busy === "upload" ? t("cookies.btn_uploading") : present ? t("cookies.btn_replace") : t("cookies.btn_choose")}
          </button>
          {present && (
            <button type="button" onClick={remove} disabled={busy !== null} className={BTN_DANGER}>
              {busy === "delete" ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {t("cookies.btn_delete")}
            </button>
          )}
        </div>

        <p className="text-xs text-text-secondary m-0">{t("cookies.privacy")}</p>
      </div>
    </div>
  );
};

export default CookiesPanel;
