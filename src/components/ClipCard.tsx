import { useTranslation } from "react-i18next";
import { Download, Folder } from "lucide-react";
import { Button } from "./ui/Button";
import { open } from "@tauri-apps/plugin-shell";
import { save } from "@tauri-apps/plugin-dialog";
import { API_URL } from "../App";

export interface Clip {
  path: string;
  description: string;
  description_en?: string;
  description_id?: string;
  start: string;
  end: string;
  subs: boolean;
  v: number;
}

interface ClipCardProps {
  clip: Clip;
  index: number;
  videoSrc: (path: string, v: number) => string;
}

export default function ClipCard({
  clip,
  index,
  videoSrc
}: ClipCardProps) {
  const { t, i18n } = useTranslation();

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
              if ('__TAURI_INTERNALS__' in window) {
                try {
                  const lastSlash = clip.path.replace(/\\/g, '/').lastIndexOf('/');
                  const dir = clip.path.substring(0, lastSlash);
                  await open(dir);
                } catch (err) {
                  console.error("Open folder failed", err);
                  await open(clip.path); // fallback to old behavior
                }
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
