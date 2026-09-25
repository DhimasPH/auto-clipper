import { useContext, useEffect, useState } from "react";
import { Loader2, StopCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppContext } from "../App";
import { Button } from "./ui/Button";

export default function BusyOverlay() {
  const { t } = useTranslation();
  const ctx = useContext(AppContext);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [rotateIdx, setRotateIdx] = useState(0);

  useEffect(() => {
    if (!ctx?.isRunning) {
      setElapsedSeconds(0);
      setRotateIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [ctx?.isRunning]);

  useEffect(() => {
    if (ctx?.status === 'TRANSCRIBING' || ctx?.status === 'ANALYZING') {
      const rot = setInterval(() => {
        setRotateIdx((prev) => (prev + 1) % 4);
      }, 4500);
      return () => clearInterval(rot);
    }
  }, [ctx?.status]);

  if (!ctx || !ctx.isRunning) return null;

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const secs = s % 60;
    return `${m}m ${secs}s`;
  };

  const getStatusText = () => {
    if (elapsedSeconds > 2400) return t('busy.wait_40m', "Harap tunggu, ternyata agak lama ya proses nya");
    if (elapsedSeconds > 1200) return t('busy.wait_20m', "Sabar adalah kunci. Video kamu hampir siap!");
    if (elapsedSeconds > 600) return t('busy.wait_10m', "Sabar yaa, lagi proses nih...");
    
    if (ctx.status === 'TRANSCRIBING' || ctx.status === 'ANALYZING') {
      const messages = [
        t('busy.rotate_1', 'Mengekstrak audio video...'),
        t('busy.rotate_2', 'AI sedang membuat transkrip otomatis...'),
        t('busy.rotate_3', 'Menganalisis momen-momen terbaik...'),
        t('busy.rotate_4', 'Mengompresi hasil akhir...')
      ];
      return messages[rotateIdx];
    }
    return ctx.progress || t('busy.preparing', 'Menyiapkan proses…');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-6">
      <div className="w-full max-w-md bg-bg-secondary border border-border rounded-card shadow-xl p-6 flex flex-col gap-5 animate-in fade-in duration-300">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-accent animate-spin shrink-0" />
          <div className="min-w-0">
            <h3 className="text-body font-medium text-text-primary">{t('busy.processing', 'Sedang memproses…')}</h3>
            <p className="text-caption text-text-secondary truncate">{getStatusText()}</p>
          </div>
        </div>

        <div className="flex justify-center text-[12px] font-semibold text-text-secondary">
          <span>{t('busy.elapsed', '⏳ Waktu berjalan:')} {formatTime(elapsedSeconds)}</span>
        </div>

        <p className="text-caption text-text-secondary">
          {t('busy.warning', 'Mohon tunggu hingga proses selesai. Aplikasi terkunci sementara supaya tidak ada proses lain berjalan bersamaan — jangan tutup aplikasi.')}
        </p>

        <Button variant="danger" icon={StopCircle} onClick={ctx.cancelJob} className="w-full">
          {t('busy.cancel', 'Batalkan Proses')}
        </Button>
      </div>
    </div>
  );
}
