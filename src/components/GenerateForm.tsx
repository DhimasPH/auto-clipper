import { Dispatch, SetStateAction, useState } from "react";
import axios from "axios";
import { API_URL } from "../App";
import { useTranslation } from "react-i18next";
import { Link2, FileVideo, Wand2, Type } from "lucide-react";
import { InputGroup } from "./ui/InputGroup";
import { Select } from "./ui/Select";
import { ToggleSwitch } from "./ui/ToggleSwitch";
import { Button } from "./ui/Button";

type Quality = "best" | "2160p" | "1440p" | "1080p" | "720p" | "480p";

interface GenerateFormProps {
  inputType: "url" | "local";
  setInputType: Dispatch<SetStateAction<"url" | "local">>;
  url: string;
  setUrl: Dispatch<SetStateAction<string>>;
  setLocalFile: Dispatch<SetStateAction<File | null>>;
  aspectRatio: "1:1" | "4:5" | "9:16" | "16:9";
  setAspectRatio: Dispatch<SetStateAction<"1:1" | "4:5" | "9:16" | "16:9">>;
  captionStyle: "standard" | "karaoke";
  setCaptionStyle: Dispatch<SetStateAction<"standard" | "karaoke">>;
  burnSubtitles: boolean;
  setBurnSubtitles: Dispatch<SetStateAction<boolean>>;
  quality: Quality;
  setQuality: Dispatch<SetStateAction<Quality>>;
  errorMsg: string;
  isRunning: boolean;
  handleGenerate: () => void;
}

export default function GenerateForm({
  inputType, setInputType,
  url, setUrl,
  setLocalFile,
  aspectRatio, setAspectRatio,
  captionStyle, setCaptionStyle,
  burnSubtitles, setBurnSubtitles,
  quality, setQuality,
  errorMsg,
  isRunning,
  handleGenerate,
}: GenerateFormProps) {
  const { t } = useTranslation();
  const [availHeights, setAvailHeights] = useState<number[]>([]);
  const [probing, setProbing] = useState(false);

  const probeQualities = async () => {
    if (!url) return;
    setProbing(true);
    try {
      const r = await axios.get(`${API_URL}/probe`, { params: { url } });
      setAvailHeights(r.data.heights || []);
    } catch {
      setAvailHeights([]);
    } finally {
      setProbing(false);
    }
  };

  return (
    <main className="bg-bg-secondary rounded-card border border-border p-6 shadow-sm flex flex-col gap-6">

      {/* Input Type */}
      <div className="flex gap-4 p-1 bg-input-bg rounded-xl">
        <button
          onClick={() => setInputType("url")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
            inputType === "url" ? "bg-accent text-on-accent shadow-sm" : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
          }`}
        >
          <Link2 className="w-5 h-5" />
          URL Video (YouTube)
        </button>
        <button
          onClick={() => setInputType("local")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
            inputType === "local" ? "bg-accent text-on-accent shadow-sm" : "text-text-secondary hover:text-text-primary hover:bg-bg-surface"
          }`}
        >
          <FileVideo className="w-5 h-5" />
          Video Lokal (.mp4)
        </button>
      </div>

      {/* Input Field */}
      <div>
        {inputType === "url" ? (
          <div className="space-y-2">
            <InputGroup
              label={t('main.url_label', 'Video URL')}
              placeholder={t('main.url_placeholder', 'https://youtube.com/watch?...')}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              icon={Link2}
            />
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={probeQualities} disabled={!url || probing}>
                {probing ? "Mengecek..." : "Cek kualitas tersedia"}
              </Button>
              {availHeights.length > 0 && (
                <span className="text-caption text-text-secondary">
                  Tersedia: {availHeights.map((h) => `${h}p`).join(", ")}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-label text-text-secondary">{t('main.local_file_label', 'Select Local Video File')}</label>
            <input
              type="file"
              accept="video/mp4,video/x-m4v,video/*"
              onChange={(e) => setLocalFile(e.target.files?.[0] || null)}
              className="w-full p-3 rounded-xl border border-border bg-input-bg text-text-primary focus:outline-none focus:border-accent"
            />
          </div>
        )}
      </div>

      {/* Aspect Ratio */}
      <div className="space-y-2">
        <label className="text-label text-text-secondary">{t('main.aspect_ratio_label', 'Video Aspect Ratio')}</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["9:16", "16:9", "4:5", "1:1"] as const).map((ratio) => (
            <button
              key={ratio}
              onClick={() => setAspectRatio(ratio)}
              className={`py-3 px-2 rounded-xl border transition-colors flex flex-col items-center gap-2 font-medium ${
                aspectRatio === ratio
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border bg-bg-surface text-text-secondary hover:border-border-active hover:text-text-primary'
              }`}
            >
              <div className={`border-2 rounded-sm ${aspectRatio === ratio ? 'border-accent' : 'border-text-secondary'}`}
                style={{
                  width: ratio === "16:9" ? "24px" : ratio === "9:16" ? "14px" : ratio === "4:5" ? "18px" : "20px",
                  height: ratio === "16:9" ? "14px" : ratio === "9:16" ? "24px" : ratio === "4:5" ? "22px" : "20px"
                }}
              />
              <span className="text-sm">
                {ratio === "9:16" ? "9:16 (Vertical)" : ratio === "4:5" ? "4:5 (Portrait)" : ratio === "16:9" ? "16:9 (Landscape)" : "1:1 (Square)"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Subtitle + Quality */}
      <div className="space-y-6 animate-slide-up">
        <div className="p-4 bg-bg-surface rounded-xl border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 rounded-lg text-accent">
                <Type className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-body font-medium text-text-primary">{t('main.burn_subtitles', 'Burn Subtitles')}</h4>
                <p className="text-caption text-text-secondary">{t('main.burn_subtitles_desc', 'Embed captions directly into the video')}</p>
              </div>
            </div>
            <ToggleSwitch checked={burnSubtitles} onChange={setBurnSubtitles} />
          </div>

          {burnSubtitles && (
            <div className="pt-4 border-t border-border">
              <label className="text-label text-text-secondary block mb-2">{t('main.subtitle_style_label', 'Subtitle Style')}</label>
              <div className="grid grid-cols-2 gap-3">
                {(["standard", "karaoke"] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => setCaptionStyle(style)}
                    className={`py-2 px-3 rounded-lg border font-medium transition-colors ${
                      captionStyle === style
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-bg-surface text-text-secondary hover:border-border-active'
                    }`}
                  >
                    {style === "standard" ? "Standard (Baris)" : "Karaoke (Word-by-word)"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {inputType === "url" && (
          <Select
            label="Kualitas Video (Download)"
            value={quality}
            onChange={(e) => setQuality(e.target.value as any)}
            options={[
              { label: 'Best (Otomatis)', value: 'best' },
              { label: '2160p (4K)', value: '2160p' },
              { label: '1440p (2K)', value: '1440p' },
              { label: '1080p', value: '1080p' },
              { label: '720p', value: '720p' },
              { label: '480p', value: '480p' }
            ]}
          />
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-body">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Action */}
      <div className="pt-2">
        <Button
          variant="primary"
          className="w-full h-14 text-lg font-bold shadow-lg shadow-accent/20 hover:shadow-accent/40 transition-shadow"
          icon={Wand2}
          onClick={handleGenerate}
          disabled={isRunning}
        >
          {isRunning ? "Memproses..." : t('main.btn_generate', 'Generate AI Clips')}
        </Button>
      </div>

    </main>
  );
}
