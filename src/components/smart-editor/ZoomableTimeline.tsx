import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, AlertTriangle } from 'lucide-react';
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
  peakThreshold?: number;
}

const MAX_PX_PER_SEC = 260;
const RULER_H = 22;
const WAVE_H = 48;
const FILM_H = 76;
const THUMB_W = Math.round(FILM_H * (16 / 9)); // ~135
const TICK_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900];

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

export const ZoomableTimeline: React.FC<ZoomableTimelineProps> = ({
  duration, currentTime, onSeek, peaks, silence, showSilence, showWaveform,
  trim, onTrimChange, boundaries, snapThreshold = 0.5, fetchThumbnails,
  loading, loadingLabel, peakThreshold = 0.6,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [viewportW, setViewportW] = useState(0);
  const [pxPerSec, setPxPerSec] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [thumbWindow, setThumbWindow] = useState<{ start: number; end: number; uris: string[] } | null>(null);
  const [thumbError, setThumbError] = useState(false);

  const thumbCache = useRef<Map<string, string[]>>(new Map());
  const pendingScroll = useRef<number | null>(null);
  const fetchTimer = useRef<any>(null);
  const fetchSeq = useRef(0);
  const rafId = useRef<number | null>(null);

  const fitPxPerSec = viewportW > 0 && duration > 0 ? viewportW / duration : 0;
  const hiPxPerSec = Math.max(fitPxPerSec * 1.001, MAX_PX_PER_SEC);
  const totalWidth = duration > 0 && pxPerSec > 0 ? duration * pxPerSec : viewportW;
  const laneTop = { ruler: 0, wave: RULER_H, film: RULER_H + (showWaveform ? WAVE_H : 0) };
  const contentH = RULER_H + (showWaveform ? WAVE_H : 0) + FILM_H;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setViewportW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (pxPerSec === 0 && fitPxPerSec > 0) setPxPerSec(fitPxPerSec);
  }, [fitPxPerSec, pxPerSec]);

  useEffect(() => {
    if (pendingScroll.current != null && viewportRef.current) {
      viewportRef.current.scrollLeft = pendingScroll.current;
      setScrollLeft(pendingScroll.current);
      pendingScroll.current = null;
    }
  }, [pxPerSec]);

  const onScroll = useCallback(() => {
    if (rafId.current != null) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      const el = viewportRef.current;
      if (el) setScrollLeft(el.scrollLeft);
    });
  }, []);

  const applyZoom = (next: number) => {
    if (pxPerSec <= 0 || viewportW <= 0) return;
    const centerTime = (scrollLeft + viewportW / 2) / pxPerSec;
    const clamped = Math.min(hiPxPerSec, Math.max(fitPxPerSec, next));
    if (Math.abs(clamped - pxPerSec) < 0.01) return;
    pendingScroll.current = Math.max(0, centerTime * clamped - viewportW / 2);
    setPxPerSec(clamped);
  };

  // Zoom slider maps 0..100 log-scale between fit and max.
  const sliderVal = fitPxPerSec > 0 && hiPxPerSec > fitPxPerSec
    ? Math.round((Math.log(pxPerSec / fitPxPerSec) / Math.log(hiPxPerSec / fitPxPerSec)) * 100)
    : 0;
  const onSlider = (v: number) => {
    if (fitPxPerSec <= 0) return;
    applyZoom(fitPxPerSec * Math.pow(hiPxPerSec / fitPxPerSec, v / 100));
  };

  const waveStats = useMemo(() => {
    if (!peaks || peaks.length === 0) return null;
    const sorted = [...peaks].sort((a, b) => a - b);
    const pct = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
    return { heightRef: pct(0.97) || Math.max(...peaks) || 1, loud: pct(0.9), range: pct(0.95) - pct(0.5) };
  }, [peaks]);

  const visStart = pxPerSec > 0 ? scrollLeft / pxPerSec : 0;
  const visEnd = pxPerSec > 0 ? (scrollLeft + viewportW) / pxPerSec : duration;

  // Lazily fetch thumbnails for the visible window (debounced).
  useEffect(() => {
    if (viewportW <= 0 || pxPerSec <= 0 || duration <= 0) return;
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    fetchTimer.current = setTimeout(async () => {
      const pad = (visEnd - visStart) * 0.15;
      const start = Math.max(0, visStart - pad);
      const end = Math.min(duration, visEnd + pad);
      const count = Math.max(4, Math.min(40, Math.ceil(((end - start) * pxPerSec) / THUMB_W)));
      const key = `${start.toFixed(1)}_${end.toFixed(1)}_${count}`;
      if (thumbCache.current.has(key)) {
        setThumbWindow({ start, end, uris: thumbCache.current.get(key)! });
        setThumbError(false);
        return;
      }
      const seq = ++fetchSeq.current;
      try {
        const uris = await fetchThumbnails(start, end, count);
        if (seq !== fetchSeq.current) return;
        thumbCache.current.set(key, uris);
        setThumbWindow({ start, end, uris });
        setThumbError(uris.length === 0);
      } catch {
        if (seq === fetchSeq.current) setThumbError(true);
      }
    }, 160);
    return () => { if (fetchTimer.current) clearTimeout(fetchTimer.current); };
  }, [visStart, visEnd, pxPerSec, viewportW, duration, fetchThumbnails]);

  const timeFromClientX = (clientX: number) => {
    const el = contentRef.current;
    if (!el || pxPerSec <= 0) return 0;
    const rect = el.getBoundingClientRect();
    return Math.min(duration, Math.max(0, (clientX - rect.left) / pxPerSec));
  };

  const handleSeekClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.handle) return;
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

  // --- Virtualized elements for the visible window --------------------------

  const ruler = useMemo(() => {
    if (pxPerSec <= 0 || duration <= 0) return [];
    const step = TICK_STEPS.find((s) => s * pxPerSec >= 64) ?? TICK_STEPS[TICK_STEPS.length - 1];
    const first = Math.floor(visStart / step) * step;
    const ticks: number[] = [];
    for (let t = first; t <= visEnd + step && t <= duration; t += step) {
      if (t >= 0) ticks.push(t);
    }
    return ticks;
  }, [pxPerSec, duration, visStart, visEnd]);

  const waveBars = useMemo(() => {
    if (!showWaveform || !peaks || peaks.length === 0 || !waveStats || pxPerSec <= 0) return null;
    const N = peaks.length;
    const secPerPeak = duration / N;
    const startPx = Math.max(0, scrollLeft - 4);
    const endPx = scrollLeft + viewportW + 4;
    const bars: { x: number; h: number; peak: boolean }[] = [];
    for (let x = startPx; x < endPx; x += 2) {
      const t = x / pxPerSec;
      const i = Math.min(N - 1, Math.max(0, Math.floor(t / secPerPeak)));
      const v = peaks[i];
      const norm = Math.min(1, v / waveStats.heightRef);
      bars.push({ x, h: Math.max(1, norm * (WAVE_H - 4)), peak: waveStats.range > 0.02 && v >= waveStats.loud && v >= peakThreshold * waveStats.heightRef });
    }
    return bars;
  }, [showWaveform, peaks, waveStats, pxPerSec, scrollLeft, viewportW, duration, peakThreshold]);

  // Placeholder film cells across the visible range (so it's never just black).
  const filmCells = useMemo(() => {
    if (pxPerSec <= 0 || totalWidth <= 0) return [];
    const startIdx = Math.max(0, Math.floor(scrollLeft / THUMB_W));
    const endIdx = Math.ceil((scrollLeft + viewportW) / THUMB_W);
    const cells: number[] = [];
    for (let i = startIdx; i <= endIdx; i++) cells.push(i);
    return cells;
  }, [pxPerSec, totalWidth, scrollLeft, viewportW]);

  const visibleSilence = useMemo(() => {
    if (!silence || pxPerSec <= 0) return [];
    return silence.filter((s) => s.end >= visStart && s.start <= visEnd);
  }, [silence, visStart, visEnd, pxPerSec]);

  return (
    <div className="rounded-lg border border-border bg-bg-surface overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border">
        <button type="button" onClick={() => onSlider(0)} title="Fit"
          className="p-1 rounded text-text-secondary hover:text-text-primary" aria-label="Fit">
          <Maximize2 className="w-4 h-4" />
        </button>
        <input type="range" min={0} max={100} value={sliderVal}
          onChange={(e) => onSlider(Number(e.target.value))}
          disabled={hiPxPerSec <= fitPxPerSec + 0.01}
          className="w-40 accent-accent" aria-label="Zoom" />
        {thumbError && (
          <span className="flex items-center gap-1 text-caption text-warning">
            <AlertTriangle className="w-3.5 h-3.5" /> thumbnail
          </span>
        )}
        <span className="ml-auto text-caption text-text-secondary tabular-nums">
          {fmt(trim.start)} – {fmt(trim.end)}
        </span>
      </div>

      {/* Scrollable unified timeline */}
      <div
        ref={viewportRef}
        onScroll={onScroll}
        className="relative w-full overflow-x-auto overflow-y-hidden bg-black/50"
        style={{ height: contentH }}
      >
        {loading && (
          <div className="absolute inset-0 z-40 flex items-center justify-center text-caption text-text-secondary bg-bg-surface/80">
            {loadingLabel || 'Loading…'}
          </div>
        )}

        <div ref={contentRef} onClick={handleSeekClick} className="relative" style={{ width: totalWidth, height: contentH }}>
          {/* Ruler */}
          <div className="absolute left-0 right-0 border-b border-border/60 bg-bg-surface/60"
            style={{ top: laneTop.ruler, height: RULER_H }}>
            {ruler.map((t) => (
              <div key={t} className="absolute top-0 bottom-0 border-l border-border/60" style={{ left: t * pxPerSec }}>
                <span className="absolute left-1 top-0.5 text-[10px] text-text-tertiary tabular-nums">{fmt(t)}</span>
              </div>
            ))}
          </div>

          {/* Waveform */}
          {showWaveform && waveBars && (
            <div className="absolute left-0 right-0" style={{ top: laneTop.wave, height: WAVE_H }}>
              {waveBars.map((b, i) => (
                <div key={i} className="absolute" style={{
                  left: b.x, width: 2, height: b.h, top: (WAVE_H - b.h) / 2,
                  background: b.peak ? '#ef4444' : '#64748b',
                }} />
              ))}
            </div>
          )}

          {/* Filmstrip: placeholder cells + loaded thumbnails on top */}
          <div className="absolute left-0 right-0 overflow-hidden" style={{ top: laneTop.film, height: FILM_H }}>
            {filmCells.map((i) => (
              <div key={`ph${i}`} className="absolute top-0 bottom-0 bg-neutral-700/60 border-r border-black/40"
                style={{ left: i * THUMB_W, width: THUMB_W }} />
            ))}
            {thumbWindow && thumbWindow.uris.length > 0 && pxPerSec > 0 && (() => {
              const M = thumbWindow.uris.length;
              const cellSec = (thumbWindow.end - thumbWindow.start) / M;
              return thumbWindow.uris.map((src, k) => (
                <div key={k} className="absolute top-0 bottom-0" style={{
                  left: (thumbWindow.start + k * cellSec) * pxPerSec,
                  width: Math.max(1, cellSec * pxPerSec),
                  backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center',
                  borderRight: '1px solid rgba(0,0,0,0.35)',
                }} />
              ));
            })()}
          </div>

          {/* Silence overlay (over wave + film) */}
          {showSilence && visibleSilence.map((s, i) => (
            <div key={`sil${i}`} className="absolute bg-slate-500/25 border-x border-slate-300/30 pointer-events-none"
              style={{ top: laneTop.wave, bottom: 0, left: s.start * pxPerSec, width: Math.max(1, (s.end - s.start) * pxPerSec) }} />
          ))}

          {/* Trim region + handles (over film lane) */}
          <div className="absolute bg-accent/15 border-x-2 border-accent pointer-events-none"
            style={{ top: laneTop.film, bottom: 0, left: trim.start * pxPerSec, width: Math.max(1, (trim.end - trim.start) * pxPerSec) }} />
          <div data-handle="start" onMouseDown={beginTrim('start')}
            className="absolute w-2.5 -ml-1.5 bg-accent cursor-ew-resize rounded z-20"
            style={{ top: laneTop.film, bottom: 0, left: trim.start * pxPerSec }} />
          <div data-handle="end" onMouseDown={beginTrim('end')}
            className="absolute w-2.5 -ml-1.5 bg-accent cursor-ew-resize rounded z-20"
            style={{ top: laneTop.film, bottom: 0, left: trim.end * pxPerSec }} />

          {/* Playhead (full height) */}
          <div className="absolute top-0 bottom-0 w-0.5 bg-white z-30 pointer-events-none" style={{ left: currentTime * pxPerSec }}>
            <div className="absolute -top-0 -left-1 w-2.5 h-2.5 bg-white rounded-b" />
          </div>
        </div>
      </div>
    </div>
  );
};
