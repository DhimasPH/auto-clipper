import React, { useEffect } from "react";
import { FileVideo, Download, XCircle, ArrowRight } from "lucide-react";
import { getVideoStreamUrl, getDownloadUrl } from "../../api";

export const ResultsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  clips: Array<{
    id: string;
    path: string;
    title?: string;
    duration?: number;
  }>;
  onRerenderClip?: (clipId: string) => void;
  onOpenFolder?: () => void;
  onResetApp?: () => void;
}> = ({ isOpen, onClose, clips, onRerenderClip, onOpenFolder, onResetApp }) => {
  // Close modal on Escape
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 py-10" onClick={(e) => { if(e.target === e.currentTarget) onClose(); }}>
        <div 
          className="bg-neutral-900 border border-neutral-800 w-full max-w-5xl rounded-2xl flex flex-col my-auto max-h-[90vh]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="results-modal-title"
        >
          
          <div className="p-6 border-b border-neutral-800 flex items-center justify-between sticky top-0 bg-neutral-900 z-10 rounded-t-2xl shrink-0">
             <div className="flex items-center gap-3">
                <FileVideo className="w-6 h-6 text-emerald-400" />
                <h2 id="results-modal-title" className="text-xl font-bold">Your Clips are Ready!</h2>
             </div>
             <button onClick={onClose} aria-label="Close modal" className="text-neutral-400 hover:text-white transition-colors">
               <XCircle className="w-6 h-6" />
             </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 min-h-0">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clips.map((clip, i) => (
                  <div key={clip.id} className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden group">
                     <div className="aspect-[9/16] bg-black relative">
                        {/* We use a standard video tag since we are in the web UI, paths might need to be resolved via API if they are local, assuming standard Tauri/Web integration applies here. */}
                        <video src={getVideoStreamUrl(clip.path)} preload="metadata" controls className="w-full h-full object-contain" />
                     </div>
                     <div className="p-4">
                        <p className="font-medium text-sm text-neutral-200 truncate" title={clip.title || `Clip ${i+1}`}>
                          {clip.title || `Clip ${i+1}`}
                        </p>
                        <div className="mt-4 flex gap-2">
                           {onRerenderClip && (
                             <button onClick={() => onRerenderClip(clip.id)} className="flex-1 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-medium rounded-lg transition-colors text-center">
                               Edit / Rerender
                             </button>
                           )}
                           <a href={getDownloadUrl(clip.path)} download aria-label="Download clip" className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg transition-colors flex items-center justify-center">
                              <Download className="w-4 h-4" />
                           </a>
                        </div>
                     </div>
                  </div>
                ))}
                {clips.length === 0 && (
                  <div className="col-span-full py-12 text-center text-neutral-500">
                     No clips found.
                  </div>
                )}
             </div>
          </div>

          <div className="p-6 border-t border-neutral-800 flex justify-between items-center bg-neutral-900/50 rounded-b-2xl shrink-0">
             {onOpenFolder ? (
               <button onClick={onOpenFolder} className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white transition-colors">
                 Open Output Folder
               </button>
             ) : (
               <div /> /* Placeholder to maintain flex-between layout */
             )}
             <button onClick={() => { onClose(); if(onResetApp) onResetApp(); }} className="flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold bg-emerald-500 text-emerald-950 hover:bg-emerald-400 transition-colors">
                Start New Job <ArrowRight className="w-4 h-4" />
             </button>
          </div>
       </div>
      </div>
    </div>
  );
};
