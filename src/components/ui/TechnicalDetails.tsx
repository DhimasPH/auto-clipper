import React from "react";
import { useTranslation } from "react-i18next";

/** The raw reason behind a plain message, folded under "Detail teknis" (spec 4.6). Renders nothing without text. */
export const TechnicalDetails: React.FC<{ text?: string | null }> = ({ text }) => {
  const { t } = useTranslation();
  if (!text) return null;
  return (
    <details className="text-body text-text-secondary">
      <summary className="flex min-h-[44px] cursor-pointer items-center rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        {t("common.technical_details")}
      </summary>
      <p className="break-words font-mono">{text}</p>
    </details>
  );
};
