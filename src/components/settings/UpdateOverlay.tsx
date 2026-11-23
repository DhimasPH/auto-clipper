import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog } from "../ui/Dialog";
import { formatClock } from "../../lib/clipInfo";

interface UpdateOverlayProps {
  isOpen: boolean;
  progressPct: number;
}

/** The update is downloading and installing: a dialog that cannot be closed until it ends. */
export default function UpdateOverlay({ isOpen, progressPct }: UpdateOverlayProps) {
  // Mounted only while open, so the elapsed time starts at zero each time.
  return isOpen ? <UpdateProgress progressPct={progressPct} /> : null;
}

function UpdateProgress({ progressPct }: { progressPct: number }) {
  const { t } = useTranslation();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsedSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const pct = Math.max(0, Math.min(100, Math.floor(progressPct)));

  return (
    <Dialog title={t("updater.downloading")}>
      <div className="flex flex-col gap-4">
        <p className="text-body text-text-primary">{t("updater.warning")}</p>
        <div className="flex flex-col gap-2">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={t("updater.download_progress")}
            className="h-2 w-full overflow-hidden rounded-full border border-border-active bg-bg-surface"
          >
            <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
          <p className="flex flex-wrap justify-between gap-2 text-caption text-text-secondary">
            <span>{t("updater.percent", { pct })}</span>
            <span>{t("updater.elapsed", { time: formatClock(elapsedSeconds) })}</span>
          </p>
        </div>
      </div>
    </Dialog>
  );
}
