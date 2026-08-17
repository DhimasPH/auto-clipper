import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DownloadCloud, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useToasts } from '../../hooks/useToasts';
import UpdateOverlay from './UpdateOverlay';

export const UpdaterSection: React.FC = () => {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const { toasts, notify } = useToasts();
  
  const checkForUpdates = async () => {
    try {
      setChecking(true);
      const update = await check();
      if (update) {
        setUpdateAvailable(update);
      } else {
        notify(t('updater.up_to_date', 'Anda menggunakan versi terbaru.'), 'success');
      }
    } catch (err: any) {
      const errMsg = err?.toString() || '';
      // @ts-ignore - Check if running inside Tauri context
      if (errMsg.includes('missing Tauri-Invoke-Key') || errMsg.includes('not supported in browser') || !window.__TAURI_INTERNALS__) {
        notify(t('updater.browser_dev_warning', 'Fitur pembaruan tidak dapat digunakan jika dijalankan di browser web (mode dev). Silakan jalankan via Tauri.'), 'error');
      } else {
        notify(t('updater.check_failed', 'Gagal memeriksa pembaruan: ') + errMsg, 'error');
      }
    } finally {
      setChecking(false);
    }
  };
  
  const installUpdate = async () => {
    if (!updateAvailable) return;
    try {
      setDownloading(true);
      setProgressPct(0);
      
      let downloadedBytes = 0;
      let totalBytes = 0;
      
      await updateAvailable.downloadAndInstall((event: any) => {
        if (event.event === 'Started') {
          totalBytes = event.data?.contentLength || 0;
        } else if (event.event === 'Progress') {
          downloadedBytes += event.data?.chunkLength || 0;
          if (totalBytes > 0) {
            setProgressPct((downloadedBytes / totalBytes) * 100);
          }
        }
      });
      
      notify(t('updater.install_success', 'Pembaruan berhasil dipasang. Memulai ulang...'), 'success');
      setTimeout(async () => {
        await relaunch();
      }, 1500);
    } catch (err: any) {
      notify(t('updater.install_failed', 'Gagal memasang pembaruan: ') + err, 'error');
    } finally {
      setDownloading(false);
      setUpdateAvailable(null);
    }
  };

  return (
    <div className="bg-bg-secondary rounded-card border border-border p-6 shadow-sm relative">
      {toasts.length > 0 && (
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-50">
          {toasts.map(toast => (
            <div key={toast.id} className={`px-4 py-2 rounded shadow text-sm ${toast.kind === 'error' ? 'bg-error text-white' : 'bg-success text-white'}`}>
              {toast.text}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-accent/10 rounded-lg text-accent">
          <DownloadCloud className="w-5 h-5" />
        </div>
        <h2 className="text-section-title text-text-primary">{t('updater.title', 'Pembaruan Aplikasi')}</h2>
      </div>

      <div className="space-y-4">
        <p className="text-text-secondary text-sm">
          {t('updater.description', 'Periksa apakah ada versi terbaru Auto Clipper.')}
        </p>
        
        <Button 
          onClick={checkForUpdates} 
          disabled={checking || downloading}
          variant="outline"
          icon={RefreshCw}
        >
          {checking ? t('updater.checking', 'Memeriksa...') : t('updater.check_button', 'Periksa Pembaruan')}
        </Button>
      </div>

      <ConfirmDialog
        isOpen={!!updateAvailable && !downloading}
        title={t('updater.available_title', 'Pembaruan Tersedia')}
        description={
          <div className="whitespace-pre-wrap">
            {t('updater.available_message', 'Versi {{version}} tersedia. Apakah Anda ingin mengunduh dan memasangnya sekarang?', { version: updateAvailable?.version }) 
            + (updateAvailable?.body ? '\n\n' + updateAvailable.body : '')}
          </div>
        }
        onConfirm={installUpdate}
        onClose={() => setUpdateAvailable(null)}
        confirmLabel={t('updater.install_now', 'Pasang Sekarang')}
        cancelLabel={t('common.cancel', 'Batal')}
      />

      <UpdateOverlay isOpen={downloading} progressPct={progressPct} />
    </div>
  );
};
