import React, { useContext, useEffect, useState } from "react";
import { Loader2, StopCircle } from "lucide-react";
import { AppContext } from "../App";

export const BusyOverlay: React.FC = () => {
  const ctx = useContext(AppContext);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [rotateIdx, setRotateIdx] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);

  const isRunning =
    ctx?.isRunning ??
    (ctx?.isLoading ||
      (ctx?.isPolling &&
        ctx?.status !== "IDLE" &&
        ctx?.status !== "DONE" &&
        ctx?.status !== "ERROR" &&
        ctx?.status !== "CANCELLED" &&
        ctx?.status !== "AWAITING_MANUAL"));

  useEffect(() => {
    if (!isRunning) {
      setElapsedSeconds(0);
      setRotateIdx(0);
      setIsCancelling(false);
      return;
    }
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    if (ctx?.status === "TRANSCRIBING") {
      const rot = setInterval(() => {
        setRotateIdx((prev) => (prev + 1) % 4);
      }, 4500);
      return () => clearInterval(rot);
    }
  }, [ctx?.status]);

  if (!isRunning) return null;

  // Calculate percentage
  let displayPct = 0;
  const match = ctx?.progress?.match(/(\d+)%/);
  if (match) {
    displayPct = Math.min(99, parseInt(match[1], 10));
  } else if (ctx?.status === "DOWNLOADING") {
    displayPct = Math.min(30, 10 + Math.floor(elapsedSeconds / 5));
  } else if (ctx?.status === "TRANSCRIBING") {
    // start at 40, max at 65, 1% every 12 seconds
    displayPct = Math.min(65, 40 + Math.floor(elapsedSeconds / 12));
  } else if (ctx?.status === "CROPPING" || ctx?.status === "PROCESSING") {
    displayPct = Math.min(95, 65 + Math.floor(elapsedSeconds / 8));
  } else if (ctx?.status === "PENDING" || ctx?.status === "QUEUED") {
    displayPct = 5;
  } else {
    displayPct = Math.min(90, 10 + Math.floor(elapsedSeconds / 10));
  }

  const estimatedTotal = displayPct > 0 ? (elapsedSeconds * 100) / displayPct : 0;
  const estimatedRemaining = Math.max(0, Math.floor(estimatedTotal - elapsedSeconds));

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const secs = s % 60;
    return `${m}m ${secs}s`;
  };

  const getStatusText = () => {
    if (elapsedSeconds > 2400) return "Harap tunggu, proses membutuhkan waktu lebih lama...";
    if (elapsedSeconds > 1200) return "Sabar adalah kunci. Video kamu hampir siap!";
    if (elapsedSeconds > 600) return "Sedang diproses di GPU Cloud...";

    if (ctx?.status === "TRANSCRIBING") {
      const messages = [
        "Mengekstrak audio video...",
        "AI sedang membuat transkrip otomatis...",
        "Menganalisis momen-momen terbaik...",
        "Menyiapkan stempel waktu kata...",
      ];
      return messages[rotateIdx];
    }

    if (ctx?.status === "CROPPING" || ctx?.status === "PROCESSING") {
      return ctx?.progress || "Sedang memotong & merender klip video...";
    }

    if (ctx?.status === "DOWNLOADING") {
      return ctx?.progress || "Sedang mengunduh video sumber...";
    }

    return ctx?.progress || "Menyiapkan proses di Google Colab GPU…";
  };

  const handleCancel = async () => {
    if (window.confirm("Yakin ingin membatalkan proses video ini?")) {
      setIsCancelling(true);
      try {
        if (ctx?.cancelCurrentJob) {
          await ctx.cancelCurrentJob();
        }
      } catch (err) {
        console.error("Failed to cancel job:", err);
      } finally {
        setIsCancelling(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-6 animate-fadeIn">
      <div className="w-full max-w-md bg-white border border-border rounded-3xl shadow-2xl p-6 sm:p-7 flex flex-col gap-5 animate-slide-up">
        {/* Header Icon + Title */}
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-purple-50 rounded-2xl border border-purple-100 shrink-0">
            <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-base sm:text-lg text-text-primary">Sedang Memproses…</h3>
            <p className="text-xs text-text-secondary truncate mt-0.5">{getStatusText()}</p>
          </div>
        </div>

        {/* Progress Bar & Percentage */}
        <div className="space-y-2 bg-bg-surface/50 p-4 rounded-2xl border border-border/70">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-text-secondary">Progress</span>
            <span className="text-purple-600 font-bold">{displayPct}%</span>
          </div>

          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-border/50">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-pink-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${displayPct}%` }}
            />
          </div>

          <div className="flex justify-between text-[11px] text-text-secondary pt-1 font-mono">
            <span>⏳ Berjalan: {formatTime(elapsedSeconds)}</span>
            <span>
              Estimasi: {displayPct > 0 ? formatTime(estimatedRemaining) : "Menghitung..."}
            </span>
          </div>
        </div>

        {/* Warning Note */}
        <div className="p-3.5 bg-purple-50/60 border border-purple-100 rounded-2xl text-xs text-purple-900 leading-relaxed">
          <p>
            Mohon tunggu hingga proses selesai. Video sedang diproses di GPU Colab — jangan tutup browser agar sinkronisasi tetap berjalan.
          </p>
        </div>

        {/* Cancel Button */}
        <button
          type="button"
          onClick={handleCancel}
          disabled={isCancelling}
          className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <StopCircle className="w-4 h-4" />
          <span>{isCancelling ? "Membatalkan..." : "Batalkan Proses"}</span>
        </button>
      </div>
    </div>
  );
};
export default BusyOverlay;
