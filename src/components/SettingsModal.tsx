import { useState } from "react";
import { useTranslation } from "react-i18next";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: "dark" | "light" | "system";
  setTheme: (t: "dark" | "light" | "system") => void;
  provider: "openai" | "gemini";
  setProvider: (p: "openai" | "gemini") => void;
  openaiKey: string;
  setOpenaiKey: (key: string) => void;
  geminiKey: string;
  setGeminiKey: (key: string) => void;
  outputFolder: string;
  setOutputFolder: (folder: string) => void;
  quality: "best" | "1080p" | "720p";
  setQuality: (q: "best" | "1080p" | "720p") => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  theme,
  setTheme,
  provider,
  setProvider,
  openaiKey,
  setOpenaiKey,
  geminiKey,
  setGeminiKey,
  outputFolder,
  setOutputFolder,
  quality,
  setQuality,
}: SettingsModalProps) {
  const { t, i18n } = useTranslation();
  const [showKey, setShowKey] = useState(false);

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
      }}
    >
      <div
        className="glass-panel animate-slide-up"
        style={{
          width: "90%",
          maxWidth: "400px",
          padding: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          position: "relative",
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

        <h2 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-primary)" }}>
          ⚙️ {t('settings.title')}
        </h2>

        {/* Theme Settings */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
            {t('settings.theme')}
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {(["dark", "light", "system"] as const).map((tOpt) => (
              <button
                key={tOpt}
                onClick={() => setTheme(tOpt)}
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  borderRadius: "8px",
                  border: "1px solid",
                  borderColor: theme === tOpt ? "var(--accent)" : "var(--border)",
                  background: theme === tOpt ? "rgba(99, 102, 241, 0.1)" : "var(--input-bg)",
                  color: theme === tOpt ? "var(--accent)" : "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                {tOpt === "dark" ? `🌙 ${t('settings.theme_dark')}` : tOpt === "light" ? `☀️ ${t('settings.theme_light')}` : `💻 ${t('settings.theme_system')}`}
              </button>
            ))}
          </div>
        </div>

        {/* Language Settings */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
            {t('settings.language')}
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() => i18n.changeLanguage('id')}
              style={{
                flex: 1,
                padding: "0.5rem",
                borderRadius: "8px",
                border: "1px solid",
                borderColor: i18n.language === 'id' ? "var(--accent)" : "var(--border)",
                background: i18n.language === 'id' ? "rgba(99, 102, 241, 0.1)" : "var(--input-bg)",
                color: i18n.language === 'id' ? "var(--accent)" : "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              🇮🇩 Indonesia
            </button>
            <button
              onClick={() => i18n.changeLanguage('en')}
              style={{
                flex: 1,
                padding: "0.5rem",
                borderRadius: "8px",
                border: "1px solid",
                borderColor: i18n.language === 'en' ? "var(--accent)" : "var(--border)",
                background: i18n.language === 'en' ? "rgba(99, 102, 241, 0.1)" : "var(--input-bg)",
                color: i18n.language === 'en' ? "var(--accent)" : "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              🇬🇧 English
            </button>
          </div>
        </div>

        {/* AI Provider Settings */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
            {t('settings.provider_label')}
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as "openai" | "gemini")}
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--input-bg)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          >
            <option value="openai">OpenAI (GPT-4o + Whisper)</option>
            <option value="gemini">Google Gemini (2.5 Flash)</option>
          </select>
        </div>

        {/* API Key Settings */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
            {provider === "openai" ? t('settings.api_key_openai') : t('settings.api_key_gemini')}
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showKey ? "text" : "password"}
              placeholder="..."
              value={provider === "openai" ? openaiKey : geminiKey}
              onChange={(e) => provider === "openai" ? setOpenaiKey(e.target.value) : setGeminiKey(e.target.value)}
              style={{
                width: "100%",
                padding: "0.75rem",
                paddingRight: "2.5rem",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                outline: "none",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              style={{
                position: "absolute",
                right: "0.5rem",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-secondary)",
                fontSize: "1rem",
              }}
              title={showKey ? "Hide API Key" : "Show API Key"}
            >
              {showKey ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
            🔒 {t('settings.api_key_note')}
          </span>
        </div>

        {/* Output Folder Settings */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
            Folder Penyimpanan
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              readOnly
              value={outputFolder || "Default (temp_downloads)"}
              style={{
                flex: 1,
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                background: "var(--input-bg)",
                color: "var(--text-primary)",
                outline: "none",
                cursor: "default"
              }}
            />
            <button
              onClick={async () => {
                if (window.electronAPI) {
                  const folder = await window.electronAPI.selectFolder();
                  if (folder) setOutputFolder(folder);
                } else {
                  alert("Fitur pilih folder hanya tersedia di aplikasi Desktop.");
                }
              }}
              style={{
                background: "var(--button-hover)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
                padding: "0 1rem",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Pilih Folder
            </button>
            {outputFolder && (
              <button
                onClick={() => setOutputFolder("")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ef4444",
                  cursor: "pointer",
                  fontSize: "1.2rem",
                }}
                title="Reset ke Default"
              >
                ×
              </button>
            )}
          </div>
        </div>



        {/* Kualitas Video Settings */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
            Kualitas Video (Download)
          </label>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as "best" | "1080p" | "720p")}
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--input-bg)",
              color: "var(--text-primary)",
              outline: "none",
            }}
          >
            <option value="best">Best (Otomatis) (Bawaan)</option>
            <option value="1080p">1080p (Maksimal)</option>
            <option value="720p">720p (Lebih Cepat)</option>
          </select>
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {t('settings.save')}
        </button>
      </div>
    </div>
  );
}
