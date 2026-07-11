import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, Eye, EyeOff, Lock } from 'lucide-react';
import { Select } from '../ui/Select';
import { InputGroup } from '../ui/InputGroup';
import { PROVIDERS, ProviderId } from '../../lib/providers';

interface ProviderSectionProps {
  provider: ProviderId;
  setProvider: (p: ProviderId) => void;
  apiKeys: Record<string, string>;
  setApiKey: (id: string, value: string) => void;
}

export const ProviderSection: React.FC<ProviderSectionProps> = ({
  provider, setProvider, apiKeys, setApiKey,
}) => {
  const { t } = useTranslation();
  const [showKey, setShowKey] = useState(false);
  const current = PROVIDERS.find((p) => p.id === provider);
  const keyVal = apiKeys[provider] || '';

  return (
    <div className="bg-bg-secondary rounded-card border border-border p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-accent/10 rounded-lg text-accent">
          <Brain className="w-5 h-5" />
        </div>
        <h2 className="text-section-title text-text-primary">AI Provider</h2>
      </div>

      <div className="space-y-6">
        <Select
          label={t('settings.provider_label', 'AI Provider')}
          options={PROVIDERS.map((p) => ({ label: p.label, value: p.id }))}
          value={provider}
          onChange={(e) => setProvider(e.target.value as ProviderId)}
        />

        <div className="relative">
          <InputGroup
            label={`${current?.label || 'Provider'} API Key`}
            type={showKey ? 'text' : 'password'}
            value={keyVal}
            onChange={(e) => setApiKey(provider, e.target.value)}
            placeholder="..."
            icon={Lock}
            helperText={t('settings.api_key_note', 'Encrypted and stored securely on your device')}
          />
          <button
            className="absolute right-3 top-[34px] text-text-secondary hover:text-text-primary p-1"
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>

          {!keyVal && (
            <p className="text-caption text-warning mt-1">API key required for AI mode</p>
          )}
        </div>
      </div>
    </div>
  );
};
