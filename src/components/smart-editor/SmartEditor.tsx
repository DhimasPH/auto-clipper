import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Scissors } from 'lucide-react';
import { API_URL, AppContext } from '../../App';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Button } from '../ui/Button';
import { ZoomableTimeline } from './ZoomableTimeline';
import { PlayReactButton } from './PlayReactButton';
import { buildSnapBoundaries } from '../../lib/snap';

interface Clip { id: string; start: number; end: number; }
interface Meta {
  status: string;
  duration: number | null;
  silence: { start: number; end: number }[] | null;
  peaks: number[] | null;
  errors?: Record<string, string>;
}

type EditorMode = 'precision' | 'play-react';

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, '0');
  return `${m}:${sec}`;
};

export const SmartEditor: React.FC<{ file: File }> = ({ file }) => {
  const { t } = useTranslation();
  const ctx = useContext(AppContext);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [objectUrl, setObjectUrl] = useState<string>('');
  // Persisted across route changes via AppContext (see SmartEditorPage).
  const localUrl: string | null = ctx.manualLocalUrl;
  const setLocalUrl = ctx.setManualLocalUrl as (v: string | null) => void;
  const meta: Meta = ctx.manualMeta ?? { status: 'PENDING', duration: null, silence: null, peaks: null };
  const setMeta = ctx.setManualMeta as (v: Meta | ((m: Meta) => Meta)) => void;
  const clips: Clip[] = ctx.manualClips ?? [];
  const setClips = ctx.setManualClips as (v: Clip[] | ((c: Clip[]) => Clip[])) => void;
  const [mode, setMode] = useState<EditorMode>('precision');
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showSilence, setShowSilence] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trim, setTrim] = useState<{ start: number; end: number }>({ start: 0, end: 0 });

  const duration = meta.duration || videoDuration || 0;

  // Own the object URL lifecycle separately from the upload/metadata effect so
  // React StrictMode's double-invoke can't revoke the URL the <video> is using.
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setObjectUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  // Upload the source, then kick off async metadata extraction + poll.
  // Skips entirely if we already have a session for this file (persisted in
  // context), so returning to the page doesn't re-upload or re-analyse.
  useEffect(() => {
    if (localUrl) return;
    let cancelled = false;
    let interval: any;
    const fail = () => setMeta({ status: 'ERROR', duration: null, silence: null, peaks: null });
    (async () => {
      try {
        const fd = new FormData();
        fd.append('file', file);
        const up = await axios.post(`${API_URL}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (up.data.status !== 'success') throw new Error('upload failed');
        if (cancelled) return;
        const url = up.data.url as string;
        setLocalUrl(url);

        const job = await axios.post(`${API_URL}/api/extract-metadata`, { path: url, type: ['silence', 'peaks'] });
        const jobId = job.data.job_id;
        interval = setInterval(async () => {
          try {
            const r = await axios.get(`${API_URL}/api/metadata/${jobId}`);
            const d = r.data;
            if (d.status === 'DONE') {
              clearInterval(interval);
              if (!cancelled) setMeta({ status: 'DONE', duration: d.duration, silence: d.silence, peaks: d.peaks, errors: d.errors });
            } else if (d.status === 'ERROR') {
              clearInterval(interval);
              if (!cancelled) fail();
            }
          } catch { /* keep polling */ }
        }, 1500);
      } catch (e) {
        if (!cancelled) fail();
      }
    })();
    return () => { cancelled = true; if (interval) clearInterval(interval); };
  }, [file, localUrl]);

  const silenceFailed = meta.status === 'DONE' && (!!meta.errors?.silence || meta.silence == null);
  const peaksFailed = meta.status === 'DONE' && (!!meta.errors?.peaks || meta.peaks == null);

  const boundaries = React.useMemo(
    () => buildSnapBoundaries(showSilence ? meta.silence : null, meta.peaks, duration),
    [meta.silence, meta.peaks, duration, showSilence],
  );

  const seek = (s: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = s;
  };

  const fetchThumbnails = useCallback(async (start: number, end: number, count: number): Promise<string[]> => {
    if (!localUrl) return [];
    const r = await axios.get(`${API_URL}/api/thumbnails`, { params: { path: localUrl, start, end, count } });
    return r.data?.thumbnails || [];
  }, [localUrl]);

  const addClip = (start: number, end: number) => {
    setClips((c) => [...c, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, start, end }]);
  };

  const addPrecisionClip = () => {
    if (trim.end > trim.start + 0.1) addClip(trim.start, trim.end);
  };

  const removeClip = (id: string) => setClips((c) => c.filter((x) => x.id !== id));

  // Seed a default trim window once duration is known.
  useEffect(() => {
    if (duration > 0 && trim.end === 0) setTrim({ start: 0, end: Math.min(15, duration) });
  }, [duration]);

  // Route through the shared job pipeline so the manual job reuses the same
  // global progress overlay (BusyOverlay) and Cancel button as auto-generate.
  const submit = () => {
    if (!localUrl || clips.length === 0) return;
    ctx.handleManualGenerate?.(localUrl, clips.map((c) => ({ start: c.start, end: c.end })));
  };

  return (
    <div className="space-y-5">
      <div className="max-w-2xl mx-auto w-full">
        <video
          ref={videoRef}
          src={objectUrl}
          controls
          onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
          onLoadedMetadata={(e) => setVideoDuration((e.target as HTMLVideoElement).duration || 0)}
          className="w-full max-h-[45vh] rounded-card bg-black"
        />
      </div>

      <SegmentedControl
        options={[
          { label: t('smartEditor.modePrecision', 'Mode Presisi'), value: 'precision' },
          { label: t('smartEditor.modePlayReact', 'Mode Play & React'), value: 'play-react' },
        ]}
        value={mode}
        onChange={(v) => setMode(v as EditorMode)}
      />

      {mode === 'precision' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4 text-caption text-text-secondary">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showHeatmap} disabled={peaksFailed} onChange={(e) => setShowHeatmap(e.target.checked)} />
              {t('smartEditor.toggleHeatmap', 'Tampilkan Heatmap Audio')}
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={showSilence} disabled={silenceFailed} onChange={(e) => setShowSilence(e.target.checked)} />
              {t('smartEditor.toggleSilence', 'Tampilkan Jeda')}
            </label>
          </div>

          <ZoomableTimeline
            duration={duration}
            currentTime={currentTime}
            onSeek={seek}
            peaks={meta.peaks}
            silence={meta.silence}
            showSilence={showSilence && !silenceFailed}
            showWaveform={showHeatmap && !peaksFailed}
            trim={trim}
            onTrimChange={(s, e) => setTrim({ start: s, end: e })}
            boundaries={boundaries}
            fetchThumbnails={fetchThumbnails}
            loading={meta.status !== 'DONE'}
            loadingLabel={t('smartEditor.analyzing', 'Menganalisis video…')}
          />

          <Button variant="outline" icon={Plus} onClick={addPrecisionClip} disabled={duration <= 0}>
            {t('smartEditor.addClip', 'Tambah Klip')}
          </Button>
        </div>
      ) : (
        <PlayReactButton videoRef={videoRef} onAddClip={addClip} />
      )}

      {/* Clip list */}
      <div className="space-y-2">
        <h3 className="text-label text-text-primary">{t('smartEditor.clips', 'Daftar Klip')} ({clips.length})</h3>
        {clips.length === 0 && <p className="text-caption text-text-tertiary">{t('smartEditor.noClips', 'Belum ada klip.')}</p>}
        {clips.map((c, i) => (
          <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg bg-bg-surface border border-border text-body">
            <span className="text-text-secondary">#{i + 1}</span>
            <span className="text-text-primary">{fmt(c.start)} → {fmt(c.end)}</span>
            <button className="ml-auto text-error hover:opacity-80 p-1" onClick={() => removeClip(c.id)}>
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <Button variant="primary" icon={ctx.isRunning ? undefined : Scissors} loading={ctx.isRunning} disabled={clips.length === 0 || ctx.isRunning || !localUrl} onClick={submit} fullWidth>
        {ctx.isRunning ? t('smartEditor.processing', 'Memproses…') : t('smartEditor.generate', 'Buat Klip')}
      </Button>
    </div>
  );
};
