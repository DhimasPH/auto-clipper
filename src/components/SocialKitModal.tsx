import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Copy, Check, Clock, Music } from 'lucide-react';
import { SocialData } from './ClipCard';

export interface SocialKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  social: SocialData;
  clipIndex: number;
}

const CopyButton: React.FC<{ textToCopy: string; label?: string }> = ({ textToCopy, label }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy"
      className="flex items-center gap-1 text-accent hover:text-accent/80 transition-colors shrink-0"
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {label && <span className="text-caption font-medium">{label}</span>}
    </button>
  );
};

export const SocialKitModal: React.FC<SocialKitModalProps> = ({
  isOpen,
  onClose,
  social,
  clipIndex,
}) => {
  const { t, i18n } = useTranslation();

  if (!isOpen) return null;

  const titles = i18n.language === 'id' ? social.titles_id : social.titles_en;
  const description = i18n.language === 'id' ? social.description_id : social.description_en;
  const hashtags = i18n.language === 'id' ? social.hashtags_id : social.hashtags_en;
  const bestTime = i18n.language === 'id' ? social.best_time_to_post_id : social.best_time_to_post_en;
  const backsound = i18n.language === 'id' ? social.backsound_id : social.backsound_en;

  const joinedHashtags = hashtags?.join(' ') || '';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-bg-secondary w-full max-w-2xl max-h-[80vh] flex flex-col rounded-card shadow-dropdown border border-border overflow-hidden animate-in slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-border bg-bg-surface shrink-0">
          <h2 className="text-section-title text-text-primary">
            {t('social_kit.title', 'Social Kit - Clip {{num}}', { num: clipIndex })}
          </h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex flex-col gap-6">
          {/* Titles */}
          {titles && titles.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="font-medium text-text-primary text-body">
                {t('clip.social_titles', 'Judul Viral (Pilih satu):')}
              </div>
              <div className="flex flex-col gap-2">
                {titles.map((title, i) => (
                  <div key={i} className="flex justify-between items-start gap-4 p-3 bg-bg-surface rounded-lg border border-border">
                    <span className="text-text-secondary text-body">{title}</span>
                    <CopyButton textToCopy={title} />
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <hr className="border-border" />

          {/* Description */}
          {description && (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="font-medium text-text-primary text-body">
                  {t('clip.social_desc', 'Deskripsi:')}
                </span>
                <CopyButton textToCopy={description} label="Copy" />
              </div>
              <div className="p-3 bg-bg-surface rounded-lg border border-border text-text-secondary text-body whitespace-pre-wrap">
                {description}
              </div>
            </div>
          )}

          {joinedHashtags && (
            <>
              <hr className="border-border" />
              {/* Hashtags */}
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-text-primary text-body">
                    {t('clip.social_hashtags', 'Hashtags:')}
                  </span>
                  <CopyButton textToCopy={joinedHashtags} label="Copy" />
                </div>
                <div className="p-3 bg-bg-surface rounded-lg border border-border text-text-secondary text-body break-words">
                  {joinedHashtags}
                </div>
              </div>
            </>
          )}

          {social.thumbnail_layout && (
            <>
              <hr className="border-border" />
              {/* Thumbnail Idea */}
              <div className="flex flex-col gap-3">
                <div className="font-medium text-text-primary text-body">
                  {t('clip.social_thumbnail', 'Ide Thumbnail:')}
                </div>
                <div className="p-3 bg-bg-surface rounded-lg border border-border text-text-secondary text-body">
                  {social.thumbnail_layout}
                </div>
              </div>
            </>
          )}

          {bestTime && (
            <>
              <hr className="border-border" />
              {/* Best Time to Post */}
              <div className="flex flex-col gap-3">
                <div className="font-medium text-text-primary text-body flex items-center gap-2">
                  <Clock className="w-5 h-5 text-accent" />
                  {t('clip.social_best_time', 'Waktu Terbaik Posting:')}
                </div>
                <div className="p-3 bg-bg-surface rounded-lg border border-border text-text-secondary text-body">
                  {bestTime}
                </div>
              </div>
            </>
          )}

          {backsound && (
            <>
              <hr className="border-border" />
              {/* Backsound */}
              <div className="flex flex-col gap-3">
                <div className="font-medium text-text-primary text-body flex items-center gap-2">
                  <Music className="w-5 h-5 text-accent" />
                  {t('clip.social_backsound', 'Saran Backsound:')}
                </div>
                <div className="p-3 bg-bg-surface rounded-lg border border-border text-text-secondary text-body">
                  {backsound}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};
