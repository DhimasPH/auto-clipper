import ClipCard, { Clip } from "./ClipCard";

interface ClipsResultProps {
  clips: Clip[];
  status: string;
  failedCount: number;
  mode: "ai" | "manual";
  videoSrc: (p: string, v?: number) => string;
}

/** Results grid shown after (or during) a render. */
export default function ClipsResult({ clips, status, failedCount, mode, videoSrc }: ClipsResultProps) {
  if (clips.length === 0) return null;
  return (
    <section
      className="animate-slide-up"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        marginTop: "1rem",
      }}
    >
      <h2 style={{ fontSize: "1.5rem", margin: 0 }}>
        {status === "DONE"
          ? `Generated ${clips.length} clip${clips.length > 1 ? "s" : ""}${failedCount > 0 ? ` (${failedCount} gagal)` : ""}`
          : "Generating clips..."}
      </h2>
      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
        {clips.map((clip, i) => (
          <ClipCard
            key={clip.path}
            clip={clip}
            index={i}
            mode={mode}
            videoSrc={videoSrc}
          />
        ))}
      </div>
    </section>
  );
}
