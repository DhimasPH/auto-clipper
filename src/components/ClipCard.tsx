import { useTranslation } from "react-i18next";
import { Download, Folder, Sparkles, Pencil, Star } from "lucide-react";
import { Button } from "./ui/Button";
import { platform } from "../platform";
import { fileName } from "../platform/paths";
import { API_URL } from "../platform/backendUrl";
import { useSignedVideo } from "../hooks/useSignedVideo";
import { localErrorInfo } from "../lib/localErrors";
import { videoHref } from "../lib/videoUrl";
import { ErrorCard } from "./ErrorCard";
import { SocialKitModal } from "./SocialKitModal";

export interface SocialData {
  titles_en?: string[];
  titles_id?: string[];
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

export interface Clip {
  path: string;
  /** Signed /video link from the backend (relative), see backend/video_sign.py. */
  video_url?: string;
  description: string;
  description_en?: string;
  description_id?: string;
  start: string;
  end: string;
  subs: boolean;
  v: number;
  social?: SocialData;
  score?: number;
}

interface ClipCardProps {
  clip: Clip;
  index: number;
  jobId: string;
  onEdit?: () => void;
}

import { useState } from "react";

export default function ClipCard({
  clip,
  index,
  jobId,
  onEdit
}: ClipCardProps) {
  const { t, i18n } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [localSocial, setLocalSocial] = useState<SocialData | undefined>(clip.social);
  const video = useSignedVideo(clip.path, clip.video_url);

  const currentDescription = i18n.language === 'id' 
    ? (clip.description_id || clip.description)
    : (clip.description_en || clip.description);

  return (
    <div className="bg-bg-secondary rounded-card border border-border p-4 flex flex-col gap-4 w-72 shadow-sm">
      <div className="aspect-[9/16] bg-scrim rounded-lg overflow-hidden border border-border/50">
        {video.failed ? (
          <ErrorCard
            info={localErrorInfo("VIDEO_LINK_REFUSED")}
            handlers={{ retry: video.retry }}
            className="h-full overflow-y-auto rounded-none border-0"
          />
        ) : (
          <video
            key={`${clip.v}-${video.src}`}
            src={videoHref(video.src, API_URL, { v: clip.v }) || undefined}
            onError={video.onError}
            controls
            playsInline
            preload="metadata"
            className="w-full h-full object-contain bg-black"
          />
        )}
      </div>
        <div className="flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-body font-bold text-text-primary">
            {t('clip.title_ai', { num: index + 1 })}
          </h3>
          {clip.score && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold shrink-0">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              <span>{clip.score}/10</span>
            </div>
          )}
        </div>
        <p className="text-caption text-text-secondary leading-relaxed mb-4 flex-1">
          {currentDescription}
        </p>

        {(currentDescription || localSocial) && (
          <div className="mb-4">
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 py-2 px-3 bg-accent/10 text-accent rounded-button text-caption font-medium hover:bg-accent/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              {t('clip.social_kit', 'Social Kit')}
            </button>
          </div>
        )}

        <div className="flex gap-2 mt-auto">
          {onEdit && (
            <Button
              variant="outline"
              className="!px-3"
              icon={Pencil}
              title={t("clip_rerender.edit_btn_title", "Correct Subtitle & Rerender")}
              onClick={onEdit}
            />
          )}
          <button
            onClick={async (e) => {
              e.preventDefault();
              try {
                await platform().saveClip({
                  path: clip.path,
                  filename: fileName(clip.path),
                  videoUrl: videoHref(video.src, API_URL, { dl: true }) || undefined,
                });
              } catch (err) {
                console.error("Save failed", err);
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-accent text-on-accent rounded-button text-caption font-medium hover:brightness-110 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {t('clip.btn_download', 'Download')}
          </button>
          {platform().caps.openFolder && (
            <Button
              variant="outline"
              className="!px-3"
              icon={Folder}
              title="Buka Folder"
              onClick={async () => {
                try {
                  await platform().openFolder(clip.path);
                } catch (err) {
                  console.error("Open folder failed", err);
                }
              }}
            />
          )}
        </div>
      </div>
      {(currentDescription || localSocial) && (
        <SocialKitModal 
          isOpen={showModal} 
          onClose={() => setShowModal(false)} 
          social={localSocial} 
          clip={clip}
          jobId={jobId}
          clipIndex={index} 
          onUpdate={(newSocial) => setLocalSocial(newSocial)}
        />
      )}
    </div>
  );
}
