import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { SmartEditor } from '../components/smart-editor/SmartEditor';

export const SmartEditorPage: React.FC = () => {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);

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
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
      ) : (
        <div className="w-full">
          <SmartEditor file={file} key={file.name + file.size} />
        </div>
      )}
    </div>
  );
};
