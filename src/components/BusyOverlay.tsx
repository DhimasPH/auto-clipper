import { useContext } from "react";
import { Loader2, StopCircle } from "lucide-react";
import { AppContext } from "../App";
import { Button } from "./ui/Button";

export default function BusyOverlay() {
  const ctx = useContext(AppContext);
  if (!ctx || !ctx.isRunning) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-6">
      <div className="w-full max-w-md bg-bg-secondary border border-border rounded-card shadow-xl p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-accent animate-spin shrink-0" />
          <div className="min-w-0">
            <h3 className="text-body font-medium text-text-primary">Sedang memproses…</h3>
            <p className="text-caption text-text-secondary truncate">{ctx.progress || "Menyiapkan proses…"}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-caption text-text-secondary font-medium">
            <span>Progress</span>
            <span>{ctx.progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-surface-raised rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300 ease-out rounded-full"
              style={{ width: `${ctx.progressPct}%` }}
            />
          </div>
        </div>

        <p className="text-caption text-text-secondary">
          Mohon tunggu hingga proses selesai. Aplikasi terkunci sementara supaya tidak ada proses lain berjalan bersamaan — jangan tutup aplikasi.
        </p>

        <Button variant="danger" icon={StopCircle} onClick={ctx.cancelJob} className="w-full">
          Batalkan Proses
        </Button>
      </div>
    </div>
  );
}
