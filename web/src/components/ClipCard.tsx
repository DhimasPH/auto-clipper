import React from "react";
import { Download, Sparkles, Pencil } from "lucide-react";
import { getVideoStreamUrl, getDownloadUrl } from "../api";

export interface ClipCardProps {
  clip: {
    path: string;
    description?: string;
    description_en?: string;
    description_id?: string;
    start?: string | number;
    end?: string | number;
    subs?: boolean;
    social?: any;
    v?: number;
  };
  index: number;
  jobId: string;
  onEditSubtitle?: () => void;
  onOpenSocialKit?: () => void;
}

export const ClipCard: React.FC<ClipCardProps> = ({
  clip,
  index,
  onEditSubtitle,
  onOpenSocialKit,
}) => {
  const title = clip.social?.title || `Clip #${index + 1}`;
  const description =
    clip.description_id || clip.description_en || clip.description || "";

  const hasSocial = Boolean(
    clip.social &&
      (clip.social.titles_id?.length ||
        clip.social.titles_en?.length ||
        clip.social.description_id ||
        clip.social.description_en ||
        clip.social.hashtags_id?.length)
  );

  return (
    <div className="w-[260px] sm:w-72 shrink-0 snap-start bg-white border border-border rounded-2xl p-3 sm:p-4 flex flex-col gap-3 shadow-sm hover:shadow-md hover:border-purple-200 transition-all">
      {/* Video Preview */}
      <div className="aspect-[9/16] bg-slate-900 rounded-xl overflow-hidden border border-border/50 relative">
        <video
          key={clip.v || clip.path}
          src={getVideoStreamUrl(clip.path, clip.v)}
          controls
          playsInline
          preload="metadata"
          className="w-full h-full object-contain bg-black"
        />
      </div>

      {/* Info & Description */}
      <div className="flex flex-col flex-1 min-h-0">
        <h4 className="font-bold text-text-primary text-sm truncate mb-1" title={title}>
          {title}
        </h4>
        <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mb-3">
          {description || "No description provided."}
        </p>

        {/* Social Kit Button */}
        {hasSocial && onOpenSocialKit && (
          <div className="mb-3">
            <button
              onClick={onOpenSocialKit}
              className="w-full py-1.5 px-3 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Social Kit</span>
            </button>
          </div>
        )}

        {/* Actions Row */}
        <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border">
          {onEditSubtitle && (
            <button
              onClick={onEditSubtitle}
              className="flex-1 py-2 px-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              title="Correct Subtitle & Rerender"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="truncate">Koreksi Subtitle</span>
            </button>
          )}

          <a
            href={getDownloadUrl(clip.path, clip.v)}
            download
            className="p-2 bg-slate-100 hover:bg-slate-200 text-text-secondary hover:text-text-primary border border-border rounded-xl text-xs font-medium flex items-center justify-center transition-colors shrink-0"
            title="Download Video Clip"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
};
