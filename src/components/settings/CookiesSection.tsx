import React from 'react';
import { useTranslation } from 'react-i18next';
import { CookiesPanel } from '../CookiesPanel';

/** Pengaturan, YouTube: the cookies.txt upload (SP0). */
export const CookiesSection: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div id="cookies" className="flex flex-col gap-4 rounded-card border border-border bg-bg-secondary p-5">
      <h3 className="text-card-title text-text-primary">{t('cookies.title')}</h3>
      <CookiesPanel />
    </div>
  );
};
