import { useTranslation } from "react-i18next";
import { PageHeader } from "../components/ui/PageHeader";
import { HelpCircle, BookOpen, AlertTriangle } from "lucide-react";
import { useState } from "react";

export const HelpPage = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'guide' | 'faq'>('guide');

  const faqs: { q: string; a: string }[] = t('help.faqs', { returnObjects: true }) as any;

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
        ) : (
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
        )}
      </div>
    </div>
  );
};
