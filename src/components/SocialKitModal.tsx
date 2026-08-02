import React, { useState, useContext } from "react";
import { useTranslation } from "react-i18next";
import { X, Copy, Check, Clock, Music, Loader2, Sparkles } from "lucide-react";
import axios from "axios";
import { SocialData, Clip } from "./ClipCard";
import { API_URL, AppContext } from "../App";

export interface SocialKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  social?: SocialData;
  clip: Clip;
  jobId: string;
  clipIndex: number;
  onUpdate: (social: SocialData) => void;
}

const CopyButton: React.FC<{ textToCopy: string; label?: string }> = ({
  textToCopy,
  label,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 hover:bg-bg-tertiary text-text-secondary hover:text-text-primary rounded-button transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          {label && <span className="text-emerald-400">Copied</span>}
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          {label && <span>{label}</span>}
        </>
      )}
    </button>
  );
};

export const SocialKitModal: React.FC<SocialKitModalProps> = ({
  isOpen,
  onClose,
  social,
  clip,
  jobId,
  clipIndex,
  onUpdate,
}) => {
  const { t, i18n } = useTranslation();
  const ctx = useContext(AppContext);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isId = i18n.language === "id";

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const provider = ctx.provider || "openai";
      const api_key = ctx.apiKeys?.[provider] || "";
      const custom_base_url = ctx.apiKeys?.["custom_base_url"] || "";
      const custom_model_name = ctx.apiKeys?.["custom_model_name"] || "";
      const description =
        clip.description_en || clip.description_id || clip.description || "";

      const res = await axios.post(
        `${API_URL}/jobs/${jobId}/clips/${clipIndex}/social`,
        {
          description,
          provider,
          api_key,
          custom_base_url,
          custom_model_name,
        },
      );
      const data = res.data;
      if (data?.status === "success" && data.social) {
        onUpdate(data.social);
      } else {
        throw new Error(data?.message || "Unknown error");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "An error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const titles = isId ? social?.titles_id : social?.titles_en;
  const description =
    i18n.language === "id" ? social?.description_id : social?.description_en;
  const hashtags =
    i18n.language === "id" ? social?.hashtags_id : social?.hashtags_en;
  const bestTime =
    i18n.language === "id"
      ? social?.best_time_to_post_id
      : social?.best_time_to_post_en;
  const backsound =
    i18n.language === "id" ? social?.backsound_id : social?.backsound_en;

  const joinedHashtags = hashtags?.join(" ") || "";

  const hasData =
    titles ||
    description ||
    joinedHashtags ||
    social?.thumbnail_layout ||
    bestTime ||
    backsound;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-bg-secondary w-full max-w-2xl max-h-[80vh] flex flex-col rounded-card shadow-dropdown border border-border overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-border bg-bg-surface shrink-0">
          <h2 className="text-section-title text-text-primary">
            {t("social_kit.title", "Social Kit - Clip {{num}}", {
              num: clipIndex + 1,
            })}
          </h2>
          <div className="flex items-center gap-2">
            {hasData && (
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent hover:bg-accent/20 rounded-button text-caption font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {t("common.retry", "Regenerate")}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex flex-col gap-6">
          {error && (
            <div className="p-4 bg-danger/10 text-danger border border-danger/20 rounded-lg text-body">
              {error}
            </div>
          )}

          {!hasData && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
              <Sparkles className="w-12 h-12 text-accent/50" />
              <p className="text-text-secondary text-body max-w-sm">
                {t(
                  "social_kit.empty",
                  "Social kit belum digenerate untuk klip ini. Klik tombol di bawah untuk membuat judul viral, deskripsi, dan hashtag.",
                )}
              </p>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex items-center gap-2 px-6 py-3 bg-accent text-white hover:bg-accent/90 rounded-button text-body font-medium transition-colors mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
                {isGenerating
                  ? t("common.generating", "Generating...")
                  : t("common.generate", "Generate Social Kit")}
              </button>
            </div>
          )}
          {/* Titles */}
          {titles && titles.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="font-medium text-text-primary text-body">
                {t("clip.social_titles", "Judul Viral (Pilih satu):")}
              </div>
              <div className="flex flex-col gap-2">
                {titles.map((title, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-start gap-4 p-3 bg-bg-surface rounded-lg border border-border"
                  >
                    <span className="text-text-secondary text-body">
                      {title}
                    </span>
                    <CopyButton textToCopy={title} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <hr className="border-border" />

          {/* Description */}
          {description && (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="font-medium text-text-primary text-body">
                  {t("clip.social_desc", "Deskripsi:")}
                </span>
                <CopyButton textToCopy={description} label="Copy" />
              </div>
              <div className="p-3 bg-bg-surface rounded-lg border border-border text-text-secondary text-body whitespace-pre-wrap">
                {description}
              </div>
            </div>
          )}

          {joinedHashtags && (
            <>
              <hr className="border-border" />
              {/* Hashtags */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-text-primary text-body">
                    {t("clip.social_hashtags", "Hashtags:")}
                  </span>
                  <CopyButton textToCopy={joinedHashtags} label="Copy" />
                </div>
                <div className="p-3 bg-bg-surface rounded-lg border border-border text-text-secondary text-body break-words">
                  {joinedHashtags}
                </div>
              </div>
            </>
          )}

          {social?.thumbnail_layout && (
            <>
              <hr className="border-border" />
              {/* Thumbnail Idea */}
              <div className="flex flex-col gap-3">
                <div className="font-medium text-text-primary text-body">
                  {t("clip.social_thumbnail", "Ide Thumbnail:")}
                </div>
                <div className="p-3 bg-bg-surface rounded-lg border border-border text-text-secondary text-body">
                  {social.thumbnail_layout}
                </div>
              </div>
            </>
          )}

          {bestTime && (
            <>
              <hr className="border-border" />
              {/* Best Time to Post */}
              <div className="flex flex-col gap-3">
                <div className="font-medium text-text-primary text-body flex items-center gap-2">
                  <Clock className="w-5 h-5 text-accent" />
                  {t("clip.social_best_time", "Waktu Terbaik Posting:")}
                </div>
                <div className="p-3 bg-bg-surface rounded-lg border border-border text-text-secondary text-body">
                  {bestTime}
                </div>
              </div>
            </>
          )}

          {backsound && (
            <>
              <hr className="border-border" />
              {/* Backsound */}
              <div className="flex flex-col gap-3">
                <div className="font-medium text-text-primary text-body flex items-center gap-2">
                  <Music className="w-5 h-5 text-accent" />
                  {t("clip.social_backsound", "Saran Backsound:")}
                </div>
                <div className="p-3 bg-bg-surface rounded-lg border border-border text-text-secondary text-body">
                  {backsound}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
