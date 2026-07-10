import React from "react";
import { useTranslation } from "react-i18next";

type Theme = "dark" | "light" | "system";

interface HeaderProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  backendStatus: string;
  onOpenFAQ: () => void;
}

export default function Header({ theme, setTheme, backendStatus, onOpenFAQ }: HeaderProps) {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'id' ? 'en' : 'id';
    i18n.changeLanguage(nextLang);
  };

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "2rem",
        paddingBottom: "1.5rem",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: "2.5rem",
            fontWeight: 800,
            letterSpacing: "-1px",
            background: "linear-gradient(90deg, #818cf8, #c084fc)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            display: "inline-block",
          }}
        >
          Auto Clipper
        </h1>
        <p style={{ margin: "0.5rem 0 0 0", color: "var(--text-secondary)" }}>
          {t('header.subtitle')}
        </p>
      </div>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        {/* Language Toggle */}
        <button
          onClick={toggleLanguage}
          style={{
            background: "var(--button-hover)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            padding: "0 0.5rem",
            height: "32px",
            borderRadius: "16px",
            cursor: "pointer",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.85rem",
          }}
          title="Toggle Language"
        >
          {t('header.lang_toggle')}
        </button>
        {/* Theme Toggle */}
        <button
          onClick={() => {
            if (theme === "dark") setTheme("light");
            else if (theme === "light") setTheme("system");
            else setTheme("dark");
          }}
          style={{
            background: "var(--button-hover)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1rem",
          }}
          title={`Tema saat ini: ${theme}`}
        >
          {theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "💻"}
        </button>

        {/* FAQ Toggle */}
        <button
          onClick={onOpenFAQ}
          style={{
            background: "var(--button-hover)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            cursor: "pointer",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s",
          }}
          title="Cara Penggunaan (FAQ)"
        >
          ?
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.875rem",
            background: "rgba(255,255,255,0.05)",
            padding: "0.5rem 1rem",
            borderRadius: "99px",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: backendStatus === "Connected" ? "#10b981" : "#ef4444",
            }}
          />
          {t('header.backend_status')}: {backendStatus}
        </div>
      </div>
    </header>
  );
}
