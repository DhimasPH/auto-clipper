import type React from "react";
import { useState, useEffect } from "react";
import {
  Link as LinkIcon,
  Sparkles,
  ArrowRight,
  Clipboard,
  XCircle,
  Sliders,
  Check,
  Languages,
  Film,
  Type,
  AlertCircle
} from "lucide-react";
import { OutputStyleSelector, type OutputStyle } from "../OutputStyleSelector";
import { SubtitlePresetBar } from "../SubtitlePresetBar";
import { SUBTITLE_PRESETS, DEFAULT_SUBTITLE_CONFIG, type SubtitlePresetKey, type SubtitleConfig } from "../../types/subtitle";
import { DEFAULT_CANVAS_CONFIG, type CanvasConfig } from "../../types/canvas";
import type { CreateJobPayload } from "../../types/job";

export interface StepInputProps {
  initialUrl?: string;
  isSubmitting?: boolean;
  onSubmit: (payload: CreateJobPayload) => void;
}

const STORAGE_DRAFT_INPUT = "ac_draft_step_input";

const HIGHLIGHT_COLOR_SWATCHES = [
  { name: "Yellow", value: "#FFE600", bg: "bg-[#FFE600]" },
  { name: "Cyan", value: "#38BDF8", bg: "bg-[#38BDF8]" },
  { name: "Green", value: "#4ADE80", bg: "bg-[#4ADE80]" },
  { name: "Pink", value: "#F43F5E", bg: "bg-[#F43F5E]" },
  { name: "White", value: "#FFFFFF", bg: "bg-[#FFFFFF]" },
  { name: "Orange", value: "#FB923C", bg: "bg-[#FB923C]" },
];

const SUPPORTED_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "instagram.com",
  "x.com",
  "twitter.com",
];

