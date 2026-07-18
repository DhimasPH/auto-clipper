import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, RefreshCw } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { AppContext } from '../App';
import { SmartEditor } from '../components/smart-editor/SmartEditor';

export const SmartEditorPage: React.FC = () => {
  const { t } = useTranslation();
  const ctx = useContext(AppContext);
  const file: File | null = ctx.manualFile;

  const pickFile = (f: File | null) => {
    // New video → start fresh (clear any carried-over session).
    ctx.setManualLocalUrl(null);
    ctx.setManualMeta(null);
    ctx.setManualClips([]);
    ctx.setManualFile(f);
  };

  const resetVideo = () => {
    ctx.setManualFile(null);
    ctx.setManualLocalUrl(null);
    ctx.setManualMeta(null);
    ctx.setManualClips([]);
  };

  return (
    <div className="p-8">
      <PageHeader
        title={t('smartEditor.title', 'Smart Manual Clipper')}
        subtitle={t('smartEditor.subtitle', 'Potong klip sendiri — presisi atau reflek, tanpa AI')}
      />

      {!file ? (
        <label className="flex flex-col items-center justify-center gap-3 p-12 rounded-card border-2 border-dashed border-border cursor-pointer hover:border-accent transition-colors text-text-secondary">
          <Upload className="w-8 h-8" />
          <span>{t('smartEditor.pickVideo', 'Pilih video lokal untuk mulai')}</span>
          <input
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] || null)}
          />
        </label>
      ) : (
        <div className="w-full">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-body text-text-secondary truncate">{file.name}</span>
            <button
              onClick={resetVideo}
              className="ml-auto shrink-0 inline-flex items-center gap-2 px-3 py-1.5 rounded-button border border-border text-text-secondary hover:text-text-primary hover:border-border-active transition-colors text-label"
            >
              <RefreshCw className="w-4 h-4" />
              {t('smartEditor.changeVideo', 'Ganti Video')}
            </button>
          </div>
          <SmartEditor file={file} key={file.name + file.size} />
        </div>
      )}
    </div>
  );
};
