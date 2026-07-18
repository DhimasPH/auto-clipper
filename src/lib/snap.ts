// Magnetic snapping for the Smart Manual Clipper trimmer.
// Pure functions so they can be unit-tested in isolation.

/**
 * Snap `value` to the nearest boundary within `threshold` seconds.
 * Returns the boundary if one is close enough, otherwise the original value.
 */
export function snapValue(value: number, boundaries: number[], threshold = 0.5): number {
  let best = value;
  let bestDist = threshold;
  for (const b of boundaries) {
    const d = Math.abs(b - value);
    if (d <= bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return best;
}

/**
 * Collect candidate snap points from silence-block edges and audio peaks.
 * `peaks` is a normalised amplitude array spread evenly across `duration`;
 * only prominent peaks (local maxima above `peakThreshold`) are used.
 */
export function buildSnapBoundaries(
  silence: { start: number; end: number }[] | null,
  peaks: number[] | null,
  duration: number,
  peakThreshold = 0.6,
): number[] {
  const boundaries: number[] = [];
  if (silence) {
    for (const s of silence) {
      boundaries.push(s.start, s.end);
    }
  }
  if (peaks && peaks.length > 1 && duration > 0) {
    const step = duration / peaks.length;
    for (let i = 1; i < peaks.length - 1; i++) {
      if (peaks[i] >= peakThreshold && peaks[i] >= peaks[i - 1] && peaks[i] >= peaks[i + 1]) {
        boundaries.push(i * step);
      }
    }
  }
  return boundaries;
}
