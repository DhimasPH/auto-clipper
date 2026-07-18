import React, { useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Scissors } from 'lucide-react';
import { API_URL, AppContext } from '../../App';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Button } from '../ui/Button';
import { AdvancedTimeline, SpriteMeta } from './AdvancedTimeline';
import { SilenceBlocksOverlay } from './SilenceBlocksOverlay';
import { MagneticTrimmer } from './MagneticTrimmer';
import { AudioHeatmap } from './AudioHeatmap';
import { PlayReactButton } from './PlayReactButton';
import { buildSnapBoundaries } from '../../lib/snap';

interface Clip { id: string; start: number; end: number; }
interface Meta {
  status: string;
  duration: number | null;
  silence: { start: number; end: number }[] | null;
  peaks: number[] | null;
  sprite: SpriteMeta | null;
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

  const [objectUrl] = useState(() => URL.createObjectURL(file));
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta>({ status: 'PENDING', duration: null, silence: null, peaks: null, sprite: null });
  const [mode, setMode] = useState<EditorMode>('precision');
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showSilence, setShowSilence] = useState(true);
  const [clips, setClips] = useState<Clip[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [trim, setTrim] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [submitting, setSubmitting] = useState(false);

  const duration = meta.duration || videoDuration || 0;

  // Upload the source, then kick off async metadata extraction + poll.
  useEffect(() => {
    let cancelled = false;
    let interval: any;
    (async () => {
      try {
        const fd = new FormData();
        fd.append('file', file);
        const up = await axios.post(`${API_URL}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        if (up.data.status !== 'success') throw new Error('upload failed');
        if (cancelled) return;
        const url = up.data.url as string;
        setLocalUrl(url);

        const job = await axios.post(`${API_URL}/api/extract-metadata`, { path: url, type: ['silence', 'peaks', 'thumbnails'] });
        const jobId = job.data.job_id;
        interval = setInterval(async () => {
          try {
            const r = await axios.get(`${API_URL}/api/metadata/${jobId}`);
            const d = r.data;
            if (d.status === 'DONE') {
              clearInterval(interval);
              if (!cancelled) setMeta({ status: 'DONE', duration: d.duration, silence: d.silence, peaks: d.peaks, sprite: d.sprite, errors: d.errors });
            } else if (d.status === 'ERROR') {
              clearInterval(interval);
              if (!cancelled) setMeta((m) => ({ ...m, status: 'ERROR' }));
            }
          } catch { /* keep polling */ }
        }, 1500);
      } catch (e) {
        if (!cancelled) setMeta((m) => ({ ...m, status: 'ERROR' }));
      }
    })();
    return () => { cancelled = true; if (interval) clearInterval(interval); URL.revokeObjectURL(objectUrl); };
  }, [file]);

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

  const submit = async () => {
    if (!localUrl || clips.length === 0) return;
    setSubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/jobs/manual`, {
        url: localUrl,
        clips: clips.map((c) => ({ start: c.start, end: c.end })),
        aspect_ratio: ctx.aspectRatio,
        caption_style: ctx.captionStyle,
        burn_subs: ctx.burnSubtitles,
        output_dir: ctx.outputFolder,
        quality: ctx.quality,
        title: ctx.title,
      });
      if (res.data.status === 'error') throw new Error(res.data.message);
      const jobId = res.data.job_id;
      ctx.notify?.(t('smartEditor.submitted', '🚀 Memproses klip manual...'), 'success');

      const poll = setInterval(async () => {
        try {
          const r = await axios.get(`${API_URL}/jobs/${jobId}`);
          if (r.data.status === 'DONE') {
            clearInterval(poll);
            setSubmitting(false);
            ctx.notify?.(t('smartEditor.done', '🎉 Klip manual selesai!'), 'success');
          } else if (r.data.status === 'ERROR') {
            clearInterval(poll);
            setSubmitting(false);
            ctx.notify?.(`⚠️ ${r.data.error || 'error'}`, 'error');
          }
        } catch { /* keep polling */ }
      }, 1500);
    } catch (e: any) {
      setSubmitting(false);
      ctx.notify?.(`⚠️ ${e.response?.data?.message || e.message || 'error'}`, 'error');
    }
  };

  return (
    <div className="space-y-5">
      <video
        ref={videoRef}
        src={objectUrl}
        controls
        onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
        onLoadedMetadata={(e) => setVideoDuration((e.target as HTMLVideoElement).duration || 0)}
        className="w-full max-h-[45vh] rounded-card bg-black"
      />

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
            <span className="ml-auto">{t('smartEditor.magneticSnap', 'Snap Magnetik')}: {fmt(trim.start)} – {fmt(trim.end)}</span>
          </div>

          {showHeatmap && !peaksFailed && <AudioHeatmap peaks={meta.peaks} />}

          <AdvancedTimeline
            sprite={meta.sprite}
            duration={duration}
            currentTime={currentTime}
            onSeek={seek}
            loading={meta.status !== 'DONE'}
            loadingLabel={t('smartEditor.analyzing', 'Menganalisis video…')}
          >
            {showSilence && !silenceFailed && <SilenceBlocksOverlay silence={meta.silence} duration={duration} />}
            <MagneticTrimmer
              start={trim.start}
              end={trim.end}
              duration={duration}
              boundaries={boundaries}
              onChange={(s, e) => setTrim({ start: s, end: e })}
            />
          </AdvancedTimeline>

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

      <Button variant="primary" icon={submitting ? undefined : Scissors} loading={submitting} disabled={clips.length === 0 || submitting} onClick={submit} fullWidth>
        {submitting ? t('smartEditor.processing', 'Memproses…') : t('smartEditor.generate', 'Buat Klip')}
      </Button>
    </div>
  );
};
