import React from "react";
import { appVersion, copyrightLine } from "../lib/appInfo";

/** One quiet line under every page (SP4 spec 4.2): who made the app and which version runs. Scrolls with the page. */
export const AppFooter: React.FC = () => (
  <footer className="mt-12 border-t border-border pt-4 text-center text-caption text-text-secondary">
    {`${copyrightLine()} \u00B7 v${appVersion()}`}
  </footer>
);
