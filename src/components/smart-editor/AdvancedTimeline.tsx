import React from 'react';

interface AdvancedTimelineProps {
  thumbnails: string[] | null; // base64 data URIs, evenly spaced across duration
  duration: number;
  currentTime: number;
  onSeek: (seconds: number) => void;
  children?: React.ReactNode; // overlays (silence blocks, trimmer)
  loading?: boolean;
  loadingLabel?: string;
}

/** Full-width filmstrip: frames laid edge-to-edge (cover-cropped), plus playhead. */
export const AdvancedTimeline: React.FC<AdvancedTimelineProps> = ({
  thumbnails, duration, currentTime, onSeek, children, loading, loadingLabel,
}) => {
  const barRef = React.useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    const el = barRef.current;
    if (!el || duration <= 0) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  const playheadPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={barRef}
      onClick={handleClick}
      className="relative w-full h-24 rounded-lg overflow-hidden bg-black/40 border border-border cursor-pointer select-none"
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-caption text-text-secondary bg-bg-surface/80 z-20">
          {loadingLabel || 'Loading…'}
        </div>
      )}

      {thumbnails && thumbnails.length > 0 && (
        <div className="absolute inset-0 flex">
          {thumbnails.map((src, i) => (
            <div
              key={i}
              className="h-full min-w-0"
              style={{
                flex: '1 1 0',
                backgroundImage: `url(${src})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                borderRight: i < thumbnails.length - 1 ? '1px solid rgba(0,0,0,0.25)' : undefined,
              }}
            />
          ))}
        </div>
      )}

      {/* overlays (silence blocks, trimmer handles) */}
      <div className="absolute inset-0 z-10">{children}</div>

      {/* playhead */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-accent z-10 pointer-events-none"
        style={{ left: `${playheadPct}%` }}
      />
    </div>
  );
};
