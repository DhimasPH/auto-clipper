import type React from "react";
import { useState, useEffect } from "react";
import {
  Link as LinkIcon,
  Sparkles,
  ArrowRight,
  Clipboard,
  XCircle,
  Sliders,
  Languages,
  Film,
  AlertCircle,
  HardDrive
} from "lucide-react";
import { OutputStyleSelector, type OutputStyle } from "../OutputStyleSelector";
import { ToggleSwitch } from "../ToggleSwitch";
import { DEFAULT_SUBTITLE_CONFIG, type SubtitleConfig } from "../../types/subtitle";
import { DEFAULT_CANVAS_CONFIG, type CanvasConfig } from "../../types/canvas";
import type { CreateJobPayload } from "../../types/job";
import { GDriveBrowserModal } from "../GDriveBrowserModal";
import { CanvasConfigControls } from "../ui/CanvasConfigControls";
import { SubtitleConfigControls } from "../ui/SubtitleConfigControls";

export interface HeroInputProps {
  initialUrl?: string;
  isSubmitting?: boolean;
  onSubmit: (payload: CreateJobPayload) => void;
}

const STORAGE_DRAFT_INPUT = "ac_draft_hero_input";

const SUPPORTED_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "instagram.com",
  "x.com",
  "twitter.com",
];

