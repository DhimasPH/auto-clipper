import React, { useState } from "react";
import { Copy, Check, Play, AlertCircle } from "lucide-react";
import { Button } from "./ui/Button";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { API_URL } from "../App";
import { useToasts } from "../hooks/useToasts";

interface ManualResumeModalProps {
  job: any;
  onClose: () => void;
  onSuccess: (jobId: string) => void;
}

export const ManualResumeModal: React.FC<ManualResumeModalProps> = ({ job, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { notify } = useToasts();
  const [copied, setCopied] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const promptText = job.metadata?.manual_prompt || t("manualAI.prompt_unavailable");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const validateJson = (text: string) => {
    try {
      let cleanText = text.trim();
      const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        cleanText = match[1].trim();
      } else {
        cleanText = cleanText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
      }
      JSON.parse(cleanText);
      return null; // Let the backend _parse_highlights do the heavy lifting
    } catch (e) {
      return t("manualAI.err_invalid_json");
    }
  };

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setJsonInput(val);
    if (val.trim()) {
      setError(validateJson(val));
    } else {
      setError(null);
    }
  };

  const handleSubmit = async () => {
    const validationError = validateJson(jsonInput);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await axios.post(`${API_URL}/jobs/${job.id}/resume-manual`, {
        json_payload: jsonInput
      });
      if (res.data.status === "success") {
        notify(t("manualAI.success"), "success");
        onSuccess(res.data.job_id);
      } else {
        throw new Error(res.data.message || t("manualAI.err_process"));
      }
    } catch (err: any) {
      console.error(err);
      notify(`⚠️ ${err.response?.data?.message || err.message || t("manualAI.err_process")}`, "error");
      setError(err.response?.data?.message || err.message || t("manualAI.err_process"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-bg-secondary w-full max-w-2xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-border flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-text-primary">{t("manualAI.resume_title")}</h2>
            <p className="text-caption text-text-secondary mt-1">{t("manualAI.resume_subtitle")}</p>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Prompt Section */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-label text-text-primary font-medium">{t("manualAI.prompt_label")}</label>
              <Button variant="outline" size="sm" icon={copied ? Check : Copy} onClick={handleCopy}>
                {copied ? t("manualAI.copied") : t("manualAI.copy_prompt")}
              </Button>
            </div>
            <div className="bg-bg-surface p-4 rounded-xl border border-border text-sm text-text-secondary h-48 overflow-y-auto font-mono whitespace-pre-wrap select-all">
              {promptText}
            </div>
          </div>

          {/* JSON Input Section */}
          <div className="space-y-2">
            <label className="text-label text-text-primary font-medium">{t("manualAI.json_label")}</label>
            <textarea
              value={jsonInput}
              onChange={handleJsonChange}
              placeholder={t("manualAI.json_placeholder")}
              className="w-full h-48 p-4 rounded-xl border border-border bg-input-bg text-text-primary focus:outline-none focus:border-accent font-mono text-sm"
            />
            {error && (
              <div className="flex items-center gap-2 text-danger text-sm mt-2">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-border flex justify-end gap-3 shrink-0 bg-bg-secondary rounded-b-2xl">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {t("history.cancel")}
          </Button>
          <Button
            variant="primary"
            icon={Play}
            onClick={handleSubmit}
            disabled={isSubmitting || !jsonInput.trim() || !!error}
          >
            {isSubmitting ? t("manualAI.processing") : t("manualAI.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
};
