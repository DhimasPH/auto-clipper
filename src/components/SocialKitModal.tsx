import React, { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy } from "lucide-react";
import axios from "axios";
import { SocialData, Clip } from "./ClipCard";
import { AppContext } from "../App";
import { API_URL } from "../platform/backendUrl";
import { platform } from "../platform";
import { copyText } from "../lib/clipboard";
import { requestError, toLang } from "../lib/errorInfo";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { TechnicalDetails } from "./ui/TechnicalDetails";

export interface SocialKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  social?: SocialData;
  clip: Clip;
  jobId: string;
  clipIndex: number;
  onUpdate: (social: SocialData) => void;
}

/** "Salin" next to a text; says "Tersalin" for two seconds, or that copying did not work. */
const CopyButton: React.FC<{ text: string; label: string }> = ({ text, label }) => {
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const copy = async () => {
    const ok = await copyText(text);
    setState(ok ? "copied" : "failed");
    if (ok) setTimeout(() => setState("idle"), 2000);
  };
  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <Button variant="outline" icon={Copy} aria-label={label} onClick={() => void copy()}>
        {state === "copied" ? t("social.copied") : t("social.copy")}
      </Button>
      {/* The button keeps its specific name ("Salin judul 1"), so "Tersalin" is announced here. */}
      <span role="status" className="sr-only">{state === "copied" ? t("social.copied") : ""}</span>
      {state === "failed" && (
        <span role="alert" className="text-caption text-error">{t("social.copy_failed")}</span>
      )}
    </span>
  );
};

/** One block of share text: a heading, the text, and a copy button. */
const Block: React.FC<{ title: string; text: string; copyLabel?: string }> = ({ title, text, copyLabel }) => (
  <section className="flex flex-col gap-2">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-body font-semibold text-text-primary">{title}</h3>
      {copyLabel && <CopyButton text={text} label={copyLabel} />}
    </div>
    <p className="whitespace-pre-wrap break-words text-body text-text-primary">{text}</p>
  </section>
);

/** "Bagikan" on a clip card: titles, description and hashtags to copy into TikTok, Reels or Shorts. */
export const SocialKitModal: React.FC<SocialKitModalProps> = (props) => (props.isOpen ? <SocialKitBody {...props} /> : null);

const SocialKitBody: React.FC<SocialKitModalProps> = ({ onClose, social, clip, jobId, clipIndex, onUpdate }) => {
  const { t, i18n } = useTranslation();
  const ctx = useContext(AppContext);
  const [isGenerating, setIsGenerating] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const en = toLang(i18n.language) === "en";

  // Titles and hashtags are written by the AI provider: only with the API key mode and a key.
  const provider: string = ctx?.provider || "";
  const apiKey: string = ctx?.apiKeys?.[provider] || "";
  const keysAllowed = platform().caps.apiKeys;
  const canGenerate = keysAllowed && ctx?.aiMode === "auto" && (!!apiKey || provider === "custom");

  const handleGenerate = async () => {
    setIsGenerating(true);
    setFailed(null);
    try {
      const res = await axios.post(`${API_URL}/jobs/${jobId}/clips/${clipIndex}/social`, {
        description: clip.description_en || clip.description_id || clip.description || "",
        provider,
        api_key: apiKey,
        custom_base_url: ctx?.apiKeys?.custom_base_url || "",
        custom_model_name: ctx?.apiKeys?.custom_model_name || "",
        model: ctx?.selectedModel || "",
      });
      if (res.data?.status === "success" && res.data.social) onUpdate(res.data.social);
      else setFailed(typeof res.data?.message === "string" ? res.data.message : "");
    } catch (err) {
      setFailed(requestError(err, "").message);
    } finally {
      setIsGenerating(false);
    }
  };

  const titles = (en ? social?.titles_en : social?.titles_id) || [];
  const description = (en ? social?.description_en : social?.description_id) || "";
  const hashtags = ((en ? social?.hashtags_en : social?.hashtags_id) || []).join(" ");
  const bestTime = (en ? social?.best_time_to_post_en : social?.best_time_to_post_id) || "";
  const backsound = (en ? social?.backsound_en : social?.backsound_id) || "";
  const clipDescription = (en ? clip.description_en : clip.description_id) || clip.description || "";
  const hasKit = titles.length > 0 || !!description || !!hashtags || !!social?.thumbnail_layout || !!bestTime || !!backsound;

  return (
    <Dialog
      title={t("social.title", { n: clipIndex + 1 })}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>{t("common.close")}</Button>
          {canGenerate && (
            <Button variant={hasKit ? "outline" : "primary"} loading={isGenerating} onClick={() => void handleGenerate()}>
              {isGenerating ? t("social.generating") : t(hasKit ? "social.regenerate" : "social.generate")}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {failed !== null && (
          <div role="alert" className="flex flex-col gap-1">
            <p className="text-body text-error">{t("social.failed")}</p>
            <TechnicalDetails text={failed} />
          </div>
        )}

        {!hasKit && (
          <>
            {clipDescription && (
              <Block title={t("social.description")} text={clipDescription} copyLabel={t("social.copy_description")} />
            )}
            <p className="text-body text-text-secondary">
              {canGenerate
                ? t("social.empty_can_generate")
                : keysAllowed
                  ? t("social.empty_needs_key")
                  : clipDescription
                    ? t("social.empty")
                    : t("social.empty_no_text")}
            </p>
          </>
        )}

        {titles.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-body font-semibold text-text-primary">{t("social.titles")}</h3>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {titles.map((title, i) => (
                <li key={i} className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-b-0">
                  <span className="min-w-0 break-words text-body text-text-primary">{title}</span>
                  <CopyButton text={title} label={t("social.copy_title", { n: i + 1 })} />
                </li>
              ))}
            </ul>
          </section>
        )}
        {description && <Block title={t("social.description")} text={description} copyLabel={t("social.copy_description")} />}
        {hashtags && <Block title={t("social.hashtags")} text={hashtags} copyLabel={t("social.copy_hashtags")} />}
        {social?.thumbnail_layout && <Block title={t("social.thumbnail")} text={social.thumbnail_layout} />}
        {bestTime && <Block title={t("social.best_time")} text={bestTime} />}
        {backsound && <Block title={t("social.backsound")} text={backsound} />}
      </div>
    </Dialog>
  );
};
