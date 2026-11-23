import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { API_URL } from '../../App';
import { InputGroup } from '../ui/InputGroup';
import { Button } from '../ui/Button';

interface PexelsKeySectionProps {
  apiKeys: Record<string, string>;
  setApiKey: (id: string, value: string) => void;
}

type TestState = { kind: 'idle' | 'loading' } | { kind: 'success' | 'error'; message: string };

/**
 * The Pexels key for B-roll (moved out of ProviderSection): B-roll also works in manual AI
 * mode, so this stays visible when the API key switch is off.
 */
export const PexelsKeySection: React.FC<PexelsKeySectionProps> = ({ apiKeys, setApiKey }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [test, setTest] = useState<TestState>({ kind: 'idle' });
  const key = apiKeys.pexels || '';

  const runTest = async () => {
    if (!key) {
      setTest({ kind: 'error', message: t('settings.test_pexels_empty') });
      return;
    }
    setTest({ kind: 'loading' });
    try {
      const res = await axios.post(`${API_URL}/api/settings/test-pexels`, { api_key: key });
      if (res.data?.status === 'success') {
        setTest({ kind: 'success', message: t('settings.test_pexels_success') });
      } else {
        setTest({ kind: 'error', message: res.data?.message || t('settings.test_error') });
      }
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.response?.data?.detail || err?.message || t('settings.test_failed');
      setTest({ kind: 'error', message });
    }
  };

  return (
    <div className="rounded-card border border-border bg-bg-secondary p-5">
      <h3 className="text-card-title text-text-primary">{t('settings.pexels_title')}</h3>
      <p className="mt-1 text-body text-text-secondary">{t('settings.pexels_desc')}</p>
      <div className="mt-4 flex items-end gap-2">
        <InputGroup
          className="min-w-0 flex-1"
          label={t('settings.pexels_api_key')}
          type={visible ? 'text' : 'password'}
          autoComplete="off"
          value={key}
          onChange={(e) => {
            setApiKey('pexels', e.target.value);
            setTest({ kind: 'idle' });
          }}
        />
        <Button
          variant="ghost"
          type="button"
          icon={visible ? EyeOff : Eye}
          aria-label={t(visible ? 'settings.hide_key' : 'settings.show_key')}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        />
      </div>
      <div className="mt-4">
        <Button variant="outline" type="button" loading={test.kind === 'loading'} onClick={() => void runTest()}>
          {test.kind === 'loading' ? t('settings.testing') : t('settings.test_pexels_btn')}
        </Button>
        {test.kind === 'success' && (
          <p role="status" className="mt-2 text-body text-success">{test.message}</p>
        )}
        {test.kind === 'error' && (
          <p role="alert" className="mt-2 text-body text-error break-words">{test.message}</p>
        )}
      </div>
    </div>
  );
};
