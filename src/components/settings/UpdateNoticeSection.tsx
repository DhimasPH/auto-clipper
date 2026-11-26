import React from "react";
import { useTranslation } from "react-i18next";
import { Download, RefreshCw } from "lucide-react";
import type { UpdateNotice } from "../../hooks/useUpdateNotice";
import { platform } from "../../platform";
import { Button } from "../ui/Button";

/** Pengaturan, Bantuan on Auto Clipper Web (SP4 spec 4.5): a new version, the latest, or "cannot check now". */
export const UpdateNoticeSection: React.FC<{ notice: UpdateNotice }> = ({ notice }) => {
  const { t } = useTranslation();
  const { view, latest, link, recheck } = notice;
  const download = () => {
    if (!link) return;
    platform()
      .openExternal(link)
      .catch((err) => console.error("Opening the download failed", err));
  };

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-bg-secondary p-5">
      <h3 className="text-card-title text-text-primary">{t("update_notice.title")}</h3>
      {/* Status, not an error card: a failed check is no problem for the user (spec 5). */}
      <div role="status">
        {view === "checking" && <p className="text-body text-text-secondary">{t("update_notice.checking")}</p>}
        {view === "available" && <p className="text-body text-text-primary">{t("update_notice.available", { version: latest })}</p>}
        {view === "latest" && <p className="text-body text-text-secondary">{t("update_notice.latest")}</p>}
        {view === "failed" && <p className="text-body text-text-secondary">{t("update_notice.failed")}</p>}
      </div>

      {view === "available" && (
        <>
          {/* Outline: Pengaturan keeps its one filled button elsewhere. */}
          <Button variant="outline" icon={Download} className="self-start" onClick={download}>
            {t("update_notice.download")}
          </Button>
          <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 text-body text-text-secondary">
            <li>{t("update_notice.step_download")}</li>
            <li>{t("update_notice.step_close")}</li>
            <li>{t("update_notice.step_extract")}</li>
          </ol>
          <p className="text-body text-text-secondary">{t("update_notice.keeps_data")}</p>
        </>
      )}
      {view === "failed" && (
        <Button variant="outline" icon={RefreshCw} className="self-start" onClick={() => void recheck()}>
          {t("update_notice.retry")}
        </Button>
      )}
      {view === "latest" && (
        <Button variant="outline" className="self-start" onClick={() => void recheck()}>
          {t("update_notice.check")}
        </Button>
      )}
    </div>
  );
};
