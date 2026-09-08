import React, { useState } from "react";
import { X, Copy, Check, Sparkles, Clock, Music, Image as ImageIcon } from "lucide-react";

export interface SocialData {
  title?: string;
  titles_en?: string[];
  titles_id?: string[];
  description?: string;
  description_en?: string;
  description_id?: string;
  hashtags_en?: string[];
  hashtags_id?: string[];
  thumbnail_layout?: string;
  best_time_to_post_en?: string;
  best_time_to_post_id?: string;
  backsound_en?: string;
  backsound_id?: string;
}

export interface SocialKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  clipTitle: string;
  social?: SocialData;
}

const CopyItem: React.FC<{ text: string; label?: string }> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="px-2.5 py-1 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors flex items-center gap-1 shrink-0"
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-emerald-700 font-semibold">{label ? `${label} Copied` : "Copied"}</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>{label || "Copy"}</span>
        </>
      )}
    </button>
  );
};

export const SocialKitModal: React.FC<SocialKitModalProps> = ({
  isOpen,
  onClose,
  clipTitle,
  social,
}) => {
  const [activeTab, setActiveTab] = useState<"ID" | "EN">("ID");

  if (!isOpen || !social) return null;

  const titles = activeTab === "ID" ? social.titles_id : social.titles_en;
  const description = activeTab === "ID" ? social.description_id : social.description_en;
  const hashtags = activeTab === "ID" ? social.hashtags_id : social.hashtags_en;
  const bestTime = activeTab === "ID" ? social.best_time_to_post_id : social.best_time_to_post_en;
  const backsound = activeTab === "ID" ? social.backsound_id : social.backsound_en;
  const thumbnail = social.thumbnail_layout;

  const joinedHashtags = (hashtags || []).join(" ");

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white border border-border w-full max-w-xl rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col my-auto max-h-[90vh] overflow-hidden animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl border border-purple-100">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-text-primary">Social Kit</h3>
              <p className="text-xs text-text-secondary truncate max-w-[200px] sm:max-w-xs">{clipTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-tertiary hover:text-text-primary rounded-xl hover:bg-bg-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Language Tabs */}
        <div className="px-4 sm:px-5 pt-3 pb-2 bg-bg-surface/40 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              onClick={() => setActiveTab("ID")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "ID"
                  ? "bg-white text-purple-700 shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              🇮🇩 Indonesian (ID)
            </button>
            <button
              onClick={() => setActiveTab("EN")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === "EN"
                  ? "bg-white text-purple-700 shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              🇺🇸 English (EN)
            </button>
          </div>

          <span className="text-[11px] text-text-tertiary hidden sm:inline">1-Click Copy Ready</span>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar text-xs">
          {/* Titles */}
          {titles && titles.length > 0 && (
            <div className="p-3.5 bg-bg-surface/50 border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text-primary">Hook Titles:</span>
                <CopyItem text={titles.join("\n")} label="All Titles" />
              </div>
              <ul className="space-y-1.5">
                {titles.map((t, idx) => (
                  <li
                    key={idx}
                    className="p-2 bg-white rounded-lg border border-border flex items-center justify-between gap-2"
                  >
                    <span className="text-text-primary font-medium text-[11px] sm:text-xs leading-tight">{t}</span>
                    <CopyItem text={t} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Description / Caption */}
          {description && (
            <div className="p-3.5 bg-bg-surface/50 border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text-primary">Caption:</span>
                <CopyItem text={description} />
              </div>
              <p className="p-2.5 bg-white rounded-lg border border-border text-text-secondary whitespace-pre-wrap leading-relaxed">
                {description}
              </p>
            </div>
          )}

          {/* Hashtags */}
          {joinedHashtags && (
            <div className="p-3.5 bg-bg-surface/50 border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text-primary">Hashtags:</span>
                <CopyItem text={joinedHashtags} />
              </div>
              <p className="p-2.5 bg-white rounded-lg border border-border text-purple-700 font-medium leading-relaxed font-mono">
                {joinedHashtags}
              </p>
            </div>
          )}

          {/* Best Time & Backsound */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {bestTime && (
              <div className="p-3 bg-bg-surface/50 border border-border rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text-primary flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-purple-600" /> Best Time:
                  </span>
                  <CopyItem text={bestTime} />
                </div>
                <p className="text-text-secondary text-[11px] leading-snug">{bestTime}</p>
              </div>
            )}

            {backsound && (
              <div className="p-3 bg-bg-surface/50 border border-border rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-text-primary flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5 text-purple-600" /> Audio:
                  </span>
                  <CopyItem text={backsound} />
                </div>
                <p className="text-text-secondary text-[11px] leading-snug">{backsound}</p>
              </div>
            )}
          </div>

          {/* Thumbnail Layout Idea */}
          {thumbnail && (
            <div className="p-3.5 bg-bg-surface/50 border border-border rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text-primary flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-purple-600" /> Thumbnail Idea:
                </span>
                <CopyItem text={thumbnail} />
              </div>
              <p className="p-2.5 bg-white rounded-lg border border-border text-text-secondary leading-relaxed">
                {thumbnail}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-border bg-slate-50/70 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary bg-white hover:bg-slate-100 border border-border rounded-xl transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
