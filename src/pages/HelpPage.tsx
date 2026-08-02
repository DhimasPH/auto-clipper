import { useTranslation } from "react-i18next";
import { PageHeader } from "../components/ui/PageHeader";
import { HelpCircle, BookOpen, AlertTriangle, Terminal, RefreshCw, Copy, Check, AlertCircle } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { API_URL } from "../App";

type TabType = 'guide' | 'faq' | 'logs';
type LogType = 'app' | 'error' | 'ai';

export const HelpPage = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('guide');
  const [logType, setLogType] = useState<LogType>('app');
  const [logContent, setLogContent] = useState<string>('');
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const terminalRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async (type: LogType) => {
    setIsLoadingLogs(true);
    setLogError(null);
    try {
      const res = await fetch(`${API_URL}/logs/${type}`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setLogContent(data.content || '');
    } catch (err: any) {
      setLogError(t('help.logs_fetch_error', 'Failed to load logs. Is the backend running?'));
      setLogContent('');
    } finally {
      setIsLoadingLogs(false);
    }
  }, [t]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs(logType);
    }
  }, [activeTab, logType, fetchLogs]);

  useEffect(() => {
    if (terminalRef.current && logContent) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logContent]);

  const handleCopy = async () => {
    if (!logContent) return;
    try {
      await navigator.clipboard.writeText(logContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy logs:", err);
    }
  };

  const faqs: { q: string; a: string }[] = t('help.faqs', { returnObjects: true }) as any;

  const renderLogLines = (text: string) => {
    if (!text || text.trim() === '') {
      return (
        <div className="text-text-tertiary italic text-center py-16 flex flex-col items-center justify-center gap-2">
          <Terminal className="w-8 h-8 opacity-40 text-text-tertiary" />
          <span>{t('help.logs_empty', 'No logs recorded yet.')}</span>
        </div>
      );
    }

    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let lineClass = 'text-text-secondary';
      if (
        line.includes('[ERROR]') || 
        line.includes('Traceback') || 
        line.includes('Error:') || 
        line.includes('Exception:') ||
        line.toLowerCase().includes('failed')
      ) {
        lineClass = 'text-red-400 font-medium';
      } else if (line.includes('[WARNING]')) {
        lineClass = 'text-amber-400';
      } else if (line.includes('[SUCCESS]') || line.includes('DONE')) {
        lineClass = 'text-emerald-400';
      } else if (line.includes('[AI') || line.includes('AI RESPONSE') || line.includes('AI PROMPT')) {
        lineClass = 'text-indigo-300';
      }

      return (
        <div key={idx} className={`${lineClass} leading-5 px-1 hover:bg-white/[0.03] rounded font-mono text-[11px] sm:text-xs select-text break-words whitespace-pre-wrap`}>
          {line || '\u00A0'}
        </div>
      );
    });
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-12">
      <PageHeader 
        title={t('help.title', 'Help & Guide')} 
      />

      <div className="flex gap-4 mb-8 border-b border-border">
        <button
          className={`pb-4 px-2 font-medium transition-colors border-b-2 ${
            activeTab === 'guide' 
              ? 'border-accent text-accent' 
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
          onClick={() => setActiveTab('guide')}
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            {t('help.tab_guide', 'User Guide')}
          </div>
        </button>
        <button
          className={`pb-4 px-2 font-medium transition-colors border-b-2 ${
            activeTab === 'faq' 
              ? 'border-accent text-accent' 
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
          onClick={() => setActiveTab('faq')}
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4" />
            {t('help.tab_faq', 'FAQ')}
          </div>
        </button>
        <button
          className={`pb-4 px-2 font-medium transition-colors border-b-2 ${
            activeTab === 'logs' 
              ? 'border-accent text-accent' 
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
          onClick={() => setActiveTab('logs')}
        >
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            {t('help.tab_logs', 'System Logs')}
          </div>
        </button>
      </div>

      <div className="bg-bg-surface border border-border rounded-xl p-6 lg:p-8">
        {activeTab === 'guide' ? (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h2 className="text-xl font-bold text-text-primary mb-2">
                {t('help.guide_title', 'How to Use')}
              </h2>
              <p className="text-text-secondary">
                {t('faq.desc')}
              </p>
            </div>

            <ol className="list-decimal pl-5 flex flex-col gap-6 text-text-secondary marker:text-accent marker:font-bold">
              <li>
                <strong className="text-text-primary text-lg block mb-1">{t('faq.step1_title')}</strong>
                {t('faq.step1_desc')}
              </li>
              <li>
                <strong className="text-text-primary text-lg block mb-1">{t('faq.step2_title')}</strong>
                {t('faq.step2_desc')}
              </li>
              <li>
                <strong className="text-text-primary text-lg block mb-1">{t('faq.step3_title')}</strong>
                {t('faq.step3_desc')}
              </li>
              <li>
                <strong className="text-text-primary text-lg block mb-1">{t('faq.step4_title')}</strong>
                {t('faq.step4_desc')}
              </li>
            </ol>

            <div className="p-4 bg-danger/10 border-l-4 border-danger rounded-r-lg mt-8">
              <div className="flex items-center gap-2 text-danger font-bold mb-2">
                <AlertTriangle className="w-5 h-5" />
                <span>{t('faq.note_title')}</span>
              </div>
              <p className="text-sm text-text-secondary m-0">
                {t('faq.note_desc')}
              </p>
            </div>
          </div>
        ) : activeTab === 'faq' ? (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-xl font-bold text-text-primary mb-6">
              {t('help.faq_title', 'Frequently Asked Questions (FAQ)')}
            </h2>
            
            <div className="space-y-4">
              {Array.isArray(faqs) && faqs.map((faq, idx) => (
                <div key={idx} className="bg-bg-secondary p-5 rounded-lg border border-border">
                  <h3 className="font-bold text-text-primary mb-2 flex items-start gap-3">
                    <span className="text-accent">Q:</span>
                    {faq.q}
                  </h3>
                  <p className="text-text-secondary flex items-start gap-3">
                    <span className="text-text-tertiary font-bold">A:</span>
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Sub-pills for Log Type */}
              <div className="inline-flex p-1 bg-bg-secondary border border-border rounded-lg gap-1">
                <button
                  type="button"
                  onClick={() => setLogType('app')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    logType === 'app'
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]'
                  }`}
                >
                  {t('help.logs_type_app', 'Application')}
                </button>
                <button
                  type="button"
                  onClick={() => setLogType('error')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    logType === 'error'
                      ? 'bg-red-500/90 text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]'
                  }`}
                >
                  {t('help.logs_type_error', 'Errors')}
                </button>
                <button
                  type="button"
                  onClick={() => setLogType('ai')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    logType === 'ai'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]'
                  }`}
                >
                  {t('help.logs_type_ai', 'AI Requests')}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchLogs(logType)}
                  disabled={isLoadingLogs}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-secondary border border-border text-text-secondary hover:text-text-primary hover:bg-white/[0.04] transition-all disabled:opacity-50"
                  title={t('help.logs_refresh', 'Refresh')}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                  <span>{t('help.logs_refresh', 'Refresh')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!logContent || isLoadingLogs}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-bg-secondary border border-border text-text-secondary hover:text-text-primary hover:bg-white/[0.04] transition-all disabled:opacity-50"
                  title={t('help.logs_copy', 'Copy Log')}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">{t('help.logs_copied', 'Copied!')}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t('help.logs_copy', 'Copy Log')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {logError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-xs text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{logError}</span>
              </div>
            )}

            {/* Terminal Window */}
            <div className="relative rounded-xl border border-border bg-bg-primary overflow-hidden shadow-inner">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 bg-bg-secondary/40 text-xs text-text-tertiary">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/60 inline-block"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60 inline-block"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60 inline-block"></span>
                  </div>
                  <span className="font-mono ml-2 text-[11px]">
                    {logType === 'app' ? 'backend_app.log' : logType === 'error' ? 'backend_error.log' : 'backend_ai.log'}
                  </span>
                </div>
                {isLoadingLogs && (
                  <span className="text-[11px] text-text-tertiary animate-pulse">Loading...</span>
                )}
              </div>

              <div 
                ref={terminalRef}
                className="p-4 overflow-auto max-h-[500px] min-h-[220px] select-text"
              >
                {renderLogLines(logContent)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
