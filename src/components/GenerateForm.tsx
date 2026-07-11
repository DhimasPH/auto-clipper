import { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { Link2, FileVideo, Wand2, Scissors, StopCircle, Type } from "lucide-react";
import { SegmentedControl } from "./ui/SegmentedControl";
import { InputGroup } from "./ui/InputGroup";
import { Select } from "./ui/Select";
import { ToggleSwitch } from "./ui/ToggleSwitch";
import { Button } from "./ui/Button";

interface GenerateFormProps {
  mode: "ai" | "manual";
  setMode: Dispatch<SetStateAction<"ai" | "manual">>;
  inputType: "url" | "local";
  setInputType: Dispatch<SetStateAction<"url" | "local">>;
  url: string;
  setUrl: Dispatch<SetStateAction<string>>;
  setLocalFile: Dispatch<SetStateAction<File | null>>;
  aspectRatio: "1:1" | "4:5" | "9:16" | "16:9";
  setAspectRatio: Dispatch<SetStateAction<"1:1" | "4:5" | "9:16" | "16:9">>;
  captionStyle: "standard" | "karaoke";
  setCaptionStyle: Dispatch<SetStateAction<"standard" | "karaoke">>;
  provider: "openai" | "gemini";
  burnSubtitles: boolean;
  setBurnSubtitles: Dispatch<SetStateAction<boolean>>;
  manualStart: string;
  setManualStart: Dispatch<SetStateAction<string>>;
  manualEnd: string;
  setManualEnd: Dispatch<SetStateAction<string>>;
  quality: "best" | "1080p" | "720p";
  setQuality: Dispatch<SetStateAction<"best" | "1080p" | "720p">>;
  errorMsg: string;
  isRunning: boolean;
  status: string;
  progressPct: number;
  progress: string;
  handleGenerate: () => void;
  cancelJob: () => void;
}

export default function GenerateForm({
  mode, setMode,
  inputType, setInputType,
  url, setUrl,
  setLocalFile,
  aspectRatio, setAspectRatio,
  captionStyle, setCaptionStyle,
  provider,
  burnSubtitles, setBurnSubtitles,
  manualStart, setManualStart,
  manualEnd, setManualEnd,
  quality, setQuality,
  errorMsg,
  isRunning,
  progressPct,
  progress,
  handleGenerate,
  cancelJob,
}: GenerateFormProps) {
  const { t } = useTranslation();

  return (
    <main className="bg-bg-secondary rounded-card border border-border p-6 shadow-sm flex flex-col gap-6">
      
      {/* Mode Selector */}
      <SegmentedControl
        options={[
          { label: t('main.ai_mode', 'AI Mode'), value: 'ai' },
          { label: t('main.manual_mode', 'Manual Mode'), value: 'manual' }
        ]}
        value={mode}
        onChange={(val) => setMode(val as any)}
        className="w-full"
      />

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
          <InputGroup
            label={t('main.url_label', 'Video URL')}
            placeholder={t('main.url_placeholder', 'https://youtube.com/watch?...')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            icon={Link2}
          />
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

      {mode === "ai" ? (
        <div className="space-y-6 animate-slide-up">
          {/* Subtitle Settings */}
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
                  {(["standard", "karaoke"] as const).map((style) => {
                    const disabled = provider === "gemini" && style === "karaoke";
                    return (
                      <button
                        key={style}
                        disabled={disabled}
                        onClick={() => setCaptionStyle(style)}
                        className={`py-2 px-3 rounded-lg border font-medium transition-colors ${
                          disabled ? 'opacity-50 cursor-not-allowed border-border bg-input-bg text-text-secondary' :
                          captionStyle === style
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border bg-bg-surface text-text-secondary hover:border-border-active'
                        }`}
                      >
                        {style === "standard" ? "Standard (Baris)" : "Karaoke (Word-by-word)"}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-slide-up bg-bg-surface p-4 rounded-xl border border-border">
          <InputGroup
            label={t('main.manual_range_label', 'Start Time')}
            placeholder="00:00:00"
            value={manualStart}
            onChange={(e) => setManualStart(e.target.value)}
          />
          <InputGroup
            label={t('main.manual_end', 'End Time')}
            placeholder="00:00:15"
            value={manualEnd}
            onChange={(e) => setManualEnd(e.target.value)}
          />
          <Select
            label="Kualitas Video"
            value={quality}
            onChange={(e) => setQuality(e.target.value as any)}
            options={[
              { label: 'Best (Otomatis)', value: 'best' },
              { label: '1080p (Maksimal)', value: '1080p' },
              { label: '720p (Lebih cepat)', value: '720p' }
            ]}
          />
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-body">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Action Area */}
      <div className="pt-2">
        {isRunning ? (
          <div className="space-y-4">
            <Button 
              variant="danger" 
              className="w-full h-14 text-lg font-bold animate-pulse-glow-red"
              icon={StopCircle}
              onClick={cancelJob}
            >
              Batalkan Proses
            </Button>
            
            <div className="space-y-2">
              <div className="flex justify-between text-caption text-text-secondary font-medium">
                <span>{progress || 'Processing...'}</span>
                <span>{progressPct}%</span>
              </div>
              <div className="w-full h-2 bg-surface-raised rounded-full overflow-hidden">
                <div 
                  className="h-full bg-accent transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <Button 
            variant="primary" 
            className="w-full h-14 text-lg font-bold shadow-lg shadow-accent/20 hover:shadow-accent/40 transition-shadow"
            icon={mode === "ai" ? Wand2 : Scissors}
            onClick={handleGenerate}
          >
            {mode === "ai" ? t('main.btn_generate', 'Generate AI Clips') : t('main.btn_manual_clip', 'Create Manual Clip')}
          </Button>
        )}
      </div>

    </main>
  );
}
