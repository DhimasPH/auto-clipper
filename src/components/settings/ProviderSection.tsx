import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, Eye, EyeOff, Lock } from 'lucide-react';
import { SegmentedControl } from '../ui/SegmentedControl';
import { InputGroup } from '../ui/InputGroup';

interface ProviderSectionProps {
  provider: "openai" | "gemini";
  setProvider: (p: "openai" | "gemini") => void;
  openaiKey: string;
  setOpenaiKey: (key: string) => void;
  geminiKey: string;
  setGeminiKey: (key: string) => void;
}

export const ProviderSection: React.FC<ProviderSectionProps> = ({
  provider, setProvider, openaiKey, setOpenaiKey, geminiKey, setGeminiKey
}) => {
  const { t } = useTranslation();
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="bg-bg-secondary rounded-card border border-border p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-accent/10 rounded-lg text-accent">
          <Brain className="w-5 h-5" />
        </div>
        <h2 className="text-section-title text-text-primary">AI Provider</h2>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-label text-text-secondary">{t('settings.provider_label', 'AI Provider')}</label>
          <SegmentedControl
            options={[
              { label: 'OpenAI (GPT-4o + Whisper)', value: 'openai' },
              { label: 'Google Gemini (2.5 Flash)', value: 'gemini' }
            ]}
            value={provider}
            onChange={(val) => setProvider(val as any)}
            className="w-full"
          />
        </div>

        <div className="relative">
          <InputGroup
            label={provider === 'openai' ? t('settings.api_key_openai', 'OpenAI API Key') : t('settings.api_key_gemini', 'Gemini API Key')}
            type={showKey ? 'text' : 'password'}
            value={provider === 'openai' ? openaiKey : geminiKey}
            onChange={(e) => provider === 'openai' ? setOpenaiKey(e.target.value) : setGeminiKey(e.target.value)}
            placeholder="..."
            icon={Lock}
            helperText={t('settings.api_key_note', 'Stored locally on your device')}
          />
          <button
            className="absolute right-3 top-[34px] text-text-secondary hover:text-text-primary p-1"
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          
          {(provider === 'openai' ? !openaiKey : !geminiKey) && (
            <p className="text-caption text-warning mt-1">API key required for AI mode</p>
          )}
        </div>
      </div>
    </div>
  );
};
