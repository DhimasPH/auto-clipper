import React from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "./navItems";

/** From 768 px: a slim bar with the same three destinations (labels under the icon, beside it from 1024 px). */
export const SideNav: React.FC = () => {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("nav.label")}
      className="hidden md:flex sticky top-0 h-dvh w-24 lg:w-56 shrink-0 flex-col gap-2 border-r border-border bg-bg-secondary px-2 py-4 lg:px-3"
    >
      <p className="hidden lg:block px-3 pb-4 text-card-title text-text-primary">Auto Clipper</p>
      {NAV_ITEMS.map(({ to, labelKey, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-h-[56px] flex-col lg:flex-row items-center lg:justify-start justify-center gap-1 lg:gap-3 rounded-button px-2 lg:px-3 text-label lg:text-body ${
              isActive ? "bg-accent-muted text-accent font-semibold" : "text-text-secondary hover:bg-bg-surface hover:text-text-primary"
            }`
          }
        >
          <Icon className="w-6 h-6 shrink-0" aria-hidden="true" />
          <span>{t(labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  );
};
