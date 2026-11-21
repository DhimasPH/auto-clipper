import React from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import type { StepState } from "../../lib/createFlow";

const STEP_KEYS = ["create.step_video", "create.step_prepare", "create.step_choose", "create.step_clips"];

/** 1 Video → 2 Siapkan → 3 Pilih momen → 4 Klip (spec 4.2). On a phone only the active step shows its name. */
export const StepIndicator: React.FC<{ states: StepState[] }> = ({ states }) => {
  const { t } = useTranslation();
  return (
    <ol aria-label={t("create.steps_label")} className="flex items-center gap-2">
      {STEP_KEYS.map((key, i) => {
        const state = states[i];
        return (
          <li key={key} aria-current={state === "active" ? "step" : undefined} className="flex min-w-0 items-center gap-2">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-label ${
                state === "active"
                  ? "bg-accent text-on-accent"
                  : state === "done"
                    ? "bg-accent-muted text-accent"
                    : "border border-border-active text-text-secondary"
              }`}
            >
              {state === "done" ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
            </span>
            <span className={`text-label ${state === "active" ? "font-semibold text-text-primary" : "sr-only sm:not-sr-only text-text-secondary"}`}>
              {t(key)}
              {state === "done" && <span className="sr-only">{t("create.step_done_sr")}</span>}
            </span>
            {i < STEP_KEYS.length - 1 && <span aria-hidden="true" className="h-px w-4 shrink-0 bg-border-active sm:w-6" />}
          </li>
        );
      })}
    </ol>
  );
};
