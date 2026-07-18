import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, Eye, EyeOff, Lock, Settings2, Server, Box } from 'lucide-react';
import { Select } from '../ui/Select';
import { InputGroup } from '../ui/InputGroup';
import { Button } from '../ui/Button';
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
  const [showPexels, setShowPexels] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const current = PROVIDERS.find((p) => p.id === provider);
  const keyVal = apiKeys[provider] || '';
  const isCustom = provider === 'custom';

  const customBaseUrl = apiKeys['custom_base_url'] || '';
  const customModelName = apiKeys['custom_model_name'] || '';

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

        {isCustom ? (
          <div>
            <Button variant="outline" icon={Settings2} onClick={() => setShowCustomModal(true)}>
              {t('settings.custom_config_btn', '⚙️ Atur Konfigurasi Custom')}
            </Button>
            {customBaseUrl && customModelName ? (
              <p className="text-caption text-text-secondary mt-2">
                {customModelName} @ {customBaseUrl}
              </p>
            ) : (
              <p className="text-caption text-warning mt-2">
                {t('settings.custom_config_req', 'Base URL dan Model Name wajib diisi untuk provider custom')}
              </p>
            )}
          </div>
        ) : (
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
              <p className="text-caption text-warning mt-1">{t('settings.api_key_req', 'API key required for AI mode')}</p>
            )}
          </div>
        )}

        <div className="relative pt-4 border-t border-border">
          <InputGroup
            label={t('settings.pexels_api_key', 'Pexels API Key (Optional)')}
            type={showPexels ? 'text' : 'password'}
            value={apiKeys["pexels"] || ''}
            onChange={(e) => setApiKey("pexels", e.target.value)}
            placeholder="..."
            icon={Lock}
            helperText={t('settings.pexels_api_key_note', 'Required for Dynamic B-Roll feature')}
          />
          <button
            className="absolute right-3 top-[67px] text-text-secondary hover:text-text-primary p-1"
            onClick={() => setShowPexels(!showPexels)}
          >
            {showPexels ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {showCustomModal && (
        <CustomConfigModal
          apiKeys={apiKeys}
          setApiKey={setApiKey}
          onClose={() => setShowCustomModal(false)}
        />
      )}
    </div>
  );
};

interface CustomConfigModalProps {
  apiKeys: Record<string, string>;
  setApiKey: (id: string, value: string) => void;
  onClose: () => void;
}

const CustomConfigModal: React.FC<CustomConfigModalProps> = ({ apiKeys, setApiKey, onClose }) => {
  const { t } = useTranslation();
  const [baseUrl, setBaseUrl] = useState(apiKeys['custom_base_url'] || '');
  const [modelName, setModelName] = useState(apiKeys['custom_model_name'] || '');
  const [key, setKey] = useState(apiKeys['custom'] || '');
  const [showKey, setShowKey] = useState(false);

  const handleSave = () => {
    setApiKey('custom_base_url', baseUrl.trim());
    setApiKey('custom_model_name', modelName.trim());
    setApiKey('custom', key.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-bg-secondary rounded-card border border-border shadow-lg p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent/10 rounded-lg text-accent">
            <Settings2 className="w-5 h-5" />
          </div>
          <h3 className="text-section-title text-text-primary">
            {t('settings.custom_modal_title', 'Konfigurasi Custom Provider')}
          </h3>
        </div>

        <InputGroup
          label={t('settings.custom_base_url', 'Base URL')}
          type="text"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="http://localhost:11434/v1"
          icon={Server}
        />

        <InputGroup
          label={t('settings.custom_model_name', 'Model Name')}
          type="text"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder="llama3"
          icon={Box}
        />

        <div className="relative">
          <InputGroup
            label={t('settings.custom_api_key', 'API Key')}
            type={showKey ? 'text' : 'password'}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={t('settings.custom_api_key_ph', 'Kosongkan jika menggunakan Ollama/Lokal')}
            icon={Lock}
          />
          <button
            className="absolute right-3 top-[34px] text-text-secondary hover:text-text-primary p-1"
            onClick={() => setShowKey(!showKey)}
            type="button"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel', 'Batal')}
          </Button>
          <Button variant="primary" onClick={handleSave}>
            {t('common.save', 'Simpan')}
          </Button>
        </div>
      </div>
    </div>
  );
};
