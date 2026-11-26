import React from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "../ui/Badge";
import type { ProjectStatusKey } from "../../lib/projectStatus";

const VARIANT: Record<ProjectStatusKey, "success" | "error" | "neutral"> = {
  done: "success",
  failed: "error",
  awaiting: "neutral",
  running: "neutral",
  queued: "neutral",
  cancelled: "neutral",
};

/** A project's status in plain words (spec 4.5). */
export const ProjectStatusBadge: React.FC<{ statusKey: ProjectStatusKey }> = ({ statusKey }) => {
  const { t } = useTranslation();
  return <Badge variant={VARIANT[statusKey]}>{t(`projects.status_${statusKey}`)}</Badge>;
};
