import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { snapValue } from '../../lib/snap';

interface ZoomableTimelineProps {
  duration: number;
  currentTime: number;
  onSeek: (s: number) => void;
  peaks: number[] | null;
  silence: { start: number; end: number }[] | null;
  showSilence: boolean;
  showWaveform: boolean;
  trim: { start: number; end: number };
  onTrimChange: (start: number, end: number) => void;
  boundaries: number[];
  snapThreshold?: number;
  fetchThumbnails: (start: number, end: number, count: number) => Promise<string[]>;
  loading?: boolean;
  loadingLabel?: string;
  audioLabel?: string;
  videoLabel?: string;
  peakThreshold?: number;
}

const MAX_PX_PER_SEC = 240;
const AUDIO_H = 60;
const VIDEO_H = 84;
const THUMB_ASPECT = 16 / 9;

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

export const ZoomableTimeline: React.FC<ZoomableTimelineProps> = ({
  duration, currentTime, onSeek, peaks, silence, showSilence, showWaveform,
  trim, onTrimChange, boundaries, snapThreshold = 0.5, fetchThumbnails,
  loading, loadingLabel, audioLabel, videoLabel, peakThreshold = 0.6,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const waveCanvasRef = useRef<HTMLCanvasElement>(null);

  const [viewportW, setViewportW] = useState(0);
  const [pxPerSec, setPxPerSec] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [thumbWindow, setThumbWindow] = useState<{ start: number; end: number; uris: string[] } | null>(null);

  const thumbCache = useRef<Map<string, string[]>>(new Map());
  const pendingScroll = useRef<number | null>(null);
  const fetchTimer = useRef<any>(null);
  const fetchSeq = useRef(0);

  const fitPxPerSec = viewportW > 0 && duration > 0 ? viewportW / duration : 0;
  const totalWidth = duration > 0 && pxPerSec > 0 ? duration * pxPerSec : viewportW;

  // Measure viewport width.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setViewportW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Initialise zoom to "fit whole video" once we know the dimensions.
  useEffect(() => {
    if (pxPerSec === 0 && fitPxPerSec > 0) setPxPerSec(fitPxPerSec);
  }, [fitPxPerSec, pxPerSec]);

  // Apply a pending scroll position after a zoom changes the content width.
  useEffect(() => {
    if (pendingScroll.current != null && viewportRef.current) {
      viewportRef.current.scrollLeft = pendingScroll.current;
      setScrollLeft(pendingScroll.current);
      pendingScroll.current = null;
    }
  }, [pxPerSec]);

  const onScroll = useCallback(() => {
    const el = viewportRef.current;
    if (el) setScrollLeft(el.scrollLeft);
  }, []);

  const zoomBy = (factor: number) => {
    if (pxPerSec <= 0 || viewportW <= 0) return;
    const centerTime = (scrollLeft + viewportW / 2) / pxPerSec;
    const next = Math.min(MAX_PX_PER_SEC, Math.max(fitPxPerSec, pxPerSec * factor));
    if (next === pxPerSec) return;
    pendingScroll.current = Math.max(0, centerTime * next - viewportW / 2);
    setPxPerSec(next);
  };

  const fitAll = () => {
    if (fitPxPerSec <= 0) return;
    pendingScroll.current = 0;
    setPxPerSec(fitPxPerSec);
  };

  // Percentile-based waveform scaling/colour (matches AudioHeatmap logic).
  const waveStats = useMemo(() => {
    if (!peaks || peaks.length === 0) return null;
    const sorted = [...peaks].sort((a, b) => a - b);
    const pct = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
    return { heightRef: pct(0.97) || Math.max(...peaks) || 1, loud: pct(0.9), range: pct(0.95) - pct(0.5) };
  }, [peaks]);

  // Redraw the waveform for the visible window whenever it scrolls or zooms.
  useEffect(() => {
    const canvas = waveCanvasRef.current;
    if (!canvas || !peaks || peaks.length === 0 || !waveStats || viewportW <= 0 || pxPerSec <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewportW * dpr;
    canvas.height = AUDIO_H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewportW, AUDIO_H);
    const mid = AUDIO_H / 2;
    const N = peaks.length;
    const secPerPeak = duration / N;
    for (let x = 0; x < viewportW; x += 2) {
      const t = (scrollLeft + x) / pxPerSec;
      const i = Math.min(N - 1, Math.max(0, Math.floor(t / secPerPeak)));
      const v = peaks[i];
      const norm = Math.min(1, v / waveStats.heightRef);
      const barH = Math.max(1, norm * (AUDIO_H - 2));
      const isPeak = waveStats.range > 0.02 && v >= waveStats.loud && v >= peakThreshold * waveStats.heightRef;
      ctx.fillStyle = isPeak ? '#ef4444' : '#64748b';
      ctx.fillRect(x, mid - barH / 2, 2, barH);
    }
  }, [scrollLeft, pxPerSec, peaks, waveStats, viewportW, duration, peakThreshold]);

  // Lazily fetch thumbnails for the visible window (debounced).
  useEffect(() => {
    if (viewportW <= 0 || pxPerSec <= 0 || duration <= 0) return;
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(async () => {
      const visStart = Math.max(0, scrollLeft / pxPerSec);
      const visEnd = Math.min(duration, (scrollLeft + viewportW) / pxPerSec);
      const pad = (visEnd - visStart) * 0.15;
      const start = Math.max(0, visStart - pad);
      const end = Math.min(duration, visEnd + pad);
      const thumbW = VIDEO_H * THUMB_ASPECT;
      const count = Math.max(4, Math.min(40, Math.ceil(((end - start) * pxPerSec) / thumbW)));
      const key = `${start.toFixed(1)}_${end.toFixed(1)}_${count}`;
      if (thumbCache.current.has(key)) {
        setThumbWindow({ start, end, uris: thumbCache.current.get(key)! });
        return;
      }
      const seq = ++fetchSeq.current;
      try {
        const uris = await fetchThumbnails(start, end, count);
        if (seq !== fetchSeq.current) return; // a newer request superseded this one
        thumbCache.current.set(key, uris);
        setThumbWindow({ start, end, uris });
      } catch { /* keep previous thumbnails */ }
    }, 180);
    return () => { if (fetchTimer.current) clearTimeout(fetchTimer.current); };
  }, [scrollLeft, pxPerSec, viewportW, duration, fetchThumbnails]);

  const timeFromClientX = (clientX: number) => {
    const el = contentRef.current;
    if (!el || pxPerSec <= 0) return 0;
    const rect = el.getBoundingClientRect();
    return Math.min(duration, Math.max(0, (clientX - rect.left) / pxPerSec));
  };

  const handleSeekClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.handle) return; // ignore trimmer handles
    onSeek(timeFromClientX(e.clientX));
  };

  const beginTrim = (which: 'start' | 'end') => (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const move = (ev: MouseEvent) => {
      let secs = snapValue(timeFromClientX(ev.clientX), boundaries, snapThreshold);
      secs = Math.min(duration, Math.max(0, secs));
      if (which === 'start') onTrimChange(Math.min(secs, trim.end - 0.1), trim.end);
      else onTrimChange(trim.start, Math.max(secs, trim.start + 0.1));
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // Visible silence blocks only (virtualized).
  const visibleSilence = useMemo(() => {
    if (!silence || pxPerSec <= 0) return [];
    const vs = scrollLeft / pxPerSec;
    const ve = (scrollLeft + viewportW) / pxPerSec;
    return silence.filter((s) => s.end >= vs && s.start <= ve);
  }, [silence, scrollLeft, viewportW, pxPerSec]);

  const canZoomIn = pxPerSec < MAX_PX_PER_SEC - 0.01;
  const canZoomOut = pxPerSec > fitPxPerSec + 0.01;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => zoomBy(1 / 1.6)} disabled={!canZoomOut}
          className="p-1.5 rounded border border-border text-text-secondary hover:text-text-primary disabled:opacity-40" aria-label="Zoom out">
          <ZoomOut className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => zoomBy(1.6)} disabled={!canZoomIn}
          className="p-1.5 rounded border border-border text-text-secondary hover:text-text-primary disabled:opacity-40" aria-label="Zoom in">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button type="button" onClick={fitAll}
          className="p-1.5 rounded border border-border text-text-secondary hover:text-text-primary" aria-label="Fit">
          <Maximize2 className="w-4 h-4" />
        </button>
        <span className="ml-auto text-caption text-text-secondary">{fmt(trim.start)} – {fmt(trim.end)}</span>
      </div>

      {/* Waveform lane (redraws for the visible window) */}
      {showWaveform && peaks && peaks.length > 0 && (
        <div>
          <div className="text-overline text-text-tertiary mb-1">{audioLabel || 'Audio'}</div>
          <div className="rounded-lg border border-border bg-black/40 overflow-hidden" style={{ height: AUDIO_H }}>
            <canvas ref={waveCanvasRef} onClick={(e) => onSeek(timeFromClientX(e.clientX))} style={{ width: '100%', height: AUDIO_H, display: 'block' }} />
          </div>
        </div>
      )}

      {/* Filmstrip lane (native horizontal scroll) */}
      <div>
        <div className="text-overline text-text-tertiary mb-1">{videoLabel || 'Video'}</div>
        <div
          ref={viewportRef}
          onScroll={onScroll}
          className="relative w-full overflow-x-auto overflow-y-hidden rounded-lg border border-border bg-black/40"
          style={{ height: VIDEO_H }}
        >
          {loading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center text-caption text-text-secondary bg-bg-surface/80">
              {loadingLabel || 'Loading…'}
            </div>
          )}
          <div ref={contentRef} onClick={handleSeekClick} className="relative h-full" style={{ width: totalWidth }}>
            {/* thumbnails for current window */}
            {thumbWindow && thumbWindow.uris.length > 0 && pxPerSec > 0 && (() => {
              const M = thumbWindow.uris.length;
              const cellSec = (thumbWindow.end - thumbWindow.start) / M;
              const cellPx = cellSec * pxPerSec;
              return thumbWindow.uris.map((src, k) => (
                <div key={k} className="absolute top-0 bottom-0" style={{
                  left: (thumbWindow.start + k * cellSec) * pxPerSec,
                  width: Math.max(1, cellPx),
                  backgroundImage: `url(${src})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  borderRight: '1px solid rgba(0,0,0,0.25)',
                }} />
              ));
            })()}

            {/* silence blocks */}
            {showSilence && visibleSilence.map((s, i) => (
              <div key={i} className="absolute top-0 bottom-0 bg-slate-500/30 border-x border-slate-400/40 pointer-events-none"
                style={{ left: s.start * pxPerSec, width: Math.max(1, (s.end - s.start) * pxPerSec) }} />
            ))}

            {/* trim region + handles */}
            <div className="absolute top-0 bottom-0 bg-accent/20 border-x-2 border-accent pointer-events-none"
              style={{ left: trim.start * pxPerSec, width: Math.max(1, (trim.end - trim.start) * pxPerSec) }} />
            <div data-handle="start" onMouseDown={beginTrim('start')}
              className="absolute top-0 bottom-0 w-2 -ml-1 bg-accent cursor-ew-resize rounded z-20"
              style={{ left: trim.start * pxPerSec }} />
            <div data-handle="end" onMouseDown={beginTrim('end')}
              className="absolute top-0 bottom-0 w-2 -ml-1 bg-accent cursor-ew-resize rounded z-20"
              style={{ left: trim.end * pxPerSec }} />

            {/* playhead */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-white z-10 pointer-events-none"
              style={{ left: currentTime * pxPerSec }} />
          </div>
        </div>
      </div>
    </div>
  );
};
