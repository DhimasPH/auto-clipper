import React from "react";
import { useTranslation } from "react-i18next";

interface FAQModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FAQModal({ isOpen, onClose }: FAQModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem"
      }}
    >
      <div
        className="glass-panel animate-slide-up"
        style={{
          width: "100%",
          maxWidth: "500px",
          padding: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          background: "var(--bg-secondary)",
          color: "var(--text-primary)",
          borderRadius: "16px",
          border: "1px solid var(--border-color)",
          position: "relative"
        }}
      >
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '1.2rem',
            cursor: 'pointer',
            transition: 'color 0.2s'
          }}
        >
          ✕
        </button>

        <h2 style={{ margin: 0, fontSize: "1.5rem" }}>📖 {t('faq.title')}</h2>
        <p style={{ margin: 0, lineHeight: 1.5, color: "var(--text-secondary)" }}>
          {t('faq.desc')}
        </p>

        <ol
          style={{
            margin: 0,
            paddingLeft: "1.2rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            color: "var(--text-secondary)",
          }}
        >
          <li>
            <strong style={{ color: "var(--text-primary)" }}>{t('faq.step1_title')}</strong>
            <br />
            {t('faq.step1_desc')}
          </li>
          <li>
            <strong style={{ color: "var(--text-primary)" }}>{t('faq.step2_title')}</strong>
            <br />
            {t('faq.step2_desc')}
          </li>
          <li>
            <strong style={{ color: "var(--text-primary)" }}>{t('faq.step3_title')}</strong>
            <br />
            {t('faq.step3_desc')}
          </li>
          <li>
            <strong style={{ color: "var(--text-primary)" }}>{t('faq.step4_title')}</strong>
            <br />
            {t('faq.step4_desc')}
          </li>
        </ol>

        <div
          style={{
            padding: "1rem",
            background: "rgba(239, 68, 68, 0.1)",
            borderLeft: "4px solid #ef4444",
            borderRadius: "4px",
          }}
        >
          <strong style={{ color: "#ef4444" }}>⚠️ {t('faq.note_title')}</strong>
          <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.9rem", color: "var(--text-secondary)" }}>
            {t('faq.note_desc')}
          </p>
        </div>
      </div>
    </div>
  );
}