export const HeroInput: React.FC<HeroInputProps> = ({
  initialUrl = "",
  isSubmitting = false,
  onSubmit,
}) => {
  const [url, setUrl] = useState<string>(initialUrl);
  const [title, setTitle] = useState<string>("");
  const [outputStyle, setOutputStyle] = useState<OutputStyle>("face_crop");
  
  const [whisperModel, setWhisperModel] = useState<string>("small");
  const [language, setLanguage] = useState<string>("auto");
  const [maxClips, setMaxClips] = useState<number>(0);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [isBrowserOpen, setIsBrowserOpen] = useState<boolean>(false);
  const [burnSubtitles, setBurnSubtitles] = useState<boolean>(true);

  // New Structured Configs
  const [canvasConfig, setCanvasConfig] = useState<CanvasConfig>(DEFAULT_CANVAS_CONFIG);
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>({
    ...DEFAULT_SUBTITLE_CONFIG,
    style: "viral_pop" as any, // Set default
  });

  const [urlError, setUrlError] = useState<string | null>(null);

  // Load drafts from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DRAFT_INPUT);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.url && !initialUrl) setUrl(parsed.url);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.outputStyle) setOutputStyle(parsed.outputStyle);
        if (parsed.whisperModel) setWhisperModel(parsed.whisperModel);
        if (parsed.language) setLanguage(parsed.language);
        if (parsed.maxClips !== undefined) setMaxClips(parsed.maxClips);
        if (parsed.burnSubtitles !== undefined) setBurnSubtitles(parsed.burnSubtitles);
        if (parsed.canvasConfig) setCanvasConfig(parsed.canvasConfig);
        if (parsed.subtitleConfig) setSubtitleConfig(parsed.subtitleConfig);
      }
    } catch {
      // Ignore
    }
  }, [initialUrl]);

  // Sync canvas config enabled state with output style
  useEffect(() => {
    if (outputStyle === "canvas_blur") {
      setCanvasConfig(prev => ({ ...prev, enabled: true }));
    } else {
      setCanvasConfig(prev => ({ ...prev, enabled: false }));
    }
  }, [outputStyle]);

  // Save drafts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_DRAFT_INPUT,
        JSON.stringify({
          url,
          title,
          outputStyle,
          whisperModel,
          language,
          maxClips,
          burnSubtitles,
          canvasConfig,
          subtitleConfig,
        })
      );
    } catch {
      // Ignore
    }
  }, [url, title, outputStyle, whisperModel, language, maxClips, burnSubtitles, canvasConfig, subtitleConfig]);

  const validateUrl = (testUrl: string): boolean => {
    const clean = testUrl.trim();
    if (!clean) {
      setUrlError("Video URL is required");
      return false;
    }
    if (clean.startsWith("local:")) {
      setUrlError(null);
      return true;
    }
    const isSupported = SUPPORTED_DOMAINS.some((domain) =>
      clean.toLowerCase().includes(domain)
    );
    if (!isSupported && !clean.startsWith("http://") && !clean.startsWith("https://")) {
      setUrlError("Please enter a valid YouTube, TikTok, Instagram, or X/Twitter URL");
      return false;
    }
    setUrlError(null);
    return true;
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        validateUrl(text.trim());
      }
    } catch (err) {
      console.warn("Could not access clipboard", err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUrl(url)) return;

    // Aspect ratio
    let aspectRatio = "9:16";
    if (outputStyle === "landscape" || (!canvasConfig.enabled && outputStyle === "canvas_blur")) aspectRatio = "16:9";
    if (outputStyle === "square") aspectRatio = "1:1";

    const payload: CreateJobPayload = {
      url: url.trim(),
      provider: "manual",
      title: title.trim() || `Auto Clip - ${new Date().toLocaleTimeString()}`,
      aspect_ratio: aspectRatio,
      caption_style: subtitleConfig.style,
      burn_subs: burnSubtitles,
      quality: "best",
      whisper_model: whisperModel,
      language: language === "auto" ? "" : language,
      max_clips: maxClips,
      canvas_config: canvasConfig,
      subtitle_config: subtitleConfig,
    };

    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full bg-white border border-border rounded-3xl p-5 sm:p-8 shadow-xl shadow-slate-200/50 space-y-6">
      {/* Video URL Input Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label htmlFor="video-url" className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-purple-600" />
            <span>Source Video</span>
            <span className="text-xs font-normal text-purple-600">*Required</span>
          </label>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="hidden sm:inline">Supports:</span>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-bg-surface px-2 py-0.5 rounded text-text-secondary border border-border">
              <Film className="w-3 h-3 text-red-500" /> YouTube, TikTok, Reels, X
            </span>
          </div>
        </div>

        <div className="relative flex items-center">
          <input
            id="video-url"
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (urlError) validateUrl(e.target.value);
            }}
            placeholder="Paste URL or Browse Google Drive..."
            required
            className={`w-full pl-4 pr-32 py-3 bg-bg-surface/50 border rounded-xl text-text-primary placeholder:text-text-tertiary text-sm focus:outline-none focus:bg-white focus:ring-2 transition-all font-mono ${
              urlError
                ? "border-red-500/80 focus:ring-red-500/30"
                : "border-border focus:border-purple-500 focus:ring-purple-500/20"
            }`}
          />
          <div className="absolute right-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsBrowserOpen(true)}
              className="px-2.5 py-1.5 bg-bg-surface hover:bg-slate-200 text-text-secondary hover:text-text-primary text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 border border-border"
              title="Browse Google Drive"
            >
              <HardDrive className="w-3.5 h-3.5 text-purple-600" />
              <span className="hidden sm:inline">Drive</span>
            </button>
            {url && (
              <button
                type="button"
                onClick={() => setUrl("")}
                className="p-1.5 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-bg-surface transition-colors"
                title="Clear input"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="px-2.5 py-1.5 bg-bg-surface hover:bg-slate-200 text-text-secondary hover:text-text-primary text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 border border-border"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Paste</span>
            </button>
          </div>
        </div>

        <GDriveBrowserModal
          isOpen={isBrowserOpen}
          onClose={() => setIsBrowserOpen(false)}
          onSelectFile={(filePath) => {
            const newUrl = `local:${filePath}`;
            setUrl(newUrl);
            validateUrl(newUrl);
            setIsBrowserOpen(false);
          }}
        />

        {urlError && (
          <div className="flex items-center gap-2 text-xs text-red-500 mt-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{urlError}</span>
          </div>
        )}
      </div>

      {/* Output Style Selector */}
      <div className="pt-1">
        <OutputStyleSelector
          value={outputStyle}
          onChange={(val) => setOutputStyle(val)}
          disabled={isSubmitting}
        />
      </div>

      {/* Canvas Config Controls */}
      {outputStyle === "canvas_blur" && (
        <div className="pt-3 border-t border-border">
          <CanvasConfigControls 
            config={canvasConfig} 
            onChange={setCanvasConfig} 
            showModeSwitch={true}
          />
        </div>
      )}

      {/* Burn Subtitles Toggle */}
      <div className="pt-3 pb-1 flex items-center justify-between border-t border-border mt-3">
        <label className="text-sm font-semibold text-text-primary">Burn Subtitles</label>
        <ToggleSwitch
          checked={burnSubtitles}
          onChange={setBurnSubtitles}
          disabled={isSubmitting}
        />
      </div>

      {/* Subtitle Config Controls */}
      {burnSubtitles && (
        <div className="pt-1">
          <SubtitleConfigControls
            config={subtitleConfig}
            onChange={setSubtitleConfig}
          />
        </div>
      )}

      {/* Advanced Drawer Toggle */}
      <div className="border border-border rounded-2xl bg-bg-surface/40 overflow-hidden transition-all mt-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-surface/70 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-purple-600" />
            <span>Advanced Transcription Settings</span>
          </div>
          <span className="text-[11px] text-text-tertiary font-mono">
            {showAdvanced ? "Hide options ▲" : "Show options ▼"}
          </span>
        </button>

        {showAdvanced && (
          <div className="p-4 sm:p-5 border-t border-border space-y-5 bg-white animate-fadeIn text-xs">
            {/* Project Title */}
            <div className="space-y-1.5">
              <label htmlFor="project-title" className="font-medium text-text-secondary flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-text-tertiary" />
                <span>Project Name / Title (Optional)</span>
              </label>
              <input
                id="project-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your clip project a memorable name..."
                className="w-full px-3.5 py-2 bg-bg-surface/50 border border-border rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            {/* Language, Whisper Model & Max Clips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="font-medium text-text-secondary flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-text-tertiary" />
                  <span>Transcription Language</span>
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-surface/50 border border-border rounded-lg text-text-primary focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="auto">🌍 Auto Detect (Whisper VAD)</option>
                  <option value="id">🇮🇩 Indonesian (Bahasa)</option>
                  <option value="en">🇺🇸 English</option>
                  <option value="es">🇪🇸 Spanish</option>
                  <option value="ja">🇯🇵 Japanese</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-text-secondary flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Faster Whisper Model</span>
                </label>
                <select
                  value={whisperModel}
                  onChange={(e) => setWhisperModel(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-surface/50 border border-border rounded-lg text-text-primary focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="small">⚡ small (Fastest, High Accuracy)</option>
                  <option value="medium">🎯 medium (Balanced for Podcast)</option>
                  <option value="large-v3">💎 large-v3 (Maximum Accuracy)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-text-secondary flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-text-tertiary" />
                  <span>Max Clips</span>
                </label>
                <select
                  value={maxClips}
                  onChange={(e) => setMaxClips(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-bg-surface/50 border border-border rounded-lg text-text-primary focus:outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value={0}>Auto (Based on duration)</option>
                  <option value={1}>1 Clip</option>
                  <option value={3}>3 Clips</option>
                  <option value={5}>5 Clips</option>
                  <option value={10}>10 Clips</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isSubmitting || !url.trim()}
          className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-2xl transition-all duration-200 flex items-center justify-center gap-2.5 shadow-lg shadow-purple-500/25"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Submitting to GPU Server...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Transcribe & Generate AI Prompt</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default HeroInput;
