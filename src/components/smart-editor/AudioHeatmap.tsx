import React, { useEffect, useRef } from 'react';

interface AudioHeatmapProps {
  peaks: number[] | null;
  peakThreshold?: number; // fraction of max above which bars turn red
  height?: number;
}

/**
 * Lightweight waveform rendered from server-precomputed peaks onto a canvas.
 * Avoids decoding hour-long audio in the browser; loud peaks are drawn red.
 */
export const AudioHeatmap: React.FC<AudioHeatmapProps> = ({ peaks, peakThreshold = 0.6, height = 56 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks || peaks.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Percentile-based scaling: colour and height are relative to the track's
    // own distribution, not just its single loudest sample. This stops a calm
    // but steady clip from rendering entirely red/tall (the old max-normalised
    // approach did exactly that).
    const sorted = [...peaks].sort((a, b) => a - b);
    const pct = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
    const loudThreshold = pct(0.9);   // top ~10% counts as a "peak"
    const heightRef = pct(0.97) || Math.max(...peaks) || 1;
    const dynamicRange = pct(0.95) - pct(0.5);

    const barW = w / peaks.length;
    const mid = h / 2;
    for (let i = 0; i < peaks.length; i++) {
      const norm = Math.min(1, peaks[i] / heightRef);
      const barH = Math.max(1, norm * (h - 2));
      // Only flag genuine peaks, and only when the track actually has dynamics.
      const isPeak = dynamicRange > 0.02 && peaks[i] >= loudThreshold && peaks[i] >= peakThreshold * heightRef;
      ctx.fillStyle = isPeak ? '#ef4444' : '#64748b';
      ctx.fillRect(i * barW, mid - barH / 2, Math.max(1, barW - 0.5), barH);
    }
  }, [peaks, peakThreshold, height]);

  if (!peaks || peaks.length === 0) return null;

  return <canvas ref={canvasRef} className="w-full block" style={{ height }} />;
};
