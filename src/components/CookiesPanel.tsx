import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldAlert, Trash2, Upload } from "lucide-react";
import { API_URL } from "../App";
import { Button } from "./ui/Button";
import { ErrorCard } from "./ErrorCard";
import type { CookiesStatus, ErrorInfo } from "../types/errorInfo";
import { requestError, toLang } from "../lib/errorInfo";

interface CookiesPanelProps {
  /** Called after a file was accepted and stored. */
  onUploaded?: (status: CookiesStatus) => void;
}

/** Status, export guide, upload and delete for the YouTube cookies.txt. */
export const CookiesPanel: React.FC<CookiesPanelProps> = ({ onUploaded }) => {
  const { t, i18n } = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<CookiesStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState<"upload" | "delete" | null>(null);
  const [uploadError, setUploadError] = useState<{ message: string; info: ErrorInfo | null } | null>(null);
  const [notice, setNotice] = useState("");

  const locale = toLang(i18n.language) === "en" ? "en-GB" : "id-ID";
  const formatDate = (iso: string | null) => {
    const date = iso ? new Date(iso) : null;
    return date && !isNaN(date.getTime())
      ? date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
      : "";
  };

  const loadStatus = async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const res = await axios.get(`${API_URL}/api/settings/cookies`);
      setStatus(res.data.cookies || null);
    } catch (err) {
      console.error("Failed to load cookies status:", err);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const chooseFile = () => fileInput.current?.click();

  const upload = async (file: File) => {
    setBusy("upload");
    setUploadError(null);
    setNotice("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await axios.post(`${API_URL}/api/settings/cookies`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const next: CookiesStatus = res.data.cookies;
      setStatus(next);
      setLoadFailed(false);
      setNotice(t("cookies.saved", "File cookies tersimpan."));
      onUploaded?.(next);
    } catch (err) {
      setUploadError(requestError(err, t("cookies.upload_failed", "File cookies gagal diunggah. Coba lagi.")));
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm(t("cookies.delete_confirm", "Hapus file cookies yang tersimpan?"))) return;
    setBusy("delete");
    setUploadError(null);
    setNotice("");
    try {
      const res = await axios.delete(`${API_URL}/api/settings/cookies`);
      setStatus(res.data.cookies || null);
      setNotice(t("cookies.deleted", "File cookies dihapus."));
    } catch (err) {
      setUploadError(requestError(err, t("cookies.delete_failed", "File cookies gagal dihapus. Coba lagi.")));
    } finally {
      setBusy(null);
    }
  };

  const present = !!status?.present;
  const usable = present && !!status?.valid;
  const until = formatDate(status?.latest_expiry ?? null);
  const uploadedAt = formatDate(status?.uploaded_at ?? null);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-body text-text-secondary m-0">
        {t("cookies.intro", "Kalau YouTube meminta verifikasi sebelum video bisa diunduh, unggah file cookies.txt di sini. File itu berisi bukti login dari browser Anda.")}
      </p>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
        <div className="min-w-0">
          <h4 className="text-card-title text-text-primary">{t("cookies.warn_title", "Pakai akun cadangan, bukan akun utama")}</h4>
          <p className="text-body text-text-primary mt-1">
            {t("cookies.warn_body", "YouTube bisa membatasi akun yang cookies-nya dipakai untuk mengunduh. Pakai akun Google lain yang khusus untuk ini.")}
          </p>
        </div>
      </div>

      <div>
        <h4 className="text-label text-text-primary mb-2">{t("cookies.guide_title", "Cara mengambil file cookies.txt")}</h4>
        <ol className="list-decimal pl-5 m-0 space-y-1.5 text-body text-text-primary">
          <li>{t("cookies.step1", "Di browser komputer, pasang ekstensi \"Get cookies.txt LOCALLY\".")}</li>
          <li>{t("cookies.step2", "Buka youtube.com, lalu login dengan akun cadangan.")}</li>
          <li>{t("cookies.step3", "Di tab YouTube itu, klik ikon ekstensi tadi, pilih Export, lalu unggah file hasilnya di sini.")}</li>
        </ol>
      </div>

      <div className="rounded-xl border border-border bg-bg-surface p-4 flex flex-col gap-3">
        {loading ? (
          <div className="flex items-center gap-2 text-body text-text-secondary">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            {t("cookies.status_loading", "Memeriksa cookies…")}
          </div>
        ) : loadFailed ? (
          <div className="flex items-center gap-3 flex-wrap text-body text-text-primary">
            <AlertTriangle className="w-4 h-4 text-error shrink-0" aria-hidden="true" />
            <span className="flex-1 min-w-0">
              {t("cookies.status_load_failed", "Status cookies tidak bisa dimuat. Pastikan aplikasi masih terhubung, lalu coba lagi.")}
            </span>
            <Button type="button" size="sm" variant="outline" icon={RefreshCw} onClick={loadStatus}>
              {t("cookies.reload", "Muat ulang")}
            </Button>
          </div>
        ) : !present ? (
          <p className="text-body text-text-primary m-0">{t("cookies.status_none", "Belum ada file cookies yang tersimpan.")}</p>
        ) : (
          <>
            {usable && (
              <div className="flex items-start gap-2 text-body text-text-primary">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="m-0 font-medium">{t("cookies.status_ok", "File cookies tersimpan dan masih berlaku.")}</p>
                  {until && <p className="m-0 mt-0.5">{t("cookies.status_until", { date: until, defaultValue: "Berlaku sampai {{date}}." })}</p>}
                  {uploadedAt && (
                    <p className="m-0 mt-0.5 text-text-secondary">
                      {t("cookies.status_uploaded", { date: uploadedAt, defaultValue: "Diunggah {{date}}." })}
                    </p>
                  )}
                </div>
              </div>
            )}
            {usable && !status?.logged_in && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" aria-hidden="true" />
                <div className="min-w-0 text-body text-text-primary">
                  <p className="m-0 font-medium">{t("cookies.logged_out_title", "File ini bukan dari akun yang sedang login")}</p>
                  <p className="m-0 mt-0.5">
                    {t("cookies.logged_out_body", "Cookies ini diekspor saat browser belum login ke YouTube, jadi YouTube tetap akan meminta verifikasi. Login ke YouTube dengan akun cadangan, lalu ekspor dan unggah ulang.")}
                  </p>
                </div>
              </div>
            )}
            {!usable && status?.error_info && (
              <ErrorCard info={status.error_info} handlers={{ upload_cookies: chooseFile }} />
            )}
          </>
        )}

        {notice && !uploadError && <p role="status" className="text-body text-success m-0">{notice}</p>}

        {uploadError &&
          (uploadError.info ? (
            <ErrorCard info={uploadError.info} handlers={{ upload_cookies: chooseFile }} announce />
          ) : (
            <p role="alert" className="text-body text-error m-0">{uploadError.message}</p>
          ))}

        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept=".txt,text/plain"
            className="sr-only"
            tabIndex={-1}
            aria-label={t("cookies.file_label", "File cookies.txt")}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // picking the same file again must fire onChange
              if (file) upload(file);
            }}
          />
          <Button
            type="button"
            variant={present ? "outline" : "primary"}
            icon={Upload}
            loading={busy === "upload"}
            disabled={busy !== null || loading}
            onClick={chooseFile}
          >
            {busy === "upload"
              ? t("cookies.btn_uploading", "Mengunggah…")
              : present
                ? t("cookies.btn_replace", "Ganti file cookies")
                : t("cookies.btn_choose", "Pilih file cookies.txt")}
          </Button>
          {present && (
            <Button type="button" variant="danger" icon={Trash2} loading={busy === "delete"} disabled={busy !== null} onClick={remove}>
              {t("cookies.btn_delete", "Hapus cookies")}
            </Button>
          )}
        </div>

        <p className="text-caption text-text-secondary m-0">
          {t("cookies.privacy", "File disimpan di komputer ini dan hanya dipakai saat mengunduh video.")}
        </p>
      </div>
    </div>
  );
};

export default CookiesPanel;
