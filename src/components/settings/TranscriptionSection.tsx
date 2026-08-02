import React, { useState, useEffect } from 'react';
import { Mic, Download, CheckCircle2, AlertCircle, Loader2, HardDrive, Cpu } from 'lucide-react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../../App';
import { Button } from '../ui/Button';
import { ToastKind } from '../../hooks/useToasts';

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
  notify?: (text: string, kind?: ToastKind) => void;
}

export const TranscriptionSection: React.FC<TranscriptionSectionProps> = ({
  whisperModel,
  setWhisperModel,
  notify,
}) => {
  const { t, i18n } = useTranslation();
  const [models, setModels] = useState<WhisperModelInfo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await axios.get(`${API_URL}/api/settings/whisper-models`);
      if (res.data && res.data.status === "success") {
        setModels(res.data.models);
      }
    } catch (err: any) {
      console.error("Failed to fetch whisper models:", err);
      setError(t('settings.whisper_fetch_error', 'Gagal memuat daftar model Whisper. Pastikan backend aktif.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleDownload = async (modelId: string) => {
    try {
      setDownloadingModel(modelId);
      if (notify) {
        notify(t('settings.whisper_downloading', `Memulai unduhan model ${modelId}... Harap tunggu.`), "success");
      }
      const res = await axios.post(`${API_URL}/api/settings/whisper-models/download`, {
        model: modelId,
      });

      if (res.data && res.data.status === "success") {
        if (notify) {
          notify(t('settings.whisper_download_success', `Model ${modelId} berhasil diunduh dan siap digunakan!`), "success");
        }
        await fetchModels();
        setWhisperModel(modelId);
      } else {
        throw new Error(res.data?.message || "Download failed");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || t('settings.whisper_download_error', 'Gagal mengunduh model Whisper. Periksa koneksi internet Anda.');
      if (notify) {
        notify(`⚠️ ${msg}`, "error");
      }
    } finally {
      setDownloadingModel(null);
    }
  };

  return (
    <div className="bg-bg-secondary rounded-card border border-border p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-accent/10 rounded-lg text-accent">
          <Mic className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-section-title text-text-primary">
            {t('settings.transcription_title', 'AI Transcription (Speech-to-Text)')}
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            {t('settings.transcription_subtitle', 'Konfigurasi model faster-whisper lokal & VAD untuk akurasi transkrip subtitle.')}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-text-secondary">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
          <span className="text-sm">{t('settings.whisper_loading', 'Memeriksa ketersediaan model Whisper lokal...')}</span>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-3 text-red-500 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchModels} className="ml-auto">
            {t('settings.retry', 'Coba Lagi')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {models.map((m) => {
              const isSelected = whisperModel === m.id;
              const isDownloading = downloadingModel === m.id;
              const isDownloaded = m.downloaded;

              return (
                <div
                  key={m.id}
                  onClick={() => {
                    if (isDownloaded && !isSelected) {
                      setWhisperModel(m.id);
                    }
                  }}
                  className={`relative p-4 rounded-xl border transition-all duration-200 ${
                    isSelected
                      ? 'border-accent bg-accent/5 ring-1 ring-accent'
                      : isDownloaded
                      ? 'border-border bg-bg-card hover:border-text-secondary/30 cursor-pointer'
                      : 'border-border/60 bg-bg-card/40 opacity-80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text-primary text-sm">
                          {m.name}
                        </span>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-accent text-accent-fg font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            {t('settings.whisper_active', 'Aktif')}
                          </span>
                        )}
                        {isDownloaded && !isSelected && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            {t('settings.whisper_ready', 'Siap')}
                          </span>
                        )}
                        {!isDownloaded && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium">
                            {t('settings.whisper_not_downloaded', 'Belum Diunduh')}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-text-secondary">
                        {i18n.language === 'id' ? m.description_id : m.description_en}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-text-muted pt-1">
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3.5 h-3.5 text-text-secondary" />
                          {m.disk_size}
                        </span>
                        <span className="flex items-center gap-1">
                          <Cpu className="w-3.5 h-3.5 text-text-secondary" />
                          {m.vram}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!isDownloaded ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isDownloading || !!downloadingModel}
                          icon={isDownloading ? Loader2 : Download}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(m.id);
                          }}
                          className={isDownloading ? "animate-pulse" : ""}
                        >
                          {isDownloading
                            ? t('settings.whisper_downloading_btn', 'Mengunduh...')
                            : t('settings.whisper_download_btn', 'Unduh Model')}
                        </Button>
                      ) : (
                        <Button
                          variant={isSelected ? "primary" : "outline"}
                          size="sm"
                          disabled={isSelected}
                          onClick={(e) => {
                            e.stopPropagation();
                            setWhisperModel(m.id);
                          }}
                        >
                          {isSelected
                            ? t('settings.whisper_selected', 'Dipilih')
                            : t('settings.whisper_select', 'Pilih')}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3.5 bg-bg-card rounded-lg border border-border/80 text-xs text-text-secondary space-y-1">
            <div className="font-medium text-text-primary flex items-center gap-1.5">
              <span>💡</span>
              <span>{t('settings.whisper_info_title', 'Tips Akurasi & Performa')}</span>
            </div>
            <p>
              {t(
                'settings.whisper_info_desc',
                'Model Small cepat & cukup akurat untuk sebagian besar video. Jika video memiliki banyak istilah teknis, noise latar belakang, atau aksen khusus, gunakan Medium atau Large-v3 untuk hasil subtitle yang lebih presisi.'
              )}
            </p>
            <p className="text-text-muted">
              {t(
                'settings.whisper_vad_note',
                'Fitur VAD (Voice Activity Detection) selalu aktif otomatis untuk memangkas jeda hening dan meminimalisir teks berulang (halusinasi AI).'
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
