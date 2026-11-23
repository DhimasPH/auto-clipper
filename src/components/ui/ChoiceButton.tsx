import React from "react";
import { Check } from "lucide-react";

export interface ChoiceButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  selected: boolean;
  label: React.ReactNode;
  /** One short line under the label. */
  description?: React.ReactNode;
}

/**
 * One option of a "pick one" row (shape, blur, font, size). Selected = accent edge, tinted
 * background and a check mark, so the state does not rest on colour alone (WCAG 1.4.1).
 */
export const ChoiceButton: React.FC<ChoiceButtonProps> = ({ selected, label, description, className = "", ...props }) => (
  <button
    type="button"
    aria-pressed={selected}
    className={`flex min-h-[44px] w-full items-start justify-between gap-2 rounded-button border px-3 py-2 text-left text-body text-text-primary transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary disabled:cursor-not-allowed disabled:opacity-50 ${
      selected ? "border-accent bg-accent-muted font-medium" : "border-border-active bg-bg-secondary hover:bg-bg-surface"
    } ${className}`}
    {...props}
  >
    <span className="min-w-0">
      <span className="block break-words">{label}</span>
      {description && <span className="mt-0.5 block text-caption font-normal text-text-secondary">{description}</span>}
    </span>
    {selected && <Check className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />}
  </button>
);
