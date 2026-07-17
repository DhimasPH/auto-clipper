import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DownloadCloud, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useToasts } from '../../hooks/useToasts';

export const UpdaterSection: React.FC = () => {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);
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
      notify(t('updater.check_failed', 'Gagal memeriksa pembaruan: ') + err, 'error');
    } finally {
      setChecking(false);
    }
  };
  
  const installUpdate = async () => {
    if (!updateAvailable) return;
    try {
      setDownloading(true);
      await updateAvailable.downloadAndInstall();
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
        isOpen={!!updateAvailable}
        title={t('updater.available_title', 'Pembaruan Tersedia')}
        message={
          t('updater.available_message', 'Versi {{version}} tersedia. Apakah Anda ingin mengunduh dan memasangnya sekarang?', { version: updateAvailable?.version }) 
          + (updateAvailable?.body ? '\n\n' + updateAvailable.body : '')
        }
        onConfirm={installUpdate}
        onCancel={() => setUpdateAvailable(null)}
        confirmLabel={downloading ? t('updater.downloading', 'Mengunduh...') : t('updater.install_now', 'Pasang Sekarang')}
        cancelLabel={t('common.cancel', 'Batal')}
      />
    </div>
  );
};
