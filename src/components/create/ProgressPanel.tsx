import React, { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Circle, CircleCheck, LoaderCircle, X } from "lucide-react";
import { useNow } from "../../hooks/useNow";
import { deviceNotes, progressRows, stagesFor, type DeviceNote, type LiveStage, type ProgressRow, type TrackingMeta } from "../../lib/progress";
import { formatDuration } from "../../lib/timings";
import { platform } from "../../platform";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";

export interface ProgressPanelProps {
  step: 2 | 3 | 4;
  autoAi: boolean;
  /** Face tracking runs (vertical/square with "Ikuti wajah"). */
  tracking: boolean;
  /** The video came from this device or Drive: "download" is only a copy. */
  localSource: boolean;
  current: LiveStage | null;
  timings: unknown;
  /** Job metadata: which face tracker was asked for and which one ran (SP3). */
  meta?: TrackingMeta | null;
  queuePosition: number | null;
  onCancel: () => void;
}

const TITLE: Record<2 | 3 | 4, string> = { 2: "progress.title_prepare", 3: "progress.title_choose", 4: "progress.title_make" };

/** Steps 2 and 4 (spec 4.3): part of the page, not an overlay, so the menu stays usable. */
export const ProgressPanel: React.FC<ProgressPanelProps> = ({
  step,
  autoAi,
  tracking,
  localSource,
  current,
  timings,
  meta,
  queuePosition,
  onCancel,
}) => {
  const { t } = useTranslation();
  const headingId = useId();
  const now = useNow();
  const [confirming, setConfirming] = useState(false);

  // Count up from the backend's elapsed time between two polls (the phone's clock may differ).
  const [base, setBase] = useState(() => ({ at: Date.now(), elapsed: current?.elapsed_seconds ?? 0 }));
  useEffect(() => {
    setBase({ at: Date.now(), elapsed: current?.elapsed_seconds ?? 0 });
  }, [current?.stage, current?.elapsed_seconds, current?.clip]);

  const stages = stagesFor(step, { autoAi, tracking });
  const rows = progressRows(stages, timings, current);
  const notes = deviceNotes(current, timings, stages, meta);
  const caps = platform().caps;
  // Where add-ons cannot be installed (cloud), "install it in Settings" would send people nowhere.
  const noteKey = (note: DeviceNote) =>
    note === "fallback_tracking" && !caps.addons ? "progress.fallback_tracking_unavailable" : `progress.${note}`;
  const units = { hour: t("timing.unit_hour"), minute: t("timing.unit_minute"), second: t("timing.unit_second") };

  const label = (row: ProgressRow) => {
    const name = row.stage === "download" && localSource ? t("progress.stage_copy") : t(`timing.stage_${row.stage}`, { defaultValue: row.stage });
    if (row.clip === null) return name;
    const clip = row.clipsTotal ? t("progress.clip_of", { clip: row.clip, total: row.clipsTotal }) : t("progress.clip_n", { clip: row.clip });
    return `${name} ${clip}`;
  };

  const detail = (row: ProgressRow) => {
    if (row.state === "done" && row.seconds !== null) return t("progress.took", { time: formatDuration(row.seconds, units) });
    if (row.state !== "running") return "";
    const elapsed = base.elapsed + Math.max(0, (now - base.at) / 1000);
    const parts = [t("progress.running_for", { time: formatDuration(elapsed, units) })];
    if (row.percent !== null) parts.unshift(`${Math.round(row.percent)}%`);
    return parts.join(" · ");
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-card border border-border bg-bg-secondary p-4 md:p-6">
      <div className="flex items-center gap-3">
        {/* The spinner says "working"; prefers-reduced-motion stops it (index.css). */}
        <LoaderCircle className="h-6 w-6 shrink-0 animate-spin text-accent" aria-hidden="true" />
        <h2 id={headingId} className="text-section-title text-text-primary">
          {t(TITLE[step])}
        </h2>
      </div>

      {queuePosition ? (
        <p role="status" className="text-body text-text-primary">
          {t("progress.queue", { n: queuePosition })}
        </p>
      ) : null}

      <ol className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.stage} className="flex min-h-[44px] items-start gap-3 py-1">
            {row.state === "done" ? (
              <CircleCheck role="img" className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-label={t("progress.state_done")} />
            ) : row.state === "running" ? (
              <Circle role="img" className="mt-0.5 h-5 w-5 shrink-0 fill-accent text-accent" aria-label={t("progress.state_running")} />
            ) : (
              <Circle role="img" className="mt-0.5 h-5 w-5 shrink-0 text-text-secondary" aria-label={t("progress.state_todo")} />
            )}
            <div className="min-w-0">
              <p className={`text-body ${row.state === "todo" ? "text-text-secondary" : "text-text-primary"} ${row.state === "running" ? "font-semibold" : ""}`}>
                {label(row)}
              </p>
              {detail(row) && <p className="text-caption text-text-secondary">{detail(row)}</p>}
            </div>
          </li>
        ))}
      </ol>

      {notes.map((note) => (
        <p key={note} className="rounded-card border border-border bg-bg-surface p-3 text-body text-text-primary">
          {t(noteKey(note))}
        </p>
      ))}

      <p className="text-body text-text-secondary">{t(`progress.keep_open_${caps.keepOpen}`)}</p>

      <Button variant="outline" icon={X} className="self-start" onClick={() => setConfirming(true)}>
        {t("progress.cancel")}
      </Button>
      <ConfirmDialog
        isOpen={confirming}
        title={t("progress.cancel_title")}
        message={t("progress.cancel_body")}
        confirmLabel={t("progress.cancel_confirm")}
        cancelLabel={t("progress.cancel_keep")}
        isDestructive
        onConfirm={() => {
          setConfirming(false);
          onCancel();
        }}
        onCancel={() => setConfirming(false)}
      />
    </section>
  );
};
