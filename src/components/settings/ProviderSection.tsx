import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, RefreshCw, Settings2 } from 'lucide-react';
import { API_URL } from '../../platform/backendUrl';
import { requestError } from '../../lib/errorInfo';
import { Select } from '../ui/Select';
import { InputGroup } from '../ui/InputGroup';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { TechnicalDetails } from '../ui/TechnicalDetails';
import { PROVIDERS, ProviderId } from '../../lib/providers';

interface ProviderSectionProps {
  provider: ProviderId;
  setProvider: (p: ProviderId) => void;
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  apiKeys: Record<string, string>;
  setApiKey: (id: string, value: string) => void;
}

type TestState =
  | { kind: 'idle' | 'loading' | 'success' | 'empty' }
  | { kind: 'failed'; technical: string };

/** Pengaturan, Lanjutan (only with "Pakai API key"): AI provider, its key, the model, a connection test. */
export const ProviderSection: React.FC<ProviderSectionProps> = ({
  provider, setProvider, selectedModel, setSelectedModel, apiKeys, setApiKey,
}) => {
  const { t } = useTranslation();
  const [showKey, setShowKey] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [test, setTest] = useState<TestState>({ kind: 'idle' });
  const current = PROVIDERS.find((p) => p.id === provider);
  const keyVal = apiKeys[provider] || '';
  const isCustom = provider === 'custom';
  const customBaseUrl = apiKeys['custom_base_url'] || '';
  const customModelName = apiKeys['custom_model_name'] || '';

  const [availableModels, setAvailableModels] = useState<{ id: string; label: string }[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  const fallbackModels = () => current?.fallbackModels?.map((m) => ({ id: m, label: m })) || [];
  const applyModels = (list: { id: string; label: string }[]) => {
    setAvailableModels(list);
    if (!selectedModel || !list.find((m) => m.id === selectedModel)) {
      setSelectedModel(list[0]?.id || current?.defaultModel || '');
    }
  };

  useEffect(() => {
    setTest({ kind: 'idle' });
    const fallbacks = fallbackModels();
    setAvailableModels(fallbacks);
    if (!selectedModel || (fallbacks.length > 0 && !fallbacks.find((m) => m.id === selectedModel))) {
      setSelectedModel(current?.defaultModel || '');
    }
    // Only a provider change resets the list; the model setter is stable enough here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const fetchModels = async () => {
    if (!keyVal && !isCustom) return;
    setIsFetchingModels(true);
    try {
      const res = await axios.post(`${API_URL}/api/providers/models`, { provider, api_key: keyVal });
      if (res.data?.status === 'success' && Array.isArray(res.data.models) && res.data.models.length > 0) {
        applyModels(res.data.models);
      } else {
        throw new Error('No models returned from API');
      }
    } catch (err) {
      // The built-in list stays usable; nothing for the user to do.
      console.warn('Failed to fetch dynamic models, using fallback list:', err);
      applyModels(fallbackModels());
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleTestAi = async () => {
    if (!keyVal && !isCustom) {
      setTest({ kind: 'empty' });
      return;
    }
    setTest({ kind: 'loading' });
    try {
      const res = await axios.post(`${API_URL}/api/settings/test-ai`, {
        provider,
        api_key: keyVal,
        custom_base_url: customBaseUrl,
        custom_model_name: customModelName,
        model: selectedModel,
      });
      if (res.data?.status === 'success') {
        setTest({ kind: 'success' });
        if (current?.supportsModelFetch) await fetchModels();
        else applyModels(fallbackModels());
      } else {
        setTest({ kind: 'failed', technical: typeof res.data?.message === 'string' ? res.data.message : '' });
      }
    } catch (err) {
      setTest({ kind: 'failed', technical: requestError(err, '').message });
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-bg-secondary p-5">
      <h3 className="text-card-title text-text-primary">{t('settings.provider_title')}</h3>

      <Select
        label={t('settings.provider_label')}
        options={PROVIDERS.map((p) => ({ label: p.label, value: p.id }))}
        value={provider}
        onChange={(e) => setProvider(e.target.value as ProviderId)}
      />

      {isCustom ? (
        <div className="flex flex-col items-start gap-2">
          <Button variant="outline" icon={Settings2} onClick={() => setShowCustomModal(true)}>
            {t('settings.custom_config_btn')}
          </Button>
          {customBaseUrl && customModelName ? (
            <p className="break-all text-body text-text-secondary">
              {t('settings.custom_config_summary', { model: customModelName, url: customBaseUrl })}
            </p>
          ) : (
            <p className="text-body text-warning">{t('settings.custom_config_req')}</p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex items-end gap-2">
            <InputGroup
              className="min-w-0 flex-1"
              label={t('settings.api_key_label', { provider: current?.label || '' })}
              type={showKey ? 'text' : 'password'}
              autoComplete="off"
              value={keyVal}
              onChange={(e) => {
                setApiKey(provider, e.target.value);
                setTest({ kind: 'idle' });
              }}
            />
            <Button
              variant="ghost"
              type="button"
              icon={showKey ? EyeOff : Eye}
              aria-label={t(showKey ? 'settings.hide_key' : 'settings.show_key')}
              aria-pressed={showKey}
              onClick={() => setShowKey((v) => !v)}
            />
          </div>
          <p className="text-caption text-text-secondary">{t('settings.api_key_note')}</p>
          {!keyVal && <p className="text-body text-warning">{t('settings.api_key_req')}</p>}
        </div>
      )}

      <div className="flex flex-col items-start gap-2">
        <Button variant="outline" type="button" loading={test.kind === 'loading'} onClick={() => void handleTestAi()}>
          {test.kind === 'loading' ? t('settings.testing') : t('settings.test_ai_btn')}
        </Button>
        {test.kind === 'success' && <p role="status" className="text-body text-success">{t('settings.test_ai_success')}</p>}
        {test.kind === 'empty' && <p role="alert" className="text-body text-error">{t('settings.test_ai_empty')}</p>}
        {test.kind === 'failed' && (
          <div role="alert" className="flex flex-col gap-1">
            <p className="text-body text-error">{t('settings.test_ai_failed')}</p>
            <TechnicalDetails text={test.technical} />
          </div>
        )}
      </div>

      {!isCustom && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          {isFetchingModels ? (
            <p role="status" className="text-body text-text-secondary">{t('settings.fetch_models_loading')}</p>
          ) : availableModels.length > 0 ? (
            <>
              <Select
                label={t('settings.model_label')}
                options={availableModels.map((m) => ({ label: m.label, value: m.id }))}
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              />
              {current?.supportsModelFetch && keyVal && (
                <div>
                  <Button variant="ghost" icon={RefreshCw} onClick={() => void fetchModels()}>
                    {t('settings.fetch_models')}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-body text-text-secondary">{t('settings.test_first')}</p>
          )}
        </div>
      )}

      {showCustomModal && (
        <CustomConfigModal apiKeys={apiKeys} setApiKey={setApiKey} onClose={() => setShowCustomModal(false)} />
      )}
    </div>
  );
};

interface CustomConfigModalProps {
  apiKeys: Record<string, string>;
  setApiKey: (id: string, value: string) => void;
  onClose: () => void;
}

/** Address, model and key of an OpenAI-compatible server (for example Ollama on this computer). */
const CustomConfigModal: React.FC<CustomConfigModalProps> = ({ apiKeys, setApiKey, onClose }) => {
  const { t } = useTranslation();
  const [start] = useState(() => ({
    baseUrl: apiKeys['custom_base_url'] || '',
    modelName: apiKeys['custom_model_name'] || '',
    key: apiKeys['custom'] || '',
  }));
  const [baseUrl, setBaseUrl] = useState(start.baseUrl);
  const [modelName, setModelName] = useState(start.modelName);
  const [key, setKey] = useState(start.key);
  const [showKey, setShowKey] = useState(false);
  const dirty =
    baseUrl !== start.baseUrl || modelName !== start.modelName || key !== start.key;

  const handleSave = () => {
    setApiKey('custom_base_url', baseUrl.trim());
    setApiKey('custom_model_name', modelName.trim());
    setApiKey('custom', key.trim());
    onClose();
  };

  return (
    <Dialog
      title={t('settings.custom_modal_title')}
      onClose={onClose}
      dirty={dirty}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={handleSave}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <InputGroup
          label={t('settings.custom_base_url')}
          type="url"
          inputMode="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="http://localhost:11434/v1"
        />
        <InputGroup
          label={t('settings.custom_model_name')}
          type="text"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder="llama3"
        />
        <div className="flex items-end gap-2">
          <InputGroup
            className="min-w-0 flex-1"
            label={t('settings.custom_api_key')}
            type={showKey ? 'text' : 'password'}
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
          <Button
            variant="ghost"
            type="button"
            icon={showKey ? EyeOff : Eye}
            aria-label={t(showKey ? 'settings.hide_key' : 'settings.show_key')}
            aria-pressed={showKey}
            onClick={() => setShowKey((v) => !v)}
          />
        </div>
        <p className="-mt-2 text-caption text-text-secondary">{t('settings.custom_api_key_ph')}</p>
      </div>
    </Dialog>
  );
};
