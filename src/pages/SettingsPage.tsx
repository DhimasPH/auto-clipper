import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AppContext } from '../App';
import { AppearanceSection } from '../components/settings/AppearanceSection';
import { AiModeSection } from '../components/settings/AiModeSection';
import { ProviderSection } from '../components/settings/ProviderSection';
import { PexelsKeySection } from '../components/settings/PexelsKeySection';
import { TranscriptionSection } from '../components/settings/TranscriptionSection';
import { OutputSection } from '../components/settings/OutputSection';
import { CookiesSection } from '../components/settings/CookiesSection';
import { DownloaderPanel } from '../components/settings/DownloaderPanel';
import { HelpSection } from '../components/settings/HelpSection';
import { Select } from '../components/ui/Select';
import { useScrollToHash } from '../hooks/useScrollToHash';
import { SETTINGS_ANCHORS } from '../lib/routes';
import { settingsVisibility } from '../lib/settingsLayout';
import { platform } from '../platform';

const Section: React.FC<{ id: string; title: string; children: React.ReactNode }> = ({ id, title, children }) => (
  // tabIndex -1: useScrollToHash moves focus here; scroll-mt-16 keeps the heading below the sticky header.
  <section id={id} tabIndex={-1} aria-labelledby={`${id}-title`} className="flex scroll-mt-16 flex-col gap-4 focus:outline-none">
    <h2 id={`${id}-title`} className="text-section-title text-text-primary">{title}</h2>
    {children}
  </section>
);

/** Pengaturan (spec 4.5): one page, four sections. */
export const SettingsPage: React.FC = () => {
  useScrollToHash();
  const { t } = useTranslation();
  const ctx = useContext(AppContext);
  const vis = settingsVisibility(platform().caps, ctx.aiMode);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-12">
      <h1 className="text-page-title text-text-primary">{t('settings.title')}</h1>

      <Section id={SETTINGS_ANCHORS.general} title={t('settings.sec_general')}>
        <AppearanceSection theme={ctx.theme} setTheme={ctx.setTheme} />
      </Section>

      <Section id={SETTINGS_ANCHORS.youtube} title={t('settings.sec_youtube')}>
        <CookiesSection />
      </Section>

      <Section id={SETTINGS_ANCHORS.advanced} title={t('settings.sec_advanced')}>
        {vis.showAiMode && <AiModeSection aiMode={ctx.aiMode} setAiMode={ctx.setAiMode} />}
        {vis.showProviderKeys && (
          <ProviderSection
            provider={ctx.provider}
            setProvider={ctx.setProvider}
            selectedModel={ctx.selectedModel}
            setSelectedModel={ctx.setSelectedModel}
            apiKeys={ctx.apiKeys}
            setApiKey={ctx.setApiKey}
          />
        )}
        {vis.showPexelsKey && <PexelsKeySection apiKeys={ctx.apiKeys} setApiKey={ctx.setApiKey} />}
        <div className="rounded-card border border-border bg-bg-secondary p-5">
          <Select
            label={t('settings.face_engine_label')}
            value={ctx.faceTrackingEngine}
            onChange={(e) => ctx.setFaceTrackingEngine(e.target.value)}
            aria-describedby="face-engine-help"
            options={[
              { label: t('settings.face_engine_standard'), value: 'haar' },
              { label: t('settings.face_engine_precise'), value: 'mediapipe' },
            ]}
          />
          <p id="face-engine-help" className="mt-2 text-body text-text-secondary">{t('settings.face_engine_help')}</p>
        </div>
        <OutputSection
          showFolder={vis.showOutputFolder}
          outputFolder={ctx.outputFolder}
          setOutputFolder={ctx.setOutputFolder}
          quality={ctx.quality}
          setQuality={ctx.setQuality}
        />
        <TranscriptionSection whisperModel={ctx.whisperModel} setWhisperModel={ctx.setWhisperModel} notify={ctx.notify} />
        <DownloaderPanel />
      </Section>

      <Section id={SETTINGS_ANCHORS.help} title={t('settings.sec_help')}>
        <HelpSection showUpdater={vis.showUpdater} />
      </Section>
    </div>
  );
};
