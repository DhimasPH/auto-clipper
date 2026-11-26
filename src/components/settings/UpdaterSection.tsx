import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { platform } from '../../platform';
import type { UpdateHandle } from '../../platform';
import { TechnicalDetails } from '../ui/TechnicalDetails';
import UpdateOverlay from './UpdateOverlay';

type Notice =
  | { kind: 'up_to_date' | 'installed' }
  | { kind: 'check_failed' | 'install_failed'; technical: string };

/** Pengaturan, Bantuan (desktop only): check for and install a newer version. */
export const UpdaterSection: React.FC = () => {
  const { t } = useTranslation();
  const [checking, setChecking] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState<UpdateHandle | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const updater = platform().updater;

  const checkForUpdates = async () => {
    if (!updater) return;
    setNotice(null);
    try {
      setChecking(true);
      const update = await updater.check();
      if (update) setUpdateAvailable(update);
      else setNotice({ kind: 'up_to_date' });
    } catch (err) {
      setNotice({ kind: 'check_failed', technical: String(err ?? '') });
    } finally {
      setChecking(false);
    }
  };

  const installUpdate = async () => {
    if (!updateAvailable || !updater) return;
    setNotice(null);
    try {
      setDownloading(true);
      setProgressPct(0);
      let downloadedBytes = 0;
      let totalBytes = 0;
      await updateAvailable.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          totalBytes = event.data?.contentLength || 0;
        } else if (event.event === 'Progress') {
          downloadedBytes += event.data?.chunkLength || 0;
          if (totalBytes > 0) setProgressPct((downloadedBytes / totalBytes) * 100);
        }
      });
      setNotice({ kind: 'installed' });
      setTimeout(() => void updater.relaunch(), 1500);
    } catch (err) {
      setNotice({ kind: 'install_failed', technical: String(err ?? '') });
    } finally {
      setDownloading(false);
      setUpdateAvailable(null);
    }
  };

  const failed = notice && (notice.kind === 'check_failed' || notice.kind === 'install_failed') ? notice : null;

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-bg-secondary p-5">
      <div>
        <h3 className="text-card-title text-text-primary">{t('updater.title')}</h3>
        <p className="mt-1 text-body text-text-secondary">{t('updater.description')}</p>
      </div>

      <div>
        <Button onClick={() => void checkForUpdates()} disabled={checking || downloading} loading={checking} variant="outline" icon={RefreshCw}>
          {checking ? t('updater.checking') : t('updater.check_button')}
        </Button>
      </div>

      {notice?.kind === 'up_to_date' && <p role="status" className="text-body text-success">{t('updater.up_to_date')}</p>}
      {notice?.kind === 'installed' && <p role="status" className="text-body text-success">{t('updater.install_success')}</p>}
      {failed && (
        <div role="alert" className="flex flex-col gap-1">
          <p className="text-body text-error">{t(failed.kind === 'check_failed' ? 'updater.check_failed' : 'updater.install_failed')}</p>
          <TechnicalDetails text={failed.technical} />
        </div>
      )}

      <ConfirmDialog
        isOpen={!!updateAvailable && !downloading}
        title={t('updater.available_title')}
        message={
          t('updater.available_message', { version: updateAvailable?.version }) +
          (updateAvailable?.body ? '\n\n' + updateAvailable.body : '')
        }
        onConfirm={() => void installUpdate()}
        onCancel={() => setUpdateAvailable(null)}
        confirmLabel={t('updater.install_now')}
        cancelLabel={t('updater.later')}
      />

      <UpdateOverlay isOpen={downloading} progressPct={progressPct} />
    </div>
  );
};
