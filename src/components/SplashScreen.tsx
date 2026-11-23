import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";

interface SplashScreenProps {
  isInitializing: boolean;
  onFinish: () => void;
}

/**
 * Shown while saved settings load. A spinner with text, not a progress bar: the app cannot
 * know how far along it is, and a bar that fills up on a timer would be a made-up number.
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({ isInitializing, onFinish }) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (!isInitializing) onFinish();
  }, [isInitializing, onFinish]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg-primary px-4 text-center">
      <h1 className="text-page-title text-text-primary">Auto Clipper</h1>
      <div role="status" className="flex items-center gap-3 text-body text-text-secondary">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent" aria-hidden="true" />
        {t("startup.loading")}
      </div>
    </div>
  );
};
