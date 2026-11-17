import React from 'react';
import { useTranslation } from 'react-i18next';
import { Cookie } from 'lucide-react';
import { CookiesPanel } from '../CookiesPanel';

export const CookiesSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div id="cookies" className="bg-bg-secondary rounded-card border border-border p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-accent/10 rounded-lg text-accent">
          <Cookie className="w-5 h-5" />
        </div>
        <h2 className="text-section-title text-text-primary">{t('cookies.title', 'Cookies YouTube')}</h2>
      </div>
      <CookiesPanel />
    </div>
  );
};
