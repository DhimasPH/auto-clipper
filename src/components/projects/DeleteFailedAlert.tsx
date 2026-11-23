import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/Button";

/** "Ya, hapus" did not go through: what happened, why, what to do, and a way to try again. */
export const DeleteFailedAlert: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-card border border-error p-4">
      <p className="m-0 text-body text-text-primary">{t("projects.delete_failed")}</p>
      <Button variant="outline" onClick={onRetry}>
        {t("projects.delete_retry")}
      </Button>
    </div>
  );
};
