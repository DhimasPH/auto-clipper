import type React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  XCircle,
  HardDrive,
  Folder,
  FileVideo,
  ChevronLeft
} from "lucide-react";
import { apiBrowseGDrive, type GDriveItem } from "../api";

export const GDriveBrowserModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelectFile: (filePath: string) => void;
}> = ({ isOpen, onClose, onSelectFile }) => {
  const [currentPath, setCurrentPath] = useState<string>("");
  const [items, setItems] = useState<GDriveItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [parentDir, setParentDir] = useState<string | null>(null);

  const fetchDir = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiBrowseGDrive(path);
      setItems(res.items);
      setCurrentPath(res.current_dir);
      setParentDir(res.parent_dir);
    } catch (err: any) {
      setError(err.message || "Failed to load directory");
    } finally {
      setLoading(false);
    }
  }, []);

  const prevIsOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      fetchDir(currentPath);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, currentPath, fetchDir]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl bg-white border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-5 border-b border-border bg-white">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-text-primary text-base">Browse Google Drive</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-text-tertiary hover:text-text-primary rounded-xl hover:bg-slate-100 transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-3 bg-slate-50 flex items-center gap-2 text-sm text-text-secondary font-mono overflow-x-auto whitespace-nowrap border-b border-border">
          {parentDir !== null && (
            <button 
              type="button"
              onClick={() => fetchDir(parentDir)}
              disabled={loading}
              className="p-1 hover:bg-slate-200 rounded-md transition-colors text-text-secondary hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
              title="Go up"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <span className="truncate">{currentPath || "/content/drive"}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-purple-600/30 border-t-purple-600 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500 text-sm">{error}</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-text-tertiary text-sm">Folder is empty</div>
          ) : (
            <div className="space-y-1">
              {items.map((item) => (
                <button
                  type="button"
                  key={item.path}
                  onClick={() => {
                    if (item.is_dir) {
                      fetchDir(item.path);
                    } else {
                      onSelectFile(item.path);
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 border border-transparent hover:border-border rounded-xl transition-all group"
                >
                  {item.is_dir ? (
                    <Folder className="w-5 h-5 text-purple-600 group-hover:text-purple-700 flex-shrink-0" />
                  ) : (
                    <FileVideo className="w-5 h-5 text-pink-500 group-hover:text-pink-600 flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium text-text-primary truncate">{item.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GDriveBrowserModal;
