import React from 'react';
import { API_URL } from '../../App';

export interface SpriteMeta {
  url: string;
  count: number;
  cols: number;
  rows: number;
  thumb_w: number;
  thumb_h: number;
  interval: number;
}

interface AdvancedTimelineProps {
  sprite: SpriteMeta | null;
  duration: number;
  currentTime: number;
  onSeek: (seconds: number) => void;
  children?: React.ReactNode; // overlays (silence blocks, trimmer)
  loading?: boolean;
  loadingLabel?: string;
}

/** Horizontal filmstrip built from a server-generated sprite, plus playhead. */
export const AdvancedTimeline: React.FC<AdvancedTimelineProps> = ({
  sprite, duration, currentTime, onSeek, children, loading, loadingLabel,
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
      className="relative w-full h-16 rounded-lg overflow-hidden bg-bg-surface border border-border cursor-pointer select-none"
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-caption text-text-secondary bg-bg-surface/80 z-20">
          {loadingLabel || 'Loading…'}
        </div>
      )}

      {sprite && sprite.count > 0 && (
        <div className="absolute inset-0">
          {Array.from({ length: sprite.count }).map((_, i) => {
            const col = i % sprite.cols;
            const row = Math.floor(i / sprite.cols);
            const posX = sprite.cols > 1 ? (col / (sprite.cols - 1)) * 100 : 0;
            const posY = sprite.rows > 1 ? (row / (sprite.rows - 1)) * 100 : 0;
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0"
                style={{
                  left: `${(i / sprite.count) * 100}%`,
                  width: `${100 / sprite.count}%`,
                  backgroundImage: `url(${API_URL}${sprite.url})`,
                  backgroundSize: `${sprite.cols * 100}% ${sprite.rows * 100}%`,
                  backgroundPosition: `${posX}% ${posY}%`,
                }}
              />
            );
          })}
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
