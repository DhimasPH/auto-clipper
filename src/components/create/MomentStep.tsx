import React, { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, ExternalLink } from "lucide-react";
import { checkAiAnswer, type AiAnswerProblem } from "../../lib/aiAnswer";
import { copyText } from "../../lib/clipboard";
import { platform } from "../../platform";
import type { ErrorInfo } from "../../types/errorInfo";
import { ErrorCard } from "../ErrorCard";
import { Button } from "../ui/Button";

export const CHATGPT_URL = "https://chatgpt.com/";
export const GEMINI_URL = "https://gemini.google.com/app";

export interface MomentStepProps {
  /** metadata.manual_prompt of the waiting project. */
  prompt: string;
  projectTitle: string;
  submitting: boolean;
  error: { message: string; info: ErrorInfo | null } | null;
  onSubmit: (payload: string) => void;
  onLater: () => void;
}

function StepNumber({ n }: { n: number }) {
  return (
    <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-muted text-label font-semibold text-accent">
      {n}
    </span>
  );
}

/** Step 3 (spec 4.2): copy, ask ChatGPT or Gemini, paste the answer. */
export const MomentStep: React.FC<MomentStepProps> = ({ prompt, projectTitle, submitting, error, onSubmit, onLater }) => {
  const { t } = useTranslation();
  const headingId = useId();
  const answerId = useId();
  const problemId = useId();
  const [answer, setAnswer] = useState("");
  const [problem, setProblem] = useState<{ kind: AiAnswerProblem; moment?: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const copy = async () => {
    const ok = await copyText(prompt);
    setCopied(ok);
    setCopyFailed(!ok);
    if (ok) setTimeout(() => setCopied(false), 3000);
  };

  const submit = () => {
    const result = checkAiAnswer(answer);
    if (!result.ok) {
      setProblem({ kind: result.problem, moment: result.moment });
      return;
    }
    setProblem(null);
    onSubmit(result.payload);
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-5 rounded-card border border-border bg-bg-secondary p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="text-section-title text-text-primary">
          {t("moment.title")}
        </h2>
        <p className="text-body text-text-secondary">{t("moment.intro")}</p>
      </div>

      <ol className="flex flex-col gap-6">
        <li className="flex gap-3">
          <StepNumber n={1} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {prompt ? (
              <>
                <Button className="self-start" icon={copied ? Check : Copy} onClick={() => void copy()}>
                  {copied ? t("moment.copied") : t("moment.copy")}
                </Button>
                <p className="text-body text-text-secondary">{t("moment.copy_help")}</p>
                {copyFailed && (
                  <>
                    <p role="alert" className="text-body text-error">
                      {t("moment.copy_failed")}
                    </p>
                    <textarea
                      readOnly
                      aria-label={t("moment.copy_box_label")}
                      value={prompt}
                      className="min-h-[120px] w-full rounded-input border border-border-active bg-bg-surface p-3 text-body text-text-primary"
                    />
                  </>
                )}
              </>
            ) : (
              <p role="alert" className="text-body text-error">
                {t("moment.prompt_missing")}
              </p>
            )}
          </div>
        </li>

        <li className="flex gap-3">
          <StepNumber n={2} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              {/* The icon says "opens a new tab". */}
              <Button variant="outline" icon={ExternalLink} onClick={() => void platform().openExternal(CHATGPT_URL).catch(console.error)}>
                {t("moment.open_chatgpt")}
              </Button>
              <Button variant="outline" icon={ExternalLink} onClick={() => void platform().openExternal(GEMINI_URL).catch(console.error)}>
                {t("moment.open_gemini")}
              </Button>
            </div>
            <p className="text-body text-text-secondary">{t("moment.open_help")}</p>
          </div>
        </li>

        <li className="flex gap-3">
          <StepNumber n={3} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <label htmlFor={answerId} className="text-label text-text-primary">
              {t("moment.answer_label")}
            </label>
            <textarea
              id={answerId}
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value);
                setProblem(null);
              }}
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? problemId : undefined}
              className={`min-h-[160px] w-full rounded-input border bg-bg-secondary p-3 text-body text-text-primary ${problem ? "border-error" : "border-border-active"}`}
            />
            {problem && (
              <p id={problemId} className="text-body text-error">
                {t(`moment.problem_${problem.kind}`, { n: problem.moment })}
              </p>
            )}
            {error && (error.info ? <ErrorCard info={error.info} announce /> : <p role="alert" className="text-body text-error">{error.message}</p>)}
            <Button size="lg" className="w-full sm:w-auto sm:self-start" loading={submitting} onClick={submit}>
              {t("moment.submit")}
            </Button>
          </div>
        </li>
      </ol>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <p className="text-body text-text-secondary">{t("moment.saved", { title: projectTitle })}</p>
        <Button variant="ghost" className="self-start" disabled={submitting} onClick={onLater}>
          {t("moment.later")}
        </Button>
      </div>
    </section>
  );
};
