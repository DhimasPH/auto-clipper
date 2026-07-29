import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface UpdateOverlayProps {
  isOpen: boolean;
  progressPct: number;
}

export default function UpdateOverlay({ isOpen, progressPct }: UpdateOverlayProps) {
  const { t } = useTranslation();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setElapsedSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const estimatedTotal = progressPct > 0 ? (elapsedSeconds * 100) / progressPct : 0;
  const estimatedRemaining = Math.max(0, Math.floor(estimatedTotal - elapsedSeconds));

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const secs = s % 60;
    return `${m}m ${secs}s`;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6">
      <div className="w-full max-w-md bg-bg-secondary border border-border rounded-card shadow-xl p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-accent animate-spin shrink-0" />
          <div className="min-w-0">
            <h3 className="text-body font-medium text-text-primary">{t('updater.downloading', 'Mengunduh...')}</h3>
            <p className="text-caption text-text-secondary truncate">{t('updater.download_progress', 'Mengunduh file pembaruan...')}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-caption text-text-secondary font-medium">
            <span>{t('busy.progress', 'Progress')}</span>
            <span>{Math.floor(progressPct)}%</span>
          </div>
          <div className="w-full h-2 bg-surface-raised rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300 ease-out rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-caption text-text-secondary pt-1">
            <span>{t('busy.elapsed', '⏳ Waktu berjalan:')} {formatTime(elapsedSeconds)}</span>
            <span>{t('busy.estimated', 'Estimasi sisa:')} {progressPct > 0 ? formatTime(estimatedRemaining) : t('busy.calculating', 'Menghitung...')}</span>
          </div>
        </div>

        <p className="text-caption text-text-secondary">
          {t('updater.warning', 'Mohon tunggu hingga proses selesai. Aplikasi jangan ditutup selama proses pembaruan berlangsung.')}
        </p>
      </div>
    </div>
  );
}
