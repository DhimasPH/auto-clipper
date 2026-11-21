import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Share2 } from "lucide-react";
import { Button } from "./ui/Button";
import { OverflowMenu, type OverflowItem } from "./ui/OverflowMenu";
import { platform } from "../platform";
import { fileName } from "../platform/paths";
import { API_URL } from "../platform/backendUrl";
import { useSignedVideo } from "../hooks/useSignedVideo";
import { clipSeconds, clipTitle, formatClock } from "../lib/clipInfo";
import { toLang } from "../lib/errorInfo";
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

export default function ClipCard({ clip, index, jobId, onEdit }: ClipCardProps) {
  const { t, i18n } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [localSocial, setLocalSocial] = useState<SocialData | undefined>(clip.social);
  const video = useSignedVideo(clip.path, clip.video_url);
  const caps = platform().caps;
  const lang = toLang(i18n.language);
  const title = clipTitle({ ...clip, social: localSocial }, lang) ?? t("result.clip_n", { n: index + 1 });
  const seconds = clipSeconds(clip);
  const description = lang === "en" ? clip.description_en || clip.description : clip.description_id || clip.description;

  const save = async () => {
    setSaveFailed(false);
    try {
      await platform().saveClip({
        path: clip.path,
        filename: fileName(clip.path),
        videoUrl: videoHref(video.src, API_URL, { dl: true }) || undefined,
      });
    } catch (err) {
      console.error("Save failed", err);
      setSaveFailed(true);
    }
  };

  const items: OverflowItem[] = [
    ...(onEdit ? [{ id: "edit", label: t("result.edit"), onSelect: onEdit }] : []),
    ...(caps.openFolder
      ? [
          {
            id: "folder",
            label: t("result.open_folder"),
            onSelect: () => void platform().openFolder(clip.path).catch((err) => console.error("Open folder failed", err)),
          },
        ]
      : []),
  ];

  return (
    <article className="flex flex-col gap-3 rounded-card border border-border bg-bg-secondary p-3">
      <div className="mx-auto aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-input bg-black">
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
            className="h-full w-full object-contain"
          />
        )}
      </div>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-card-title text-text-primary break-words">{title}</h3>
          <p className="text-caption text-text-secondary">
            {t("result.clip_n", { n: index + 1 })}
            {seconds !== null && ` · ${formatClock(seconds)}`}
          </p>
        </div>
        <OverflowMenu label={t("result.more", { n: index + 1 })} items={items} />
      </div>
      {/* Ruling P16: wrap cleanly instead of clipping button labels on narrow viewports, with matching outline controls. */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" icon={Download} onClick={() => void save()}>
          {t("result.download")}
        </Button>
        {(description || localSocial) && (
          <Button variant="outline" icon={Share2} onClick={() => setShowModal(true)}>
            {t("result.share")}
          </Button>
        )}
      </div>
      {saveFailed && (
        <p role="alert" className="text-body text-error">
          {t("result.download_failed")}
        </p>
      )}
      {(description || localSocial) && (
        <SocialKitModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          social={localSocial}
          clip={clip}
          jobId={jobId}
          clipIndex={index}
          onUpdate={(next) => setLocalSocial(next)}
        />
      )}
    </article>
  );
}
