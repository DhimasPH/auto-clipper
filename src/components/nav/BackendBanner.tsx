import React from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { useBackendStatus } from "../../hooks/useBackendStatus";
import { platform } from "../../platform";
import { Button } from "../ui/Button";

/** Spec 5: the backend is gone. What happened, why (per platform), and the one thing to try. */
export const BackendBanner: React.FC = () => {
  const { t } = useTranslation();
  const { status, reconnect } = useBackendStatus();
  if (status !== "disconnected" && status !== "reconnecting") return null;
  return (
    <div role="alert" className="border-b border-border bg-bg-surface px-4 py-3 md:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-body font-semibold text-text-primary">{t("banner.lost_title")}</p>
          <p className="text-body text-text-primary">{t(`banner.lost_${platform().caps.keepOpen}`)}</p>
        </div>
        <Button variant="outline" icon={RefreshCw} loading={status === "reconnecting"} onClick={() => void reconnect()}>
          {t("banner.reconnect")}
        </Button>
      </div>
    </div>
  );
};
