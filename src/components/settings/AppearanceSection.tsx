import React from 'react';
import { useTranslation } from 'react-i18next';
import { Palette } from 'lucide-react';
import { SegmentedControl } from '../ui/SegmentedControl';

interface AppearanceSectionProps {
  theme: "dark" | "light" | "system";
  setTheme: (t: "dark" | "light" | "system") => void;
}

export const AppearanceSection: React.FC<AppearanceSectionProps> = ({ theme, setTheme }) => {
  const { t, i18n } = useTranslation();

  return (
    <div className="bg-bg-secondary rounded-card border border-border p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-accent/10 rounded-lg text-accent">
          <Palette className="w-5 h-5" />
        </div>
        <h2 className="text-section-title text-text-primary">Appearance</h2>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-label text-text-secondary">{t('settings.theme', 'Theme')}</label>
          <div className="grid grid-cols-3 gap-3">
            {(["dark", "light", "system"] as const).map((tOpt) => (
              <button
                key={tOpt}
                onClick={() => setTheme(tOpt)}
                className={`py-2 px-3 rounded-button border text-body transition-colors flex items-center justify-center gap-2 ${
                  theme === tOpt 
                    ? 'border-accent bg-accent/10 text-accent font-medium' 
                    : 'border-border bg-bg-surface text-text-primary hover:border-border-active'
                }`}
              >
                {tOpt === "dark" ? '🌙 Dark' : tOpt === "light" ? '☀️ Light' : '💻 System'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-label text-text-secondary">{t('settings.language', 'Language')}</label>
          <SegmentedControl
            options={[
              { label: '🇮🇩 Indonesia', value: 'id' },
              { label: '🇬🇧 English', value: 'en' }
            ]}
            value={i18n.language}
            onChange={(val) => i18n.changeLanguage(val)}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};