export const StepInput: React.FC<StepInputProps> = ({
  initialUrl = "",
  isSubmitting = false,
  onSubmit,
}) => {
  const [url, setUrl] = useState<string>(initialUrl);
  const [title, setTitle] = useState<string>("");
  const [outputStyle, setOutputStyle] = useState<OutputStyle>("face_crop");
  const [subtitlePreset, setSubtitlePreset] = useState<SubtitlePresetKey>("viral_pop");
  const [whisperModel, setWhisperModel] = useState<string>("small");
  const [language, setLanguage] = useState<string>("auto");
  const [maxClips, setMaxClips] = useState<number>(0);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Canvas customization
  const [canvasBgType, setCanvasBgType] = useState<"blur" | "color">("blur");
  const [canvasBlurLevel, setCanvasBlurLevel] = useState<"light" | "medium" | "strong">("medium");
  const [canvasBgColor] = useState<string>("#000000");
  const [canvasScale, setCanvasScale] = useState<number>(1.0);

  // Subtitle customization
  const [highlightColor, setHighlightColor] = useState<string>("#FFE600");
  const [watermarkText, setWatermarkText] = useState<string>("");
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.5);

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
        if (parsed.subtitlePreset) setSubtitlePreset(parsed.subtitlePreset);
        if (parsed.whisperModel) setWhisperModel(parsed.whisperModel);
        if (parsed.language) setLanguage(parsed.language);
        if (parsed.maxClips !== undefined) setMaxClips(parsed.maxClips);
        if (parsed.highlightColor) setHighlightColor(parsed.highlightColor);
        if (parsed.watermarkText) setWatermarkText(parsed.watermarkText);
        if (parsed.watermarkOpacity !== undefined) setWatermarkOpacity(parsed.watermarkOpacity);
      }
    } catch {
      // Ignore
    }
  }, [initialUrl]);

  // Sync default highlight color when preset changes
  useEffect(() => {
    const presetConfig = SUBTITLE_PRESETS[subtitlePreset]?.config;
    if (presetConfig?.highlight_color) {
      setHighlightColor(presetConfig.highlight_color);
    }
  }, [subtitlePreset]);

  // Save drafts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_DRAFT_INPUT,
        JSON.stringify({
          url,
          title,
          outputStyle,
          subtitlePreset,
          whisperModel,
          language,
          maxClips,
          highlightColor,
          watermarkText,
          watermarkOpacity,
        })
      );
    } catch {
      // Ignore
    }
  }, [url, title, outputStyle, subtitlePreset, whisperModel, language, maxClips, highlightColor, watermarkText, watermarkOpacity]);

  const validateUrl = (testUrl: string): boolean => {
    const clean = testUrl.trim();
    if (!clean) {
      setUrlError("Video URL is required");
      return false;
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

    // Build Canvas Config
    let canvasConfig: CanvasConfig = {
      ...DEFAULT_CANVAS_CONFIG,
      enabled: outputStyle === "canvas_blur",
      background_type: canvasBgType,
      blur_level: canvasBlurLevel,
      background_color: canvasBgColor,
      enlarge_scale: canvasScale,
    };

    // Build Subtitle Config
    const presetBase = SUBTITLE_PRESETS[subtitlePreset]?.config || {};
    const subtitleConfig: SubtitleConfig = {
      ...DEFAULT_SUBTITLE_CONFIG,
      ...presetBase,
      highlight_color: highlightColor,
      watermark_text: watermarkText.trim(),
      watermark_opacity: watermarkOpacity,
    };

    // Aspect ratio
    let aspectRatio = "9:16";
    if (outputStyle === "landscape") aspectRatio = "16:9";
    if (outputStyle === "square") aspectRatio = "1:1";

    const payload: CreateJobPayload = {
      url: url.trim(),
      provider: "manual",
      title: title.trim() || `Auto Clip - ${new Date().toLocaleTimeString()}`,
      aspect_ratio: aspectRatio,
      caption_style: subtitlePreset === "podcast" ? "karaoke" : subtitlePreset === "viral_pop" ? "single_word" : "standard",
      burn_subs: true,
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
    <form onSubmit={handleSubmit} className="space-y-7">
      {/* Video URL Input Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label htmlFor="video-url" className="text-sm font-semibold text-neutral-200 flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-amber-400" />
            <span>Video URL</span>
            <span className="text-xs font-normal text-amber-400/80">*Required</span>
          </label>
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span className="hidden sm:inline">Supports:</span>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-neutral-800 px-2 py-0.5 rounded text-neutral-300">
              <Film className="w-3 h-3 text-red-400" /> YouTube, TikTok, Reels, X
            </span>
          </div>
        </div>

        <div className="relative flex items-center">
          <input
            id="video-url"
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (urlError) validateUrl(e.target.value);
            }}
            placeholder="Paste video link (e.g. https://youtu.be/xyz...)"
            required
            className={`w-full pl-4 pr-24 py-3 bg-neutral-950/80 border rounded-xl text-neutral-100 placeholder:text-neutral-600 text-sm focus:outline-none focus:ring-2 transition-all font-mono ${
              urlError
                ? "border-red-500/80 focus:ring-red-500/30"
                : "border-neutral-800 focus:border-amber-400/80 focus:ring-amber-400/30"
            }`}
          />
          <div className="absolute right-2 flex items-center gap-1">
            {url && (
              <button
                type="button"
                onClick={() => setUrl("")}
                className="p-1.5 text-neutral-500 hover:text-neutral-300 rounded-lg hover:bg-neutral-800 transition-colors"
                title="Clear input"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-neutral-100 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 border border-neutral-700/60"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>Paste</span>
            </button>
          </div>
        </div>

        {urlError && (
          <div className="flex items-center gap-2 text-xs text-red-400 mt-1">
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

      {/* Subtitle Preset Selector */}
      <div className="pt-1">
        <SubtitlePresetBar
          value={subtitlePreset}
          onChange={(val) => setSubtitlePreset(val)}
          disabled={isSubmitting}
        />
      </div>

      {/* Advanced Drawer Toggle */}
      <div className="border border-neutral-800/80 rounded-xl bg-neutral-950/40 overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full px-4 py-3 flex items-center justify-between text-xs font-medium text-neutral-300 hover:text-neutral-100 hover:bg-neutral-900/60 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>Advanced Customizations & AI Settings</span>
          </div>
          <span className="text-[11px] text-neutral-500 font-mono">
            {showAdvanced ? "Hide options ▲" : "Show options ▼"}
          </span>
        </button>

        {showAdvanced && (
          <div className="p-4 sm:p-5 border-t border-neutral-800/80 space-y-5 bg-neutral-900/40 animate-fadeIn text-xs">
            {/* Project Title */}
            <div className="space-y-1.5">
              <label htmlFor="project-title" className="font-medium text-neutral-300 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-neutral-400" />
                <span>Project Name / Title (Optional)</span>
              </label>
              <input
                id="project-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Give your clip project a memorable name..."
                className="w-full px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-400/80"
              />
            </div>

            {/* Language, Whisper Model & Max Clips */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="font-medium text-neutral-300 flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Transcription Language</span>
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-amber-400/80"
                >
                  <option value="auto">🌍 Auto Detect (Whisper VAD)</option>
                  <option value="id">🇮🇩 Indonesian (Bahasa)</option>
                  <option value="en">🇺🇸 English</option>
                  <option value="es">🇪🇸 Spanish</option>
                  <option value="ja">🇯🇵 Japanese</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-neutral-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Faster Whisper Model</span>
                </label>
                <select
                  value={whisperModel}
                  onChange={(e) => setWhisperModel(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-amber-400/80"
                >
                  <option value="small">⚡ small (Fastest, High Accuracy)</option>
                  <option value="medium">🎯 medium (Balanced for Podcast)</option>
                  <option value="large-v3">💎 large-v3 (Maximum Accuracy)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-neutral-300 flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Max Clips</span>
                </label>
                <select
                  value={maxClips}
                  onChange={(e) => setMaxClips(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-amber-400/80"
                >
                  <option value={0}>Auto (Based on duration)</option>
                  <option value={1}>1 Clip</option>
                  <option value={3}>3 Clips</option>
                  <option value={5}>5 Clips</option>
                  <option value={10}>10 Clips</option>
                </select>
              </div>
            </div>

            {/* Subtitle Highlight Color & Watermark */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-neutral-800/60">
              <div className="space-y-2">
                <label className="font-medium text-neutral-300 flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Highlight Accent Color</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {HIGHLIGHT_COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch.value}
                      type="button"
                      onClick={() => setHighlightColor(swatch.value)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${swatch.bg} ${
                        highlightColor === swatch.value
                          ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-neutral-900 scale-110"
                          : "opacity-80 hover:opacity-100 hover:scale-105"
                      }`}
                      title={swatch.name}
                    >
                      {highlightColor === swatch.value && (
                        <Check className="w-4 h-4 text-neutral-950 stroke-[3]" />
                      )}
                    </button>
                  ))}
                  <input
                    type="color"
                    value={highlightColor}
                    onChange={(e) => setHighlightColor(e.target.value)}
                    className="w-7 h-7 rounded-full bg-transparent cursor-pointer border border-neutral-700"
                    title="Custom color"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="font-medium text-neutral-300 flex items-center gap-1.5">
                  <span>Watermark Text (Optional)</span>
                </label>
                <input
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  placeholder="@yourhandle or channel name"
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-amber-400/80"
                />

                {watermarkText && (
                  <div className="space-y-3 pt-2 bg-neutral-950/50 p-3 rounded-lg border border-neutral-800/60">
                    <div>
                      <div className="flex justify-between text-xs text-neutral-400 mb-1">
                        <span>Opacity</span>
                        <span>{Math.round(watermarkOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={watermarkOpacity}
                        onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                        className="w-full accent-amber-400"
                      />
                    </div>
                    
                    <div>
                      <span className="text-xs text-neutral-500 block mb-1">Live Preview</span>
                      <div className="relative w-full h-16 bg-neutral-900 rounded-md overflow-hidden flex items-center justify-center border border-neutral-800 shadow-inner">
                        {/* Fake video background element */}
                        <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-blue-600 to-purple-800"></div>
                        <div 
                          className="relative font-bold text-white tracking-wide"
                          style={{ 
                            opacity: watermarkOpacity, 
                            textShadow: "0px 1px 3px rgba(0,0,0,0.8)",
                            fontFamily: "Arial, sans-serif"
                          }}
                        >
                          {watermarkText}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Canvas Blur Controls (if Canvas Blur is active) */}
            {outputStyle === "canvas_blur" && (
              <div className="pt-2 border-t border-neutral-800/60 space-y-3">
                <span className="font-semibold text-neutral-200 block">Canvas Background Options</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-neutral-400 block mb-1">Blur Intensity</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["light", "medium", "strong"] as const).map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setCanvasBlurLevel(lvl)}
                          className={`py-1.5 px-2 rounded-lg border text-center font-medium capitalize transition-colors ${
                            canvasBlurLevel === lvl
                              ? "bg-amber-400/20 border-amber-400/60 text-amber-300"
                              : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:bg-neutral-900"
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-neutral-400 block mb-1">Background Mode</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(["blur", "color"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setCanvasBgType(mode)}
                          className={`py-1.5 px-2 rounded-lg border text-center font-medium capitalize transition-colors ${
                            canvasBgType === mode
                              ? "bg-amber-400/20 border-amber-400/60 text-amber-300"
                              : "bg-neutral-950 border-neutral-800 text-neutral-400 hover:bg-neutral-900"
                          }`}
                        >
                          {mode === "blur" ? "Blurred Video" : "Solid Color"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-neutral-400 block mb-1">Video Zoom Scale ({canvasScale}x)</label>
                    <input
                      type="range"
                      min="1.0"
                      max="2.0"
                      step="0.1"
                      value={canvasScale}
                      onChange={(e) => setCanvasScale(parseFloat(e.target.value))}
                      className="w-full accent-amber-400 mt-2"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isSubmitting || !url.trim()}
          className="w-full py-3.5 px-6 bg-amber-400 hover:bg-amber-300 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-bold text-sm rounded-xl transition-all duration-150 flex items-center justify-center gap-2.5 shadow-xl shadow-amber-400/10"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-neutral-950/30 border-t-neutral-950 rounded-full animate-spin" />
              <span>Submitting to GPU Server...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 fill-neutral-950" />
              <span>Transcribe & Generate AI Prompt</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default StepInput;
