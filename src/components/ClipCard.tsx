import React from "react";
import { useTranslation } from "react-i18next";

export interface Clip {
  path: string;
  description: string;
  start: string;
  end: string;
  subs: boolean;
  v: number;
}

interface ClipCardProps {
  clip: Clip;
  index: number;
  mode: "ai" | "manual";
  subtitlePath: string | null;
  reRendering: boolean;
  onToggleSubs: () => void;
  videoSrc: (path: string, v: number) => string;
}

export default function ClipCard({
  clip,
  index,
  mode,
  subtitlePath,
  reRendering,
  onToggleSubs,
  videoSrc
}: ClipCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className="glass-panel"
      style={{
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        width: "280px",
      }}
    >
      <div
        style={{
          aspectRatio: "9/16",
          background: "rgba(0,0,0,0.5)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <video
          key={clip.v}
          src={videoSrc(clip.path, clip.v)}
          controls
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            background: "#000",
          }}
        />
      </div>
      <div>
        <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.1rem" }}>
          {mode === "ai" ? t('clip.title_ai', { num: index + 1 }) : t('clip.title_manual')}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: "0.875rem",
            color: "var(--text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {clip.description}
        </p>
        
        {subtitlePath && (
          <button
            onClick={onToggleSubs}
            disabled={reRendering}
            style={{
              display: "block",
              marginTop: "0.75rem",
              padding: "0.4rem 0.75rem",
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: clip.subs ? "var(--accent)" : "var(--button-hover)",
              color: clip.subs ? "#fff" : "var(--text-secondary)",
              fontSize: "0.8rem",
              cursor: reRendering ? "not-allowed" : "pointer",
              opacity: reRendering ? 0.6 : 1,
            }}
          >
            {reRendering
              ? t('clip.btn_rerender')
              : clip.subs
                ? t('clip.btn_sub_on')
                : t('clip.btn_sub_off')}
          </button>
        )}
        
        <a
          href={videoSrc(clip.path, clip.v)}
          download
          style={{
            display: "inline-block",
            marginTop: "0.75rem",
            fontSize: "0.8rem",
            color: "var(--accent)",
            textDecoration: "none",
          }}
        >
          {t('clip.btn_download')}
        </a>
      </div>
    </div>
  );
}
