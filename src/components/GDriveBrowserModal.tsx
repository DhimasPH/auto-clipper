import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { Folder, FileVideo, ChevronLeft, Loader2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { apiBrowseGDrive, type GDriveItem } from "../api";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";

/** Colab only: pick a video from the mounted Google Drive. */
export const GDriveBrowserModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (filePath: string) => void;
}> = (props) => {
  // Kept while the dialog is closed: the next opening starts in the folder the user was in.
  const [lastPath, setLastPath] = useState("");
  return props.isOpen ? <DriveBrowser {...props} startPath={lastPath} onShown={setLastPath} /> : null;
};

const DriveBrowser: React.FC<{
  onClose: () => void;
  onSelectFile: (filePath: string) => void;
  startPath: string;
  onShown: (path: string) => void;
}> = ({ onClose, onSelectFile, startPath, onShown }) => {
  const { t } = useTranslation();
  const [currentPath, setCurrentPath] = useState<string>(startPath);
  const [items, setItems] = useState<GDriveItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  // The folder that could not be opened; "Coba lagi" opens that one again.
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const [parentDir, setParentDir] = useState<string | null>(null);

  const fetchDir = useCallback(async (path: string): Promise<boolean> => {
    setLoading(true);
    setFailedPath(null);
    try {
      const res = await apiBrowseGDrive(path);
      setItems(res.items);
      setCurrentPath(res.current_dir);
      setParentDir(res.parent_dir);
      onShown(res.current_dir);
      return true;
    } catch (err) {
      console.error("Drive browser failed:", err);
      setFailedPath(path);
      return false;
    } finally {
      setLoading(false);
    }
  }, [onShown]);

  useEffect(() => {
    void (async () => {
      // The last folder may be gone (moved or deleted in Drive): fall back to the Drive root.
      if (!(await fetchDir(startPath)) && startPath !== "") await fetchDir("");
    })();
    // Once per opening, from the folder shown last time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog title={t("drive.title")} onClose={onClose} size="lg">
      <div className="flex flex-col gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {parentDir !== null && (
            <Button
              variant="outline"
              icon={ChevronLeft}
              onClick={() => void fetchDir(parentDir)}
              disabled={loading}
              aria-label={t("drive.go_up")}
              title={t("drive.go_up")}
            />
          )}
          <p className="min-w-0 break-all text-caption text-text-secondary">{currentPath || "/content/drive"}</p>
        </div>

        {loading ? (
          <p role="status" className="flex items-center gap-2 py-8 text-body text-text-secondary">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            {t("drive.loading")}
          </p>
        ) : failedPath !== null ? (
          <div role="alert" className="flex flex-col items-start gap-3 py-4">
            <p className="text-body text-error">{t("drive.load_failed")}</p>
            <Button variant="outline" icon={RefreshCw} onClick={() => void fetchDir(failedPath)}>
              {t("drive.retry")}
            </Button>
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-body text-text-secondary">{t("drive.empty")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {items.map((item) => (
              <li key={item.path}>
                <button
                  type="button"
                  onClick={() => (item.is_dir ? void fetchDir(item.path) : onSelectFile(item.path))}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-input px-3 py-2 text-left text-body text-text-primary hover:bg-bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {/* Folder vs video file: the icon is the only cue besides the name. */}
                  {item.is_dir ? (
                    <><Folder className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden="true" /><span className="sr-only">{t("drive.folder")}</span></>
                  ) : (
                    <><FileVideo className="h-5 w-5 shrink-0 text-text-secondary" aria-hidden="true" /><span className="sr-only">{t("drive.video")}</span></>
                  )}
                  <span className="min-w-0 break-all">{item.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
};

export default GDriveBrowserModal;
