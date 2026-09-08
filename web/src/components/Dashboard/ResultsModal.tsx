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
  onEditSubtitle?: (clipIndex: number) => void;
  onRerenderClip?: (clipId: string) => void;
  onOpenFolder?: () => void;
  onResetApp?: () => void;
}> = ({ isOpen, onClose, clips, onEditSubtitle, onRerenderClip, onOpenFolder, onResetApp }) => {
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
      <div className="flex min-h-full items-center justify-center p-2 sm:p-4 py-6 sm:py-10" onClick={(e) => { if(e.target === e.currentTarget) onClose(); }}>
        <div 
          className="bg-white border border-border w-full max-w-5xl rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col my-auto max-h-[92vh] overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="results-modal-title"
        >
          
          <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl sm:rounded-t-3xl shrink-0">
             <div className="flex items-center gap-2.5 sm:gap-3">
                <FileVideo className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
                <h2 id="results-modal-title" className="text-lg sm:text-xl font-bold text-text-primary">Your Clips are Ready!</h2>
             </div>
             <button onClick={onClose} aria-label="Close modal" className="text-text-tertiary hover:text-text-primary transition-colors p-1">
               <XCircle className="w-6 h-6" />
             </button>
          </div>

          <div className="p-3 sm:p-6 overflow-y-auto flex-1 min-h-0 bg-bg-surface/30">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {clips.map((clip, i) => (
                  <div key={clip.id} className="bg-white border border-border rounded-2xl overflow-hidden group flex flex-col shadow-sm hover:shadow-md transition-shadow">
                     <div className="aspect-[9/16] max-h-[360px] sm:max-h-[400px] shrink-0 bg-slate-900 relative border-b border-border">
                        <video src={getVideoStreamUrl(clip.path)} preload="metadata" controls playsInline className="w-full h-full object-contain" />
                     </div>
                     <div className="p-3.5 sm:p-4 flex flex-col flex-1 min-h-0">
                        <p className="font-semibold text-sm text-text-primary line-clamp-2 shrink-0 mb-2.5" title={clip.title || `Clip ${i+1}`}>
                          {clip.title || `Clip ${i+1}`}
                        </p>
                        
                        {clip.social && (
                           <div className="flex-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar text-xs">
                             <div className="font-semibold text-text-primary flex items-center gap-1.5 mb-2">
                               <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Social Kit
                             </div>
                             {(() => {
                               const thumbnail = clip.social.thumbnail_layout;
                               
                               const renderLang = (lang: string, titles: any, caption: any, tags: any, bestTime: any, backsound: any) => {
                                 if (!titles?.length && !caption && !tags?.length) return null;
                                 return (
                                   <div className="mb-3 last:mb-0 pb-3 last:pb-0 border-b last:border-b-0 border-border">
                                     <div className="text-[10px] font-bold text-purple-700 mb-1.5 bg-purple-50 inline-block px-2 py-0.5 rounded-full border border-purple-200">[{lang} VERSION]</div>
                                     {titles && titles.length > 0 && (
                                       <div className="space-y-1 mb-2">
                                         <span className="text-text-tertiary block text-[11px]">Titles:</span>
                                         <ul className="list-disc pl-4 space-y-0.5">
                                           {titles.map((t: string, idx: number) => (
                                             <li key={idx} className="font-medium text-text-primary text-[11px] leading-tight">{t}</li>
                                           ))}
                                         </ul>
                                       </div>
                                     )}
                                     {caption && (
                                       <div className="mb-1.5"><span className="text-text-tertiary block mb-0.5 text-[11px]">Caption:</span> <span className="text-text-secondary whitespace-pre-wrap">{caption}</span></div>
                                     )}
                                     {tags && tags.length > 0 && (
                                       <div className="mb-1.5"><span className="text-text-tertiary block mb-0.5 text-[11px]">Tags:</span> <span className="text-purple-600 font-medium leading-relaxed">{tags.join(" ")}</span></div>
                                     )}
                                     {bestTime && (
                                       <div className="mb-1.5"><span className="text-text-tertiary block mb-0.5 text-[11px]">Best Time:</span> <span className="text-text-secondary">{bestTime}</span></div>
                                     )}
                                     {backsound && (
                                       <div><span className="text-text-tertiary block mb-0.5 text-[11px]">Backsound:</span> <span className="text-text-secondary">{backsound}</span></div>
                                     )}
                                   </div>
                                 );
                               };

                               const hasAnyData = clip.social.titles_en?.length || clip.social.titles_id?.length || clip.social.description_en || clip.social.description_id;
                               if (!hasAnyData) return <div className="text-text-tertiary italic mt-2 text-xs">No Social Kit Data Generated</div>;
                               
                               return (
                                 <div className="mt-1 text-xs">
                                   {thumbnail && (
                                     <div className="mb-3 pb-3 border-b border-border"><span className="text-text-tertiary block mb-0.5 text-[11px]">Thumbnail Idea:</span> <span className="text-text-secondary font-medium">{thumbnail}</span></div>
                                   )}
                                   {renderLang("ID", clip.social.titles_id, clip.social.description_id, clip.social.hashtags_id, clip.social.best_time_to_post_id, clip.social.backsound_id)}
                                   {renderLang("EN", clip.social.titles_en, clip.social.description_en, clip.social.hashtags_en, clip.social.best_time_to_post_en, clip.social.backsound_en)}
                                 </div>
                               );
                             })()}
                           </div>
                        )}

                        <div className="mt-3 pt-3 flex gap-2 shrink-0 border-t border-border">
                           {onEditSubtitle && (
                             <button
                               onClick={() => onEditSubtitle(i)}
                               className="flex-1 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-xs font-semibold text-purple-700 rounded-xl border border-purple-200 transition-colors text-center"
                               title="Edit Subtitles"
                             >
                               Koreksi Subtitle
                             </button>
                           )}
                           {onRerenderClip && !onEditSubtitle && (
                             <button onClick={() => onRerenderClip(clip.id)} className="flex-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-medium text-text-secondary hover:text-text-primary rounded-xl border border-border transition-colors text-center">
                               Edit / Rerender
                             </button>
                           )}
                           <a href={getDownloadUrl(clip.path)} download aria-label="Download clip" className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-text-secondary hover:text-text-primary border border-border rounded-xl transition-colors flex items-center justify-center shrink-0">
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
