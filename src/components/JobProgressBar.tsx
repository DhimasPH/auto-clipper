import { useContext } from "react";
import { StopCircle } from "lucide-react";
import { AppContext } from "../App";
import { Button } from "./ui/Button";

export default function JobProgressBar() {
  const ctx = useContext(AppContext);
  if (!ctx || !ctx.isRunning) return null;

  return (
    <div className="sticky top-0 z-40 bg-bg-secondary border-b border-border px-6 py-3 shadow-sm">
      <div className="flex items-center gap-4 max-w-5xl mx-auto">
        <div className="flex-1 min-w-0">
          <div className="flex justify-between text-caption text-text-secondary font-medium mb-1">
            <span className="truncate">{ctx.progress || "Memproses..."}</span>
            <span className="pl-3">{ctx.progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-surface-raised rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300 ease-out rounded-full"
              style={{ width: `${ctx.progressPct}%` }}
            />
          </div>
        </div>
        <Button variant="danger" icon={StopCircle} onClick={ctx.cancelJob}>
          Batal
        </Button>
      </div>
    </div>
  );
}
