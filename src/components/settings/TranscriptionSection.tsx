import React, { useEffect, useId, useRef, useState } from 'react';
import { Download, RefreshCw, TriangleAlert } from 'lucide-react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../../platform/backendUrl';
import { requestError } from '../../lib/errorInfo';
import { TechnicalDetails } from '../ui/TechnicalDetails';
import { Button } from '../ui/Button';
import { useAddons } from '../../hooks/useAddons';
import { addonView, megabytes } from '../../lib/addons';
import { AddonControls } from './AddonControls';
import { useKeepFocus } from '../../hooks/useKeepFocus';

export interface WhisperModelInfo {
  id: string;
  name: string;
  disk_size: string;
  vram: string;
  description_id: string;
  description_en: string;
  downloaded: boolean;
  is_default?: boolean;
}

interface TranscriptionSectionProps {
  whisperModel: string;
  setWhisperModel: (model: string) => void;
  /** From settingsVisibility (caps.addons): graphics card support can be installed here. */
  addonsEnabled: boolean;
}

type DownloadState =
  | { kind: 'idle' }
  | { kind: 'running'; model: string }
  | { kind: 'done'; model: string }
  | { kind: 'failed'; model: string; technical: string };

/** Pengaturan, Lanjutan: which speech-to-text model writes the subtitles, and downloading bigger ones. */
export const TranscriptionSection: React.FC<TranscriptionSectionProps> = ({ whisperModel, setWhisperModel, addonsEnabled }) => {
  const { t, i18n } = useTranslation();
  const groupName = useId();
  const [models, setModels] = useState<WhisperModelInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [download, setDownload] = useState<DownloadState>({ kind: 'idle' });

  // SP3 (spec 4.3): null from a server that does not say whether the graphics card makes the subtitles.
  const [gpuReady, setGpuReady] = useState<boolean | null>(null);
  const [slowModels, setSlowModels] = useState<string[]>([]);

  /** `quiet`: reload behind the list that is already shown. */
  const fetchModels = async (quiet = false) => {
    if (!quiet) setLoading(true);
    setLoadFailed(false);
    try {
      const res = await axios.get(`${API_URL}/api/settings/whisper-models`);
      if (res.data?.status === 'success') {
        setModels(res.data.models);
        setGpuReady(typeof res.data.gpu_ready === 'boolean' ? res.data.gpu_ready : null);
        setSlowModels(Array.isArray(res.data.processor_slow_models) ? res.data.processor_slow_models : []);
      }
    } catch (err) {
      console.error('Failed to fetch whisper models:', err);
      if (!quiet) setLoadFailed(true);
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  // Only a server that reports gpu_ready knows add-ons (Ruling P8: older servers are never asked).
  const { addons, pending, failures, removalScheduled, install, remove } = useAddons(addonsEnabled && gpuReady !== null, 'cuda');
  const cuda = addons.cuda;
  const cudaView = addonView(cuda);
  // Installing or removing the support changes gpu_ready: reload so the processor notes match.
  const cudaInstalled = cuda ? cuda.installed : null;
  const seenInstalled = useRef<boolean | null>(null);
  useEffect(() => {
    if (cudaInstalled === null) return;
    const before = seenInstalled.current;
    seenInstalled.current = cudaInstalled;
    if (before !== null && before !== cudaInstalled) void fetchModels(true);
  }, [cudaInstalled]);
  // After a removal the card hides until the models are read again: keep the focus in this section.
  const sectionRef = useRef<HTMLDivElement>(null);
  useKeepFocus(pending.cuda, () => sectionRef.current);
  const showGpuCard =
    cudaView === 'downloading' || cudaView === 'finishing' || cudaView === 'installed' || (cudaView === 'absent' && gpuReady === false);

  useEffect(() => {
    void fetchModels();
  }, []);

  const handleDownload = async (modelId: string) => {
    setDownload({ kind: 'running', model: modelId });
    try {
      const res = await axios.post(`${API_URL}/api/settings/whisper-models/download`, { model: modelId });
      if (res.data?.status !== 'success') throw new Error(res.data?.message || 'Download failed');
      await fetchModels();
      setWhisperModel(modelId);
      setDownload({ kind: 'done', model: modelId });
    } catch (err) {
      setDownload({ kind: 'failed', model: modelId, technical: requestError(err, '').message });
    }
  };

  const nameOf = (id: string) => models.find((m) => m.id === id)?.name ?? id;
  const busy = download.kind === 'running';

  return (
    <div ref={sectionRef} tabIndex={-1} className="flex flex-col gap-4 rounded-card border border-border bg-bg-secondary p-5 focus:outline-none">
      <div>
        <h3 id={`${groupName}-title`} className="text-card-title text-text-primary">{t('settings.transcription_title')}</h3>
        <p className="mt-1 text-body text-text-secondary">{t('settings.transcription_subtitle')}</p>
      </div>

      {loading ? (
        <p role="status" className="text-body text-text-secondary">{t('settings.whisper_loading')}</p>
      ) : loadFailed ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="text-body text-error">{t('settings.whisper_fetch_error')}</p>
          <Button variant="outline" icon={RefreshCw} onClick={() => void fetchModels()}>
            {t('settings.retry')}
          </Button>
        </div>
      ) : (
        <div role="radiogroup" aria-labelledby={`${groupName}-title`} className="flex flex-col gap-3">
          {models.map((m) => {
            const isSelected = whisperModel === m.id;
            const isDownloading = download.kind === 'running' && download.model === m.id;
            const descId = `${groupName}-${m.id}-desc`;
            const details = (
              <div id={descId} className="flex flex-col gap-1">
                <p className="text-body text-text-secondary">{i18n.language?.startsWith('en') ? m.description_en : m.description_id}</p>
                <p className="text-caption text-text-secondary">
                  {t('settings.whisper_size', { disk: m.disk_size, vram: m.vram })}
                </p>
                {gpuReady === false && slowModels.includes(m.id) && (!addonsEnabled || cudaView !== 'unknown') && (
                  <p className="flex items-start gap-2 text-body text-text-primary">
                    <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                    {/* No graphics card option here (no NVIDIA card, Mac, Linux, cloud): no talk of one. */}
                    <span>{t(showGpuCard ? 'settings.whisper_cpu_note' : 'settings.whisper_cpu_note_no_gpu')}</span>
                  </p>
                )}
              </div>
            );

            if (!m.downloaded) {
              return (
                <div key={m.id} className="flex flex-col gap-3 rounded-input border border-border p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-body font-medium text-text-primary">
                      {m.name} <span className="font-normal text-text-secondary">· {t('settings.whisper_not_downloaded')}</span>
                    </p>
                    {details}
                  </div>
                  <Button
                    variant="outline"
                    icon={Download}
                    loading={isDownloading}
                    disabled={busy}
                    aria-describedby={descId}
                    onClick={() => void handleDownload(m.id)}
                    className="shrink-0"
                  >
                    {isDownloading ? t('settings.whisper_downloading_btn') : t('settings.whisper_download_btn')}
                  </Button>
                </div>
              );
            }

            return (
              <label
                key={m.id}
                className={`flex cursor-pointer items-start gap-3 rounded-input border p-4 ${
                  isSelected ? 'border-accent bg-accent-muted' : 'border-border hover:bg-bg-surface'
                }`}
              >
                <input
                  type="radio"
                  name={groupName}
                  checked={isSelected}
                  onChange={() => setWhisperModel(m.id)}
                  aria-describedby={descId}
                  className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]"
                />
                <span className="min-w-0">
                  <span className="block text-body font-medium text-text-primary">
                    {m.name}
                    {isSelected && <span className="font-normal text-text-secondary"> · {t('settings.whisper_active')}</span>}
                  </span>
                  {details}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {showGpuCard && (
        <div className="flex flex-col gap-3 rounded-input border border-border p-4">
          <p className="text-body font-medium text-text-primary">{t('settings.addon_gpu_title')}</p>
          {cudaView === 'absent' && <p className="text-body text-text-secondary">{t('settings.addon_gpu_desc')}</p>}
          <AddonControls
            status={cuda}
            name={t('settings.addon_gpu_title')}
            offerInstall={gpuReady === false}
            pending={pending.cuda}
            failure={failures.cuda}
            removalScheduled={removalScheduled.cuda}
            // About 528 MB to download again: ask first (the small Teliti add-on goes right away).
            confirmRemove={{
              title: t('settings.addon_gpu_remove_confirm_title'),
              message: t('settings.addon_gpu_remove_confirm_body', { mb: megabytes(cuda?.size_hint_mb ?? 0) }),
              confirmLabel: t('settings.addon_gpu_remove_confirm'),
            }}
            installLabel={t('settings.addon_gpu_install')}
            removeLabel={t('settings.addon_gpu_remove')}
            readyKey="settings.addon_gpu_ready"
            onInstall={() => void install('cuda')}
            onRemove={() => void remove('cuda')}
          />
        </div>
      )}

      {download.kind === 'running' && (
        <p role="status" className="text-body text-text-secondary">{t('settings.whisper_downloading', { name: nameOf(download.model) })}</p>
      )}
      {download.kind === 'done' && (
        <p role="status" className="text-body text-success">{t('settings.whisper_download_success', { name: nameOf(download.model) })}</p>
      )}
      {download.kind === 'failed' && (
        <div role="alert" className="flex flex-col gap-1">
          <p className="text-body text-error">{t('settings.whisper_download_error', { name: nameOf(download.model) })}</p>
          <TechnicalDetails text={download.technical} />
        </div>
      )}

      {!loading && !loadFailed && (
        <div className="flex flex-col gap-1 border-t border-border pt-4">
          <p className="text-body font-medium text-text-primary">{t('settings.whisper_info_title')}</p>
          <p className="text-body text-text-secondary">{t('settings.whisper_info_desc')}</p>
          <p className="text-body text-text-secondary">{t('settings.whisper_vad_note')}</p>
        </div>
      )}
    </div>
  );
};
