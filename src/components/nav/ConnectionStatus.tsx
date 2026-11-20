import React from "react";
import { useTranslation } from "react-i18next";
import { useBackendStatus } from "../../hooks/useBackendStatus";

const DOT: Record<string, string> = {
  connected: "bg-success",
  connecting: "bg-text-secondary",
  reconnecting: "bg-warning",
  disconnected: "bg-error",
};

/** Header: a small dot plus a word (the word carries the meaning, the dot only marks it). */
export const ConnectionStatus: React.FC = () => {
  const { t } = useTranslation();
  const { status } = useBackendStatus();
  return (
    <p role="status" className="flex items-center gap-2 text-label text-text-secondary">
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${DOT[status]}`} />
      {t(`banner.status_${status}`)}
    </p>
  );
};
