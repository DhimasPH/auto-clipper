import React, { useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppContext } from "../../App";
import { ROUTES } from "../../lib/routes";

/** A job runs and this page is not "Buat klip": say so, and link to the progress. */
export const RunningBar: React.FC = () => {
  const { t } = useTranslation();
  const ctx = useContext(AppContext);
  const { pathname } = useLocation();
  if (!ctx?.isRunning || pathname === ROUTES.create) return null;
  return (
    <div role="status" className="border-b border-border bg-accent-muted px-4 md:px-8">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <p className="text-body text-text-primary">{t("progress.running_bar")}</p>
        <Link to={ROUTES.create} className="inline-flex min-h-[44px] items-center text-body font-semibold text-accent underline">
          {t("progress.running_bar_link")}
        </Link>
      </div>
    </div>
  );
};
