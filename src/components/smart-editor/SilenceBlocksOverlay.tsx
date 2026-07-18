import React from 'react';

interface SilenceBlocksOverlayProps {
  silence: { start: number; end: number }[] | null;
  duration: number;
}

/** Semi-transparent blocks marking silent regions across the timeline. */
export const SilenceBlocksOverlay: React.FC<SilenceBlocksOverlayProps> = ({ silence, duration }) => {
  if (!silence || silence.length === 0 || duration <= 0) return null;
  return (
    <div className="absolute inset-0 pointer-events-none">
      {silence.map((s, i) => {
        const left = (s.start / duration) * 100;
        const width = ((s.end - s.start) / duration) * 100;
        return (
          <div
            key={i}
            className="absolute top-0 bottom-0 bg-slate-500/30 border-x border-slate-400/40"
            style={{ left: `${left}%`, width: `${width}%` }}
          />
        );
      })}
    </div>
  );
};
