import { useTranslation } from "react-i18next";
import { Download, Folder } from "lucide-react";
import { Button } from "./ui/Button";
import { open } from "@tauri-apps/plugin-shell";
import { save } from "@tauri-apps/plugin-dialog";
import { API_URL } from "../App";

export interface SocialData {
  titles_en?: string[];
  titles_id?: string[];
  description_en?: string;
  description_id?: string;
  hashtags_en?: string[];
  hashtags_id?: string[];
  thumbnail_layout?: string;
}

export interface Clip {
  path: string;
  description: string;
  description_en?: string;
  description_id?: string;
  start: string;
  end: string;
  subs: boolean;
  v: number;
  social?: SocialData;
}

interface ClipCardProps {
  clip: Clip;
  index: number;
  videoSrc: (path: string, v: number) => string;
}

import { useState } from "react";

export default function ClipCard({
  clip,
  index,
  videoSrc
}: ClipCardProps) {
  const { t, i18n } = useTranslation();
  const [showSocial, setShowSocial] = useState(false);

  const currentDescription = i18n.language === 'id' 
    ? (clip.description_id || clip.description)
    : (clip.description_en || clip.description);

  return (
    <div className="bg-bg-secondary rounded-card border border-border p-4 flex flex-col gap-4 w-72 shadow-sm">
      <div className="aspect-[9/16] bg-scrim rounded-lg overflow-hidden border border-border/50">
        <video
          key={clip.v}
          src={videoSrc(clip.path, clip.v)}
          controls
          playsInline
          className="w-full h-full object-contain bg-black"
        />
      </div>
        <div className="flex flex-col flex-1">
        <h3 className="text-body font-bold text-text-primary mb-2">
          {t('clip.title_ai', { num: index + 1 })}
        </h3>
        <p className="text-caption text-text-secondary leading-relaxed mb-4 flex-1">
          {currentDescription}
        </p>

        {clip.social && (
          <div className="mb-4">
            <button
              onClick={() => setShowSocial(!showSocial)}
              className="text-accent text-caption font-medium hover:underline flex items-center gap-1"
            >
              {showSocial ? t('clip.hide_social', 'Sembunyikan Social Kit') : t('clip.show_social', 'Tampilkan Social Kit')}
            </button>
            {showSocial && (
              <div className="mt-2 p-3 bg-bg-surface rounded-lg border border-border text-caption space-y-3">
                {/* Titles */}
                <div>
                  <div className="font-medium text-text-primary mb-1">
                    {t('clip.social_titles', 'Judul Viral (Pilih satu):')}
                  </div>
                  <ul className="list-disc pl-4 text-text-secondary space-y-1">
                    {(i18n.language === 'id' ? clip.social.titles_id : clip.social.titles_en)?.map((title, i) => (
                      <li key={i} className="flex justify-between items-start gap-2">
                        <span>{title}</span>
                        <button
                          title="Copy"
                          onClick={() => navigator.clipboard.writeText(title)}
                          className="text-accent hover:text-accent/80 shrink-0"
                        >
                          Copy
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Description */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-text-primary">
                      {t('clip.social_desc', 'Deskripsi:')}
                    </span>
                    <button
                      title="Copy"
                      onClick={() => navigator.clipboard.writeText((i18n.language === 'id' ? clip.social?.description_id : clip.social?.description_en) || '')}
                      className="text-accent hover:text-accent/80"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-text-secondary line-clamp-3 hover:line-clamp-none">
                    {i18n.language === 'id' ? clip.social.description_id : clip.social.description_en}
                  </p>
                </div>

                {/* Hashtags */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-text-primary">
                      {t('clip.social_hashtags', 'Hashtags:')}
                    </span>
                    <button
                      title="Copy"
                      onClick={() => navigator.clipboard.writeText(((i18n.language === 'id' ? clip.social?.hashtags_id : clip.social?.hashtags_en) || []).join(' '))}
                      className="text-accent hover:text-accent/80"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-text-secondary">
                    {(i18n.language === 'id' ? clip.social.hashtags_id : clip.social.hashtags_en)?.join(' ')}
                  </p>
                </div>

                {/* Thumbnail Idea */}
                <div>
                  <div className="font-medium text-text-primary mb-1">
                    {t('clip.social_thumbnail', 'Ide Thumbnail:')}
                  </div>
                  <p className="text-text-secondary">
                    {clip.social.thumbnail_layout}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-auto">
          <button
            onClick={async (e) => {
              if ('__TAURI_INTERNALS__' in window) {
                e.preventDefault();
                try {
                  const filename = clip.path.replace(/\\/g, '/').split('/').pop() || 'clip.mp4';
                  const savePath = await save({
                    defaultPath: filename,
                    filters: [{ name: 'Video', extensions: ['mp4'] }]
                  });
                  if (savePath) {
                    await fetch(`${API_URL}/save_file`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ src: clip.path, dest: savePath })
                    });
                  }
                } catch (err) {
                  console.error("Save failed", err);
                }
              } else {
                const a = document.createElement('a');
                a.href = videoSrc(clip.path, clip.v);
                a.download = clip.path.replace(/\\/g, '/').split('/').pop() || 'clip.mp4';
                a.click();
              }
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-accent text-on-accent rounded-button text-caption font-medium hover:brightness-110 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {t('clip.btn_download', 'Download')}
          </button>
          <Button
            variant="outline"
            className="!px-3"
            icon={Folder}
            title="Buka Folder"
            onClick={async () => {
              const lastSlash = clip.path.replace(/\\/g, '/').lastIndexOf('/');
              const dir = clip.path.substring(0, lastSlash);
              
              if ('__TAURI_INTERNALS__' in window) {
                try {
                  await fetch(`${API_URL}/open_folder`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: dir })
                  });
                } catch (err) {
                  console.error("Open folder API failed", err);
                  // fallback to old tauri open
                  try {
                    await open(dir);
                  } catch (e2) {
                    await open(clip.path);
                  }
                }
              } else {
                // Not in Tauri (e.g. dev server), still try backend API
                await fetch(`${API_URL}/open_folder`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ path: dir })
                });
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
