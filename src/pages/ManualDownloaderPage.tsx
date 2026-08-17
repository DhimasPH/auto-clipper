import React, { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2, Type, Folder, Download, Gamepad2 } from "lucide-react";
import { SHOW_EXPERIMENTAL_FEATURES } from "../config/features";
import { PageHeader } from "../components/ui/PageHeader";
import { AppContext } from "../App";
import { API_URL } from "../config/api";
import axios from "axios";
import { InputGroup } from "../components/ui/InputGroup";
import { ToggleSwitch } from "../components/ui/ToggleSwitch";
import { Select } from "../components/ui/Select";
import { Button } from "../components/ui/Button";
import { CanvasConfigControls } from "../components/ui/CanvasConfigControls";
import { CanvasConfig, DEFAULT_CANVAS_CONFIG } from "../types/canvas";
import { SubtitleConfig, DEFAULT_SUBTITLE_CONFIG } from "../types/subtitle";

export const ManualDownloaderPage: React.FC = () => {
  const { t } = useTranslation();
  const ctx = useContext(AppContext);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadTitle, setDownloadTitle] = useState("");
  const [quality, setQuality] = useState<"best" | "2160p" | "1440p" | "1080p" | "720p" | "480p">("best");
  const [availHeights, setAvailHeights] = useState<number[]>([]);
  const [probing, setProbing] = useState(false);

  // Local state to prevent leaking to main generator (Workspace)
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "4:5" | "9:16" | "16:9">("9:16");
  const [burnSubtitles, setBurnSubtitles] = useState(true);
  const [captionStyle, setCaptionStyle] = useState<"standard" | "karaoke">("karaoke");
  const [isGamingVideo, setIsGamingVideo] = useState(false);
  const [canvasConfig, setCanvasConfig] = useState<CanvasConfig>(DEFAULT_CANVAS_CONFIG);
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>(DEFAULT_SUBTITLE_CONFIG);

  // Reset local state if activeJobId becomes null ? Or just use local state which isolates it.
  const [localError, setLocalError] = useState("");

  const probeQualities = async () => {
    if (!downloadUrl) return;
    setProbing(true);
    try {
      const r = await axios.get(`${API_URL}/probe`, { params: { url: downloadUrl } });
      setAvailHeights(r.data.heights || []);
    } catch {
      setAvailHeights([]);
    } finally {
      setProbing(false);
    }
  };

  const handleDownload = () => {
    setLocalError("");
    if (!downloadTitle || !downloadTitle.trim()) {
      const errMsg = t('toast.title_required', 'Judul Proyek wajib diisi!');
      setLocalError(errMsg);
      ctx.notify?.(t('toast.clip_failed', { num: '', msg: errMsg }), "error");
      return;
    }
    // Send an empty clips array to trigger the full video download fallback.
    const overrides = {
      aspectRatio,
      burnSubtitles,
      captionStyle,
      isGamingVideo,
      canvasConfig,
      subtitleConfig,
      quality,
      title: downloadTitle,
    };
    ctx.handleManualGenerate(downloadUrl, [], true, overrides);
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
          <div className="flex items-center gap-3 mt-2">
            <Button
              variant="outline"
              onClick={probeQualities}
              disabled={!downloadUrl || probing}
            >
              {probing
                ? t("main.probing", "Mengecek...")
                : t("main.probe_btn", "Cek kualitas tersedia")}
            </Button>
            {availHeights.length > 0 && (
              <span className="text-caption text-text-secondary">
                {t("main.probe_avail", "Tersedia:")}{" "}
                {availHeights.map((h) => `${h}p`).join(", ")}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <InputGroup
            label={`${t("main.project_title_label", "Judul Proyek")} *`}
            placeholder={t(
              "main.project_title_placeholder",
              "Misal: Podcast Radit Full",
            )}
            value={downloadTitle}
            onChange={(e) => setDownloadTitle(e.target.value)}
            icon={Folder}
            required
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
                onClick={() => setAspectRatio(ratio)}
                className={`py-3 px-2 rounded-xl border transition-colors flex flex-col items-center gap-2 font-medium ${
                  aspectRatio === ratio
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

          {aspectRatio === "16:9" && canvasConfig && (
            <div className="pt-3">
              <CanvasConfigControls
                config={canvasConfig}
                onChange={setCanvasConfig}
                showModeSwitch={true}
              />
            </div>
          )}
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
              checked={burnSubtitles}
              onChange={setBurnSubtitles}
            />
          </div>

          {burnSubtitles && (
            <div className="pt-4 border-t border-border">
              <div className="grid grid-cols-2 gap-3">
                {(["standard", "karaoke"] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => {
                      setCaptionStyle(style);
                      setSubtitleConfig({ ...subtitleConfig, style });
                    }}
                    className={`py-2 px-3 rounded-lg border font-medium transition-colors ${
                      captionStyle === style
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

          {aspectRatio === "9:16" && SHOW_EXPERIMENTAL_FEATURES && (
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent/10 rounded-lg text-accent">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-body font-medium text-text-primary">
                      {t("main.gaming_video", "Gaming Video (Split-screen Auto-detect)")}
                    </h4>
                    <p className="text-caption text-text-secondary">
                      {t(
                        "main.gaming_video_desc",
                        "Check this if it's a gaming video so the streamer's facecam is automatically detected.",
                      )}
                    </p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={isGamingVideo}
                  onChange={setIsGamingVideo}
                />
              </div>
            </div>
          )}
        </div>

        {localError && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-body">
            ⚠️ {localError}
          </div>
        )}

        {(ctx.errorMsg && ctx.errorMsg !== localError) && (
          <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-body">
            ⚠️ {ctx.errorMsg}
          </div>
        )}

        <div className="pt-2">
          <Select
            label={t("main.video_quality_label", "Kualitas Video (Download)")}
            value={quality}
            onChange={(e) => setQuality(e.target.value as any)}
            options={
              availHeights.length > 0
                ? [
                    { label: t("main.quality_best", "Best (Otomatis)"), value: "best" },
                    ...availHeights.map((h) => {
                      let label = `${h}p`;
                      if (h >= 2160) label = "2160p (4K)";
                      else if (h >= 1440) label = "1440p (2K)";
                      return { label, value: `${h}p` };
                    }),
                  ]
                : [
                    { label: t("main.quality_best", "Best (Otomatis)"), value: "best" },
                    { label: "2160p (4K)", value: "2160p" },
                    { label: "1440p (2K)", value: "1440p" },
                    { label: "1080p", value: "1080p" },
                    { label: "720p", value: "720p" },
                    { label: "480p", value: "480p" },
                  ]
            }
          />
        </div>

        <div className="pt-2">
          <Button
            variant="primary"
            className="w-full h-14 text-lg font-bold shadow-lg shadow-accent/20 hover:shadow-accent/40 transition-shadow"
            icon={Download}
            onClick={handleDownload}
            disabled={ctx.isRunning || !downloadUrl || !downloadTitle.trim()}
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
