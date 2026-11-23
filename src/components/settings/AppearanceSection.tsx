import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '../ui/SegmentedControl';

type Theme = "dark" | "light" | "system";

interface AppearanceSectionProps {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const THEMES: Theme[] = ["dark", "light", "system"];

/** Pengaturan, Umum (spec 4.5): theme and language. */
export const AppearanceSection: React.FC<AppearanceSectionProps> = ({ theme, setTheme }) => {
  const { t, i18n } = useTranslation();
  const themeLabel = useId();
  const languageLabel = useId();

  return (
    <div className="flex flex-col gap-6 rounded-card border border-border bg-bg-secondary p-5">
      <div className="flex flex-col gap-2">
        <p id={themeLabel} className="text-label text-text-primary">{t('settings.theme')}</p>
        <div role="group" aria-labelledby={themeLabel} className="grid grid-cols-3 gap-2">
          {THEMES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={theme === option}
              onClick={() => setTheme(option)}
              className={`min-h-[44px] rounded-button border px-3 text-body transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary ${
                theme === option
                  ? 'border-accent bg-accent-muted font-medium text-text-primary'
                  : 'border-border-active bg-bg-secondary text-text-primary hover:bg-bg-surface'
              }`}
            >
              {t(`settings.theme_${option}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p id={languageLabel} className="text-label text-text-primary">{t('settings.language')}</p>
        <div role="group" aria-labelledby={languageLabel}>
          <SegmentedControl
            options={[
              { label: t('settings.language_id'), value: 'id' },
              { label: t('settings.language_en'), value: 'en' },
            ]}
            value={i18n.language?.startsWith('en') ? 'en' : 'id'}
            onChange={(val) => void i18n.changeLanguage(val)}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};
