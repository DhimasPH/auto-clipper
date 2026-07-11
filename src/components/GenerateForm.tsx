import { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";

interface GenerateFormProps {
  mode: "ai" | "manual";
  setMode: Dispatch<SetStateAction<"ai" | "manual">>;
  inputType: "url" | "local";
  setInputType: Dispatch<SetStateAction<"url" | "local">>;
  url: string;
  setUrl: Dispatch<SetStateAction<string>>;
  setLocalFile: Dispatch<SetStateAction<File | null>>;
  aspectRatio: "1:1" | "4:5" | "9:16";
  setAspectRatio: Dispatch<SetStateAction<"1:1" | "4:5" | "9:16">>;
  captionStyle: "standard" | "karaoke";
  setCaptionStyle: Dispatch<SetStateAction<"standard" | "karaoke">>;
  provider: "openai" | "gemini";
  burnSubtitles: boolean;
  setBurnSubtitles: Dispatch<SetStateAction<boolean>>;
  manualStart: string;
  setManualStart: Dispatch<SetStateAction<string>>;
  manualEnd: string;
  setManualEnd: Dispatch<SetStateAction<string>>;
  quality: "best" | "1080p" | "720p";
  setQuality: Dispatch<SetStateAction<"best" | "1080p" | "720p">>;
  errorMsg: string;
  isRunning: boolean;
  status: string;
  progressPct: number;
  progress: string;
  handleGenerate: () => void;
  cancelJob: () => void;
}

/** The main workspace panel: mode/input/ratio/caption controls + generate/cancel + progress. */
export default function GenerateForm({
  mode, setMode,
  inputType, setInputType,
  url, setUrl,
  setLocalFile,
  aspectRatio, setAspectRatio,
  captionStyle, setCaptionStyle,
  provider,
  burnSubtitles, setBurnSubtitles,
  manualStart, setManualStart,
  manualEnd, setManualEnd,
  quality, setQuality,
  errorMsg,
  isRunning,
  status,
  progressPct,
  progress,
  handleGenerate,
  cancelJob,
}: GenerateFormProps) {
  const { t } = useTranslation();

  return (
      <main
        className="glass-panel animate-slide-up"
        style={{
          padding: "2rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {/* Mode Selector */}
        <div
          style={{
            display: "flex",
            gap: "1rem",
            background: "var(--input-bg)",
            padding: "0.5rem",
            borderRadius: "12px",
          }}
        >
          <button
            onClick={() => setMode("ai")}
            style={{
              flex: 1,
              padding: "0.75rem",
              borderRadius: "8px",
              border: "none",
              background: mode === "ai" ? "var(--accent)" : "transparent",
              color: mode === "ai" ? "var(--on-accent)" : "var(--text-secondary)",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {t('main.ai_mode')}
          </button>
          <button
            onClick={() => setMode("manual")}
            style={{
              flex: 1,
              padding: "0.75rem",
              borderRadius: "8px",
              border: "none",
              background: mode === "manual" ? "var(--accent)" : "transparent",
              color: mode === "manual" ? "var(--on-accent)" : "var(--text-secondary)",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {t('main.manual_mode')}
          </button>
        </div>

        {/* Input Type Selector */}
        <div style={{ display: "flex", gap: "1rem", background: "var(--input-bg)", padding: "0.5rem", borderRadius: "12px" }}>
          <button
            onClick={() => setInputType("url")}
            style={{
              flex: 1, padding: "0.75rem", borderRadius: "8px", border: "none",
              background: inputType === "url" ? "var(--accent)" : "transparent",
              color: inputType === "url" ? "var(--on-accent)" : "var(--text-secondary)",
              fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
            }}
          >
            URL Video (YouTube)
          </button>
          <button
            onClick={() => setInputType("local")}
            style={{
              flex: 1, padding: "0.75rem", borderRadius: "8px", border: "none",
              background: inputType === "local" ? "var(--accent)" : "transparent",
              color: inputType === "local" ? "var(--on-accent)" : "var(--text-secondary)",
              fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
            }}
          >
            Video Lokal (.mp4)
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
            {inputType === "url" ? t('main.url_label') : "Pilih File Video Lokal"}
          </label>

          {inputType === "url" ? (
            <input
              type="text"
              placeholder={t('main.url_placeholder')}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{
                width: "100%", padding: "0.875rem 1rem", borderRadius: "12px",
                border: "1px solid var(--border)", background: "var(--input-bg)",
                color: "var(--text-primary)", fontSize: "1rem", outline: "none",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
          ) : (
            <input
              type="file"
              accept="video/mp4,video/x-m4v,video/*"
              onChange={(e) => setLocalFile(e.target.files?.[0] || null)}
              style={{
                width: "100%", padding: "0.875rem 1rem", borderRadius: "12px",
                border: "1px solid var(--border)", background: "var(--input-bg)",
                color: "var(--text-primary)", fontSize: "1rem", outline: "none",
              }}
            />
          )}
        </div>

        {/* Aspect Ratio Selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
            Rasio Video (Aspect Ratio)
          </label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {(["1:1", "4:5", "9:16"] as const).map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                style={{
                  flex: 1, padding: "0.5rem", borderRadius: "8px", border: "1px solid",
                  borderColor: aspectRatio === ratio ? "var(--accent)" : "var(--border)",
                  background: aspectRatio === ratio ? "var(--accent-subtle)" : "var(--input-bg)",
                  color: aspectRatio === ratio ? "var(--accent)" : "var(--text-primary)",
                  cursor: "pointer", fontWeight: 600
                }}
              >
                {ratio === "9:16" ? "9:16 (Vertical)" : ratio === "4:5" ? "4:5 (Portrait)" : "1:1 (Square)"}
              </button>
            ))}
          </div>
        </div>

        {mode === "ai" ? (
          <div
            className="animate-slide-up"
            style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
          >
            {/* Caption Style Selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
                Gaya Subtitle
              </label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {(["standard", "karaoke"] as const).map((style) => {
                  const disabled = provider === "gemini" && style === "karaoke";
                  return (
                    <button
                      key={style}
                      disabled={disabled}
                      onClick={() => setCaptionStyle(style)}
                      style={{
                        flex: 1, padding: "0.5rem", borderRadius: "8px", border: "1px solid",
                        borderColor: captionStyle === style ? "var(--accent)" : "var(--border)",
                        background: captionStyle === style ? "var(--accent-subtle)" : "var(--input-bg)",
                        color: captionStyle === style ? "var(--accent)" : "var(--text-primary)",
                        cursor: disabled ? "not-allowed" : "pointer", fontWeight: 600,
                        opacity: disabled ? 0.5 : 1
                      }}
                    >
                      {style === "standard" ? "Standard (Baris)" : "Karaoke (Word-by-word)"}
                    </button>
                  );
                })}
              </div>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={burnSubtitles}
                onChange={(e) => setBurnSubtitles(e.target.checked)}
              />
              {t('main.subtitle_label')}
            </label>
          </div>
        ) : (
          <div
            className="animate-slide-up"
            style={{ display: "flex", gap: "1rem" }}
          >
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <label
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                }}
              >
                {t('main.manual_range_label')}
              </label>
              <input
                type="text"
                placeholder="00:00:00"
                value={manualStart}
                onChange={(e) => setManualStart(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.875rem 1rem",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  background: "var(--scrim)",
                  color: "var(--on-accent)",
                  fontSize: "1rem",
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              />
            </div>
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <label
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--text-secondary)",
                }}
              >
                {t('main.manual_end')}
              </label>
              <input
                type="text"
                placeholder="00:00:15"
                value={manualEnd}
                onChange={(e) => setManualEnd(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.875rem 1rem",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  fontSize: "1rem",
                  outline: "none",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              />
            </div>

            {/* Kualitas Download */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>
                Kualitas Video (Download)
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as any)}
                style={{
                  padding: "0.75rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--input-bg)",
                  color: "var(--text-primary)",
                  outline: "none",
                  fontWeight: 500
                }}
              >
                <option value="best">Best (Otomatis)</option>
                <option value="1080p">1080p (Maksimal)</option>
                <option value="720p">720p (Lebih cepat)</option>
              </select>
            </div>
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              padding: "1rem",
              borderRadius: "12px",
              background: "var(--error-bg)",
              border: "1px solid var(--error-bg)",
              color: "var(--error-text)",
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        {isRunning ? (
          <button
            onClick={cancelJob}
            style={{
              padding: "1rem",
              borderRadius: "12px",
              border: "none",
              background: "var(--danger)",
              color: "var(--on-accent)",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: "0 4px 14px 0 var(--danger-shadow)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              animation: "pulse-glow-red 2s infinite",
            }}
          >
            <div className="spinner" />
            Batal
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={false}
            style={{
              padding: "1rem",
              borderRadius: "12px",
              border: "none",
              background: "var(--accent)",
              color: "var(--on-accent)",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
              boxShadow: "0 4px 14px 0 var(--accent-shadow)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              animation: "pulse-glow 2s infinite",
            }}
          >
            {mode === "ai" ? t('main.btn_generate') : t('main.btn_manual_clip')}
          </button>
        )}

        {(isRunning || status === "DONE") && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}
          >
            <div
              style={{
                width: "100%",
                height: "8px",
                borderRadius: "99px",
                background: "var(--surface-raised)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progressPct}%`,
                  height: "100%",
                  borderRadius: "99px",
                  background: "var(--accent)",
                  transition: "width 0.4s ease",
                }}
              />
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
                textAlign: "right",
              }}
            >
              {progressPct}%{progress ? ` · ${progress}` : ""}
            </div>
          </div>
        )}
      </main>
  );
}
