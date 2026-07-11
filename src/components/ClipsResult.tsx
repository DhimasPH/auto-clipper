import ClipCard, { Clip } from "./ClipCard";
import { Badge } from "./ui/Badge";

interface ClipsResultProps {
  clips: Clip[];
  status: string;
  failedCount: number;
  videoSrc: (p: string, v?: number) => string;
}

export default function ClipsResult({ clips, status, failedCount, videoSrc }: ClipsResultProps) {
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
