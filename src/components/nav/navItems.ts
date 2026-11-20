import { History, Scissors, Settings, type LucideIcon } from "lucide-react";
import { ROUTES } from "../../lib/routes";

export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  /** Only the exact path counts as active ("/" would otherwise match everything). */
  end: boolean;
}

// The icons sit next to their labels: on a phone they let people tell the three apart at a glance.
export const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.create, labelKey: "nav.create", icon: Scissors, end: true },
  { to: ROUTES.projects, labelKey: "nav.projects", icon: History, end: false },
  { to: ROUTES.settings, labelKey: "nav.settings", icon: Settings, end: false },
];
