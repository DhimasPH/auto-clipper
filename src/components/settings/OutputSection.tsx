import React from 'react';
import { useTranslation } from 'react-i18next';
import { FolderOpen, X } from 'lucide-react';
import { platform } from '../../platform';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { InputGroup } from '../ui/InputGroup';
import type { Quality } from '../../hooks/useUserSettings';

interface OutputSectionProps {
  outputFolder: string;
  setOutputFolder: (folder: string) => void;
  quality: Quality;
  setQuality: (q: Quality) => void;
}

/** Pengaturan, Lanjutan: where results go (desktop only) and the default download quality. */
export const OutputSection: React.FC<OutputSectionProps> = ({
  outputFolder, setOutputFolder, quality, setQuality,
}) => {
  const { t } = useTranslation();

  const handleSelectFolder = async () => {
    const folder = await platform().pickFolder();
    if (folder) setOutputFolder(folder);
  };

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-bg-secondary p-5">
      <h3 className="text-card-title text-text-primary">{t('settings.output_title')}</h3>

      {platform().caps.localFilePicker && (
        <div className="flex flex-wrap items-end gap-2">
          <InputGroup
            className="min-w-0 flex-1 basis-full sm:basis-auto"
            label={t('settings.folder_label')}
            readOnly
            value={outputFolder || t('settings.folder_default')}
          />
          {/* The folder icon says "opens a folder dialog" next to the text. */}
          <Button variant="outline" type="button" icon={FolderOpen} onClick={() => void handleSelectFolder()}>
            {t('settings.pick_folder')}
          </Button>
          {outputFolder && (
            <Button
              variant="ghost"
              type="button"
              icon={X}
              onClick={() => setOutputFolder('')}
              aria-label={t('settings.folder_reset')}
              title={t('settings.folder_reset')}
            />
          )}
        </div>
      )}

      <Select
        label={t('settings.quality_label')}
        value={quality}
        onChange={(e) => setQuality(e.target.value as Quality)}
        options={[
          { label: t('create.quality_auto'), value: 'best' },
          { label: '2160p (4K)', value: '2160p' },
          { label: '1440p (2K)', value: '1440p' },
          { label: '1080p', value: '1080p' },
          { label: '720p', value: '720p' },
          { label: '480p', value: '480p' },
        ]}
      />
    </div>
  );
};
