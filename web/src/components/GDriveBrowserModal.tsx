import type React from "react";
import { useState, useEffect } from "react";
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

  useEffect(() => {
    if (isOpen) {
      fetchDir(currentPath);
    }
  }, [isOpen, currentPath]);

  const fetchDir = async (path: string) => {
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
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-neutral-100">Browse Google Drive</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-100 rounded-lg hover:bg-neutral-800 transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-3 bg-neutral-950 flex items-center gap-2 text-sm text-neutral-300 font-mono overflow-x-auto whitespace-nowrap border-b border-neutral-800">
          {parentDir !== null && (
            <button 
              type="button"
              onClick={() => setCurrentPath(parentDir)}
              className="p-1 hover:bg-neutral-800 rounded-md transition-colors text-neutral-400 hover:text-neutral-200"
              title="Go up"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <span className="truncate">{currentPath || "/content/drive"}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-400 text-sm">{error}</div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-neutral-500 text-sm">Folder is empty</div>
          ) : (
            <div className="space-y-1">
              {items.map((item, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => {
                    if (item.is_dir) {
                      setCurrentPath(item.path);
                    } else {
                      onSelectFile(item.path);
                    }
                  }}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-neutral-800 rounded-xl transition-colors group"
                >
                  {item.is_dir ? (
                    <Folder className="w-5 h-5 text-blue-400 group-hover:text-blue-300 flex-shrink-0" />
                  ) : (
                    <FileVideo className="w-5 h-5 text-amber-400 group-hover:text-amber-300 flex-shrink-0" />
                  )}
                  <span className="text-sm text-neutral-200 truncate">{item.name}</span>
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
