import React, { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { Download } from "lucide-react";
import { AppContext } from "../../App";
import { ErrorCard } from "../ErrorCard";
import { Button } from "../ui/Button";
import { InputGroup } from "../ui/InputGroup";
import { Select } from "../ui/Select";
import { useErrorActions } from "../../hooks/useErrorActions";
import { autoProjectTitle, linkProblem } from "../../lib/createFlow";
import { ROUTES, SETTINGS_ANCHORS } from "../../lib/routes";

/** Download a full video without cutting clips (moved from the old ManualDownloaderPage, spec 4.5). */
export const DownloaderPanel: React.FC = () => {
  const { t } = useTranslation();
  const ctx = useContext(AppContext);
  const { hash } = useLocation();
  const anchor = `#${SETTINGS_ANCHORS.downloader}`;
  // Old links (/downloader, /pengaturan#pengunduh) open the panel; the user can still close it.
  const [open, setOpen] = useState(hash === anchor);
  const [seenHash, setSeenHash] = useState(hash);
  if (hash !== seenHash) {
    setSeenHash(hash);
    if (hash === anchor) setOpen(true);
  }
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [quality, setQuality] = useState<string>(ctx.quality || "best");
  // The job error lives in app state and may belong to a clip job: show it only after starting here.
  const [startedHere, setStartedHere] = useState(false);
  const problem = url.trim() ? linkProblem(url) : null;
  const errorActions = useErrorActions({ jobId: ctx.failedJobId, origin: "workspace" });

  const startDownload = () => {
    if (linkProblem(url) !== null) return;
    const link = url.trim();
    const resolvedTitle = title.trim() || autoProjectTitle({ kind: "link", url: link }, new Date());
    setStartedHere(true);
    void ctx.handleManualGenerate(link, [], true, resolvedTitle, quality);
  };

  return (
    <details
      id={SETTINGS_ANCHORS.downloader}
      tabIndex={-1}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="scroll-mt-16 rounded-card border border-border bg-bg-secondary p-5"
    >
      <summary className="flex min-h-[44px] cursor-pointer items-center rounded text-card-title text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        {t("settings.downloader_title")}
      </summary>
      <p className="mt-1 text-body text-text-secondary">{t("settings.downloader_subtitle")}</p>
      <div className="mt-4 flex flex-col gap-4">
        <InputGroup
          label={t("create.link_label")}
          placeholder="https://youtube.com/watch?v=..."
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          error={problem === "unsupported"}
          helperText={problem === "unsupported" ? t("create.link_unsupported") : undefined}
        />
        <InputGroup
          label={t("create.project_name")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          helperText={t("create.project_name_help")}
        />
        <Select
          label={t("create.quality")}
          value={quality}
          onChange={(e) => setQuality(e.target.value)}
          options={[
            { label: t("create.quality_auto"), value: "best" },
            { label: "2160p (4K)", value: "2160p" },
            { label: "1440p (2K)", value: "1440p" },
            { label: "1080p", value: "1080p" },
            { label: "720p", value: "720p" },
            { label: "480p", value: "480p" },
          ]}
        />
        {startedHere && ctx.errorInfo && <ErrorCard info={ctx.errorInfo} handlers={errorActions} announce />}
        {/* A request that failed without error_info (old backend): its own words, as on Buat klip. */}
        {startedHere && ctx.errorMsg && !ctx.errorInfo && (
          <p role="alert" className="text-body text-error break-words">
            {ctx.errorMsg}
          </p>
        )}
        {ctx.isRunning && (
          <p role="status" className="text-body text-text-secondary">
            {t("settings.downloader_running")}{" "}
            <Link to={ROUTES.create} className="rounded font-medium text-accent underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              {t("settings.downloader_view_progress")}
            </Link>
          </p>
        )}
        <div>
          {/* The download icon says what the button does at a glance; the text carries the meaning. */}
          <Button
            variant="outline"
            type="button"
            icon={Download}
            disabled={ctx.isRunning || linkProblem(url) !== null}
            onClick={startDownload}
          >
            {t("settings.downloader_btn")}
          </Button>
        </div>
      </div>
    </details>
  );
};
