import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { API_URL } from '../../platform/backendUrl';
import { requestError } from '../../lib/errorInfo';
import { InputGroup } from '../ui/InputGroup';
import { Button } from '../ui/Button';

interface PexelsKeySectionProps {
  apiKeys: Record<string, string>;
  setApiKey: (id: string, value: string) => void;
}

type TestState =
  | { kind: 'idle' | 'loading' | 'success' | 'empty' }
  | { kind: 'failed'; technical: string };

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
    if (!key.trim()) {
      setTest({ kind: 'empty' });
      return;
    }
    setTest({ kind: 'loading' });
    try {
      const res = await axios.post(`${API_URL}/api/settings/test-pexels`, { api_key: key });
      if (res.data?.status === 'success') {
        setTest({ kind: 'success' });
      } else {
        setTest({ kind: 'failed', technical: typeof res.data?.message === 'string' ? res.data.message : '' });
      }
    } catch (err) {
      setTest({ kind: 'failed', technical: requestError(err, '').message });
    }
  };

  return (
    <div className="rounded-card border border-border bg-bg-secondary p-5">
      <h3 className="text-card-title text-text-primary">{t('settings.pexels_title')}</h3>
      <p className="mt-1 text-body text-text-secondary">{t('settings.pexels_desc')}</p>
      <div className="mt-4 flex items-end gap-2">
        <InputGroup
          className="min-w-0 flex-1"
          label={t('settings.pexels_key_label')}
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
          {test.kind === 'loading' ? t('settings.testing') : t('settings.pexels_test')}
        </Button>
        {test.kind === 'success' && (
          <p role="status" className="mt-2 text-body text-success">{t('settings.pexels_ok')}</p>
        )}
        {test.kind === 'empty' && (
          <p role="alert" className="mt-2 text-body text-error">{t('settings.pexels_empty')}</p>
        )}
        {test.kind === 'failed' && (
          <div role="alert" className="mt-2 flex flex-col gap-1">
            <p className="text-body text-error">{t('settings.pexels_failed')}</p>
            {test.technical && (
              <details className="text-body text-text-secondary">
                <summary className="flex min-h-[44px] cursor-pointer items-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  {t('settings.logs_title')}
                </summary>
                <p className="break-words font-mono">{test.technical}</p>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
