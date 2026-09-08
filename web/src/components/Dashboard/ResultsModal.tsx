import React, { useEffect } from "react";
import { FileVideo, Download, XCircle, ArrowRight, Sparkles } from "lucide-react";
import { getVideoStreamUrl, getDownloadUrl } from "../../api";

export const ResultsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  clips: Array<{
    id: string;
    path: string;
    title?: string;
    duration?: number;
    social?: any;
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
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 py-10" onClick={(e) => { if(e.target === e.currentTarget) onClose(); }}>
        <div 
          className="bg-white border border-border w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col my-auto max-h-[90vh] overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="results-modal-title"
        >
          
          <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-3xl shrink-0">
             <div className="flex items-center gap-3">
                <FileVideo className="w-6 h-6 text-purple-600" />
                <h2 id="results-modal-title" className="text-xl font-bold text-text-primary">Your Clips are Ready!</h2>
             </div>
             <button onClick={onClose} aria-label="Close modal" className="text-text-tertiary hover:text-text-primary transition-colors">
               <XCircle className="w-6 h-6" />
             </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 min-h-0 bg-bg-surface/30">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clips.map((clip, i) => (
                  <div key={clip.id} className="bg-white border border-border rounded-2xl overflow-hidden group flex flex-col h-[750px] shadow-sm hover:shadow-md transition-shadow">
                     <div className="h-[400px] shrink-0 bg-slate-900 relative border-b border-border">
                        {/* We use a standard video tag since we are in the web UI, paths might need to be resolved via API if they are local, assuming standard Tauri/Web integration applies here. */}
                        <video src={getVideoStreamUrl(clip.path)} preload="metadata" controls className="w-full h-full object-contain" />
                     </div>
                     <div className="p-4 flex flex-col flex-1 min-h-0">
                        <p className="font-semibold text-sm text-text-primary line-clamp-2 shrink-0 mb-3" title={clip.title || `Clip ${i+1}`}>
                          {clip.title || `Clip ${i+1}`}
                        </p>
                        
                        {clip.social && (
                           <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar text-xs">
                             <div className="font-semibold text-text-primary flex items-center gap-1.5 mb-3">
                               <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Social Kit
                             </div>
                             {(() => {
                               const thumbnail = clip.social.thumbnail_layout;
                               
                               const renderLang = (lang: string, titles: any, caption: any, tags: any, bestTime: any, backsound: any) => {
                                 if (!titles?.length && !caption && !tags?.length) return null;
                                 return (
                                   <div className="mb-4 last:mb-0 pb-4 last:pb-0 border-b last:border-b-0 border-border">
                                     <div className="text-[10px] font-bold text-purple-700 mb-2 bg-purple-50 inline-block px-2 py-0.5 rounded-full border border-purple-200">[{lang} VERSION]</div>
                                     {titles && titles.length > 0 && (
                                       <div className="space-y-1.5 mb-2">
                                         <span className="text-text-tertiary block">Titles:</span>
                                         <ul className="list-disc pl-4 space-y-1">
                                           {titles.map((t: string, idx: number) => (
                                             <li key={idx} className="font-medium text-text-primary text-[11px] leading-tight">{t}</li>
                                           ))}
                                         </ul>
                                       </div>
                                     )}
                                     {caption && (
                                       <div className="mb-2"><span className="text-text-tertiary block mb-0.5">Caption:</span> <span className="text-text-secondary whitespace-pre-wrap">{caption}</span></div>
                                     )}
                                     {tags && tags.length > 0 && (
                                       <div className="mb-2"><span className="text-text-tertiary block mb-0.5">Tags:</span> <span className="text-purple-600 font-medium leading-relaxed">{tags.join(" ")}</span></div>
                                     )}
                                     {bestTime && (
                                       <div className="mb-2"><span className="text-text-tertiary block mb-0.5">Best Time to Post:</span> <span className="text-text-secondary">{bestTime}</span></div>
                                     )}
                                     {backsound && (
                                       <div><span className="text-text-tertiary block mb-0.5">Backsound:</span> <span className="text-text-secondary">{backsound}</span></div>
                                     )}
                                   </div>
                                 );
                               };

                               const hasAnyData = clip.social.titles_en?.length || clip.social.titles_id?.length || clip.social.description_en || clip.social.description_id;
                               if (!hasAnyData) return <div className="text-text-tertiary italic mt-2 text-sm">No Social Kit Data Generated</div>;
                               
                               return (
                                 <div className="mt-2 text-xs">
                                   {thumbnail && (
                                     <div className="mb-4 pb-4 border-b border-border"><span className="text-text-tertiary block mb-1">Thumbnail Idea:</span> <span className="text-text-secondary font-medium">{thumbnail}</span></div>
                                   )}
                                   {renderLang("ID", clip.social.titles_id, clip.social.description_id, clip.social.hashtags_id, clip.social.best_time_to_post_id, clip.social.backsound_id)}
                                   {renderLang("EN", clip.social.titles_en, clip.social.description_en, clip.social.hashtags_en, clip.social.best_time_to_post_en, clip.social.backsound_en)}
                                 </div>
                               );
                             })()}
                           </div>
                        )}

                        <div className="mt-4 pt-3 flex gap-2 shrink-0 border-t border-border">
                           {onRerenderClip && (
                             <button onClick={() => onRerenderClip(clip.id)} className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-medium text-text-secondary hover:text-text-primary rounded-xl border border-border transition-colors text-center">
                               Edit / Rerender
                             </button>
                           )}
                           <a href={getDownloadUrl(clip.path)} download aria-label="Download clip" className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-text-secondary hover:text-text-primary border border-border rounded-xl transition-colors flex items-center justify-center">
                              <Download className="w-4 h-4" />
                           </a>
                        </div>
                     </div>
                  </div>
                ))}
                {clips.length === 0 && (
                  <div className="col-span-full py-12 text-center text-text-tertiary">
                     No clips found.
                  </div>
                )}
             </div>
          </div>

          <div className="p-6 border-t border-border flex justify-between items-center bg-slate-50/70 rounded-b-3xl shrink-0">
             {onOpenFolder ? (
               <button onClick={onOpenFolder} className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
                 Open Output Folder
               </button>
             ) : (
               <div /> /* Placeholder to maintain flex-between layout */
             )}
             <button onClick={() => { onClose(); if(onResetApp) onResetApp(); }} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white shadow-md shadow-purple-500/25 transition-all">
                Start New Job <ArrowRight className="w-4 h-4" />
             </button>
          </div>
       </div>
      </div>
    </div>
  );
};
