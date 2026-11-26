import React from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "./navItems";

/** Phones (< 768 px): the three destinations at the bottom, in reach of the thumb. */
export const BottomNav: React.FC = () => {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("nav.label")}
      className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg-secondary pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-3">
        {NAV_ITEMS.map(({ to, labelKey, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-[56px] flex-col items-center justify-center gap-1 text-label ${
                  isActive ? "text-accent font-semibold" : "text-text-secondary hover:text-text-primary"
                }`
              }
            >
              <Icon className="w-6 h-6" aria-hidden="true" />
              <span>{t(labelKey)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
