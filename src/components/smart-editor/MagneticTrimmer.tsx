import React from 'react';
import { snapValue } from '../../lib/snap';

interface MagneticTrimmerProps {
  start: number;
  end: number;
  duration: number;
  boundaries: number[]; // snap candidates (silence edges, peaks)
  snapThreshold?: number;
  onChange: (start: number, end: number) => void;
}

/** Draggable start/end handles with magnetic snapping to nearby boundaries. */
export const MagneticTrimmer: React.FC<MagneticTrimmerProps> = ({
  start, end, duration, boundaries, snapThreshold = 0.5, onChange,
}) => {
  const dragging = React.useRef<null | 'start' | 'end'>(null);

  const beginDrag = (which: 'start' | 'end') => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dragging.current = which;

    const move = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const parent = (e.target as HTMLElement).closest('[data-trimmer-track]') as HTMLElement | null;
      const rect = (parent || (e.target as HTMLElement).parentElement)?.getBoundingClientRect();
      if (!rect || duration <= 0) return;
      const ratio = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      let secs = snapValue(ratio * duration, boundaries, snapThreshold);
      secs = Math.min(duration, Math.max(0, secs));
      if (dragging.current === 'start') {
        onChange(Math.min(secs, end - 0.1), end);
      } else {
        onChange(start, Math.max(secs, start + 0.1));
      }
    };
    const up = () => {
      dragging.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  if (duration <= 0) return null;
  const leftPct = (start / duration) * 100;
  const widthPct = ((end - start) / duration) * 100;

  return (
    <div data-trimmer-track className="absolute inset-0">
      <div
        className="absolute top-0 bottom-0 bg-accent/20 border-x-2 border-accent"
        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
      />
      <div
        onMouseDown={beginDrag('start')}
        className="absolute top-0 bottom-0 w-2 -ml-1 bg-accent cursor-ew-resize rounded"
        style={{ left: `${leftPct}%` }}
      />
      <div
        onMouseDown={beginDrag('end')}
        className="absolute top-0 bottom-0 w-2 -ml-1 bg-accent cursor-ew-resize rounded"
        style={{ left: `${leftPct + widthPct}%` }}
      />
    </div>
  );
};
