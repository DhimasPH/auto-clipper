import ClipCard, { Clip } from "./ClipCard";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Plus } from "lucide-react";
import { useContext } from "react";
import { AppContext } from "../App";
import { useTranslation } from "react-i18next";

interface ClipsResultProps {
  clips: Clip[];
  status: string;
  failedCount: number;
  videoSrc: (p: string, v?: number) => string;
}

export default function ClipsResult({ clips, status, failedCount, videoSrc }: ClipsResultProps) {
  const { t } = useTranslation();
  const ctx = useContext(AppContext);

  if (clips.length === 0) return null;
  
  return (
    <section className="animate-slide-up flex flex-col gap-6 mt-4 pb-12">
      <div className="flex items-center gap-3">
        <h2 className="text-section-title text-text-primary m-0">
          {status === "DONE" ? 'Generated Clips' : 'Generating Clips...'}
        </h2>
        {status === "DONE" && (
          <Badge variant="success">
            {clips.length} clip{clips.length > 1 ? "s" : ""}
          </Badge>
        )}
        {failedCount > 0 && (
          <Badge variant="error">
            {failedCount} failed
          </Badge>
        )}
        {(status === "DONE" || status === "ERROR") && (
          <div className="ml-auto">
            <Button variant="outline" icon={Plus} onClick={ctx.handleResetWorkspace}>
              {t("main.btn_new_clip", "Buat Klip Baru")}
            </Button>
          </div>
        )}
      </div>
      
      <div className="flex gap-6 flex-wrap">
        {clips.map((clip, i) => (
          <ClipCard
            key={clip.path}
            clip={clip}
            index={i}
            videoSrc={videoSrc}
          />
        ))}
      </div>
    </section>
  );
}
