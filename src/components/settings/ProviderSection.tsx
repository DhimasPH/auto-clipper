import React, { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../App';
import { useTranslation } from 'react-i18next';
import { Brain, Eye, EyeOff, Lock, Settings2, Server, Box, Loader2 } from 'lucide-react';
import { Select } from '../ui/Select';
import { InputGroup } from '../ui/InputGroup';
import { Button } from '../ui/Button';
import { PROVIDERS, ProviderId } from '../../lib/providers';

interface ProviderSectionProps {
  provider: ProviderId;
  setProvider: (p: ProviderId) => void;
  selectedModel: string;
  setSelectedModel: (m: string) => void;
  apiKeys: Record<string, string>;
  setApiKey: (id: string, value: string) => void;
}

export const ProviderSection: React.FC<ProviderSectionProps> = ({
  provider, setProvider, selectedModel, setSelectedModel, apiKeys, setApiKey,
}) => {
  const { t } = useTranslation();
  const [showKey, setShowKey] = useState(false);
  const [showPexels, setShowPexels] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);

  const [testAiStatus, setTestAiStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testAiMessage, setTestAiMessage] = useState('');
  const [testPexelsStatus, setTestPexelsStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testPexelsMessage, setTestPexelsMessage] = useState('');
  const current = PROVIDERS.find((p) => p.id === provider);
  const keyVal = apiKeys[provider] || '';
  const isCustom = provider === 'custom';

  const customBaseUrl = apiKeys['custom_base_url'] || '';
  const customModelName = apiKeys['custom_model_name'] || '';

  const [availableModels, setAvailableModels] = useState<{id: string, label: string}[]>([]);
  const [modelsFetched, setModelsFetched] = useState(false);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  React.useEffect(() => {
    setTestAiStatus('idle');
    setTestAiMessage('');
    setModelsFetched(false);
    setAvailableModels([]);
    // Only reset model if changing to a provider and current selectedModel is not in its fallbacks?
    // Let's just let it be, if it's invalid it will be updated later.
  }, [provider]);

  const fetchModels = async () => {
    setIsFetchingModels(true);
    try {
      const res = await axios.post(`${API_URL}/api/providers/models`, {
        provider,
        api_key: keyVal
      });
      if (res.data?.status === 'success' && res.data.models) {
        setAvailableModels(res.data.models);
        setModelsFetched(true);
        if (!selectedModel || !res.data.models.find((m: any) => m.id === selectedModel)) {
          setSelectedModel(res.data.models[0]?.id || current?.defaultModel || "");
        }
      } else {
        throw new Error("Failed to fetch models");
      }
    } catch (err) {
      console.error(err);
      const fallbacks = current?.fallbackModels?.map(m => ({ id: m, label: m })) || [];
      setAvailableModels(fallbacks);
      setModelsFetched(true);
      if (!selectedModel || !fallbacks.find(m => m.id === selectedModel)) {
        setSelectedModel(current?.defaultModel || "");
      }
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleTestAi = async () => {
    if (!keyVal && !isCustom) {
      setTestAiStatus('error');
      setTestAiMessage(t('settings.test_ai_empty', 'API Key cannot be empty'));
      return;
    }
    
    setTestAiStatus('loading');
    setTestAiMessage('');
    
    try {
      const res = await axios.post(`${API_URL}/api/settings/test-ai`, {
        provider: provider,
        api_key: keyVal,
        custom_base_url: customBaseUrl,
        custom_model_name: customModelName
      });
      
      if (res.data?.status === 'success') {
        setTestAiStatus('success');
        setTestAiMessage(t('settings.test_ai_success', 'API Key is valid!'));
        
        if (current?.supportsModelFetch) {
          fetchModels();
        } else {
          const fallbacks = current?.fallbackModels?.map(m => ({ id: m, label: m })) || [];
          setAvailableModels(fallbacks);
          setModelsFetched(true);
          if (!selectedModel || !fallbacks.find(m => m.id === selectedModel)) {
            setSelectedModel(current?.defaultModel || "");
          }
        }
      } else {
        setTestAiStatus('error');
        setTestAiMessage(res.data?.message || t('settings.test_error', 'Error occurred'));
      }
    } catch (err: any) {
      setTestAiStatus('error');
      const errMsg = err.response?.data?.message || err.response?.data?.detail || err.message || t('settings.test_failed', 'Failed to connect to backend');
      setTestAiMessage(errMsg === '"Not Found"' || errMsg === 'Not Found' ? 'Backend endpoint not found. Please restart the app.' : errMsg);
    }
  };

  const handleTestPexels = async () => {
    const pexelsKey = apiKeys["pexels"] || '';
    if (!pexelsKey) {
      setTestPexelsStatus('error');
      setTestPexelsMessage(t('settings.test_pexels_empty', 'Pexels API Key cannot be empty'));
      return;
    }
    
    setTestPexelsStatus('loading');
    setTestPexelsMessage('');
    
    try {
      const res = await axios.post(`${API_URL}/api/settings/test-pexels`, {
        api_key: pexelsKey
      });
      
      if (res.data?.status === 'success') {
        setTestPexelsStatus('success');
        setTestPexelsMessage(t('settings.test_pexels_success', 'Pexels API Key is valid!'));
      } else {
        setTestPexelsStatus('error');
        setTestPexelsMessage(res.data?.message || t('settings.test_error', 'Error occurred'));
      }
    } catch (err: any) {
      setTestPexelsStatus('error');
      const errMsg = err.response?.data?.message || err.response?.data?.detail || err.message || t('settings.test_failed', 'Failed to connect to backend');
      setTestPexelsMessage(errMsg);
    }
  };

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
              onChange={(e) => {
                setApiKey(provider, e.target.value);
                setTestAiStatus('idle');
                setTestAiMessage('');
              }}
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

        <div className="mt-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleTestAi} 
            disabled={testAiStatus === 'loading'}
            icon={testAiStatus === 'loading' ? Loader2 : undefined}
          >
            {testAiStatus === 'loading' ? t('settings.testing', 'Testing...') : t('settings.test_ai_btn', 'Test AI Connection')}
          </Button>
          
          {testAiStatus !== 'idle' && testAiMessage && (
            <p className={`text-sm mt-2 ${testAiStatus === 'success' ? 'text-green-500' : 'text-red-500'}`}>
              {testAiMessage}
            </p>
          )}
        </div>

        {/* Model Selection Dropdown */}
        {!isCustom && (
          <div className="mt-4 p-4 border border-border rounded-lg bg-bg-surface">
            <h3 className="text-body font-medium text-text-primary mb-3">
              {t('settings.model_label', 'AI Model')}
            </h3>
            
            {testAiStatus === 'success' ? (
              isFetchingModels ? (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">{t('settings.fetch_models_loading', 'Fetching models...')}</span>
                </div>
              ) : modelsFetched ? (
                <div className="space-y-3">
                  <Select
                    label=""
                    options={availableModels.map(m => ({ label: m.label, value: m.id }))}
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                  />
                  {current?.supportsModelFetch && (
                    <Button variant="ghost" size="sm" onClick={fetchModels}>
                      {t('settings.fetch_models', 'Refresh Models')}
                    </Button>
                  )}
                </div>
              ) : null
            ) : (
              <p className="text-sm text-text-secondary">
                {t('settings.test_first', 'Test your API Key first to see available models')}
              </p>
            )}
          </div>
        )}

        <div className="relative pt-4 border-t border-border">
          <InputGroup
            label={t('settings.pexels_api_key', 'Pexels API Key (Optional)')}
            type={showPexels ? 'text' : 'password'}
            value={apiKeys["pexels"] || ''}
            onChange={(e) => {
              setApiKey("pexels", e.target.value);
              setTestPexelsStatus('idle');
              setTestPexelsMessage('');
            }}
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

          <div className="mt-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleTestPexels} 
              disabled={testPexelsStatus === 'loading'}
              icon={testPexelsStatus === 'loading' ? Loader2 : undefined}
            >
              {testPexelsStatus === 'loading' ? t('settings.testing', 'Testing...') : t('settings.test_pexels_btn', 'Test Pexels Connection')}
            </Button>
            
            {testPexelsStatus !== 'idle' && testPexelsMessage && (
              <p className={`text-sm mt-2 ${testPexelsStatus === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                {testPexelsMessage}
              </p>
            )}
          </div>
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
