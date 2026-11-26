import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Plus } from "lucide-react";
import ClipCard, { type Clip } from "./ClipCard";
import { Button } from "./ui/Button";
import { JobWarnings } from "./JobWarnings";
import { TimingDetails } from "./TimingDetails";
import { platform } from "../platform";
import { fileName } from "../platform/paths";
import { API_URL } from "../platform/backendUrl";
import { videoHref } from "../lib/videoUrl";

interface ClipsResultProps {
  clips: Clip[];
  status: string;
  failedCount: number;
  jobId: string;
  /** Job metadata: warnings and timings. */
  metadata?: Record<string, unknown> | null;
  onEditClip?: (index: number) => void;
  onNew?: () => void;
}

/** The clips of one project (spec 4.5): one column on a phone, a grid on large screens. */
export default function ClipsResult({ clips, status, failedCount, jobId, metadata, onEditClip, onNew }: ClipsResultProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const [saving, setSaving] = useState(false);
  const [saveAllFailed, setSaveAllFailed] = useState(false);
  if (clips.length === 0) return null;
  const done = status === "DONE";

  const saveAll = async () => {
    setSaving(true);
    setSaveAllFailed(false);
    try {
      await platform().saveClips(
        clips.map((clip) => ({
          path: clip.path,
          filename: fileName(clip.path),
          videoUrl: videoHref(clip.video_url || "", API_URL, { dl: true }) || undefined,
        })),
      );
    } catch (err) {
      console.error("Save all failed", err);
      // Ruling P10: surface bulk-download errors inline so users know to retry.
      setSaveAllFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id={headingId} className="text-section-title text-text-primary">
            {done ? t("result.title_done", { count: clips.length }) : t("result.title_partial", { count: clips.length })}
          </h2>
          {failedCount > 0 && <p className="text-body text-error">{t("result.failed", { count: failedCount })}</p>}
        </div>
        {done && clips.length > 1 && (
          <Button size="lg" icon={Download} loading={saving} onClick={() => void saveAll()}>
            {t("result.download_all")}
          </Button>
        )}
      </div>
      {saveAllFailed && (
        <p role="alert" className="text-body text-error">
          {t("result.download_all_failed")}
        </p>
      )}
      {done && <JobWarnings warnings={metadata?.warnings} />}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {clips.map((clip, i) => (
          <ClipCard key={clip.path || i} clip={clip} index={i} jobId={jobId} onEdit={onEditClip ? () => onEditClip(i) : undefined} />
        ))}
      </div>
      {done && <TimingDetails metadata={metadata} />}
      {done && onNew && (
        <Button variant="outline" icon={Plus} className="self-start" onClick={onNew}>
          {t("result.new")}
        </Button>
      )}
    </section>
  );
}
