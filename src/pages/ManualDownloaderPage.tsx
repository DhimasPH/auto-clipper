import React, { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2, Type, Folder, Download } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { AppContext } from "../App";
import { InputGroup } from "../components/ui/InputGroup";
import { ToggleSwitch } from "../components/ui/ToggleSwitch";
import { Button } from "../components/ui/Button";

export const ManualDownloaderPage: React.FC = () => {
  const { t } = useTranslation();
  const ctx = useContext(AppContext);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadTitle, setDownloadTitle] = useState("");

  const handleDownload = () => {
    // Send an empty clips array to trigger the full video download fallback.
    ctx.setTitle(downloadTitle); // make sure context has the title
    ctx.handleManualGenerate(downloadUrl, []);
  };

  return (
    <div className="p-8">
      <PageHeader
        title={t("manualDownloader.title", "Manual Downloader")}
        subtitle={t(
          "manualDownloader.subtitle",
          "Download video penuh beserta subtitle otomatis",
        )}
      />

      <div className="max-w-3xl mx-auto bg-bg-secondary rounded-card border border-border p-6 shadow-sm flex flex-col gap-6">
        <div className="space-y-2">
          <InputGroup
            label={t("main.url_label", "Video URL")}
            placeholder={t(
              "main.url_placeholder",
              "https://youtube.com/watch?... ",
            )}
            value={downloadUrl}
            onChange={(e) => setDownloadUrl(e.target.value)}
            icon={Link2}
          />
        </div>

        <div className="space-y-2">
          <InputGroup
            label={t("main.project_title_label", "Judul Proyek (Opsional)")}
            placeholder={t(
              "main.project_title_placeholder",
              "Misal: Podcast Radit Full",
            )}
            value={downloadTitle}
            onChange={(e) => setDownloadTitle(e.target.value)}
            icon={Folder}
          />
        </div>

        <div className="space-y-2">
          <label className="text-label text-text-secondary">
            {t("main.aspect_ratio_label", "Video Aspect Ratio")}
          </label>
          <div className="grid grid-cols-2 gap-3">
            {(["16:9", "9:16"] as const).map((ratio) => (
              <button
                key={ratio}
                onClick={() => ctx.setAspectRatio(ratio)}
                className={`py-3 px-2 rounded-xl border transition-colors flex flex-col items-center gap-2 font-medium ${
                  ctx.aspectRatio === ratio
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-bg-surface text-text-secondary hover:border-border-active hover:text-text-primary"
                }`}
              >
                <span>
                  {ratio === "9:16" ? "9:16 (Vertical)" : "16:9 (Landscape)"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 bg-bg-surface rounded-xl border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg text-accent">
                <Type className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-body font-medium text-text-primary">
                  {t("main.burn_subtitles", "Burn Subtitles")}
                </h4>
                <p className="text-caption text-text-secondary">
                  {t(
                    "main.burn_subtitles_desc",
                    "Embed captions directly into the video",
                  )}
                </p>
              </div>
            </div>
            <ToggleSwitch
              checked={ctx.burnSubtitles}
              onChange={ctx.setBurnSubtitles}
            />
          </div>

          {ctx.burnSubtitles && (
            <div className="pt-4 border-t border-border">
              <div className="grid grid-cols-2 gap-3">
                {(["standard", "karaoke"] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => ctx.setCaptionStyle(style)}
                    className={`py-2 px-3 rounded-lg border font-medium transition-colors ${
                      ctx.captionStyle === style
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-bg-surface text-text-secondary hover:border-border-active"
                    }`}
                  >
                    {style === "standard"
                      ? "Standard (Baris)"
                      : "Karaoke (Word-by-word)"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {ctx.errorMsg && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-body">
            ⚠️ {ctx.errorMsg}
          </div>
        )}

        <div className="pt-2">
          <Button
            variant="primary"
            className="w-full h-14 text-lg font-bold shadow-lg shadow-accent/20 hover:shadow-accent/40 transition-shadow"
            icon={Download}
            onClick={handleDownload}
            disabled={ctx.isRunning || !downloadUrl}
          >
            {ctx.isRunning
              ? t("main.probing", "Memproses...")
              : t("manualDownloader.btn_download", "Mulai Download")}
          </Button>
        </div>
      </div>
    </div>
  );
};
