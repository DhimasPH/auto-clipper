import React, { useEffect, useId, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { API_URL } from "../platform/backendUrl";
import { getAuthToken, setAuthToken, UNAUTHORIZED_EVENT } from "../platform/auth";
import { AUTH_CHANGED_EVENT, saveCloudToken } from "../platform/cloud/token";
import { Button } from "./ui/Button";
import { APP_NAME, SOCIAL_LINKS, copyrightLine } from "../lib/appInfo";

// Cloud only (Vercel + Colab): asks for the access token the Colab notebook prints.
// Moved from the former cloud frontend; texts are in src/locales (auth.*).

type AuthErrorKey = "auth.error_empty" | "auth.error_invalid" | "auth.error_offline" | "auth.error_expired";

export interface AuthGateProps {
  children: React.ReactNode;
}

const checkToken = () => axios.get(`${API_URL}/api/settings/whisper-models`);

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const { t } = useTranslation();
  const [token, setToken] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorKey, setErrorKey] = useState<AuthErrorKey | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const errorMsg = errorKey ? t(errorKey) : null;
  const inputId = useId();
  const errorId = useId();

  useEffect(() => {
    if (getAuthToken()) {
      checkToken()
        .then(() => setIsAuthenticated(true))
        .catch((err) => {
          if (err?.response?.status !== 401) setErrorKey("auth.error_offline");
          setIsAuthenticated(false);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }

    const handleUnauthorized = () => {
      saveCloudToken("");
      setIsAuthenticated(false);
      setErrorKey("auth.error_expired");
    };
    const handleAuthChanged = (e: Event) => {
      if ((e as CustomEvent<{ token: string }>).detail?.token) {
        setIsAuthenticated(true);
        setErrorKey(null);
      } else {
        setIsAuthenticated(false);
      }
    };

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
      window.removeEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = token.trim();
    if (!cleanToken) {
      setErrorKey("auth.error_empty");
      return;
    }
    setIsVerifying(true);
    setErrorKey(null);
    // Check the token before saving it, so the app does not open for a moment with a wrong one.
    setAuthToken(cleanToken);
    try {
      await checkToken();
      saveCloudToken(cleanToken);
      setToken("");
    } catch (err: any) {
      saveCloudToken("");
      setErrorKey(err?.response?.status === 401 ? "auth.error_invalid" : "auth.error_offline");
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-primary text-text-secondary">
        <div role="status" className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent" aria-hidden="true" />
          <span className="text-body">{t("auth.loading")}</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <main className="flex min-h-screen w-full items-start justify-center bg-bg-primary px-4 py-8 text-text-primary sm:items-center">
      <div className="flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/logo.png" alt={t("auth.logo_alt")} className="h-16 w-16 rounded-full object-cover" />
          <h1 className="text-page-title text-text-primary">{APP_NAME}</h1>
          <p className="text-body text-text-secondary">{t("app.tagline")}</p>
        </div>

        {/* The one focal point of this screen: the access code form. */}
        <form onSubmit={handleLogin} noValidate className="flex flex-col gap-4 rounded-card border border-border bg-bg-secondary p-5">
          <div>
            <h2 className="text-section-title text-text-primary">{t("auth.login_title")}</h2>
            <p className="mt-1 text-body text-text-secondary">{t("auth.login_subtitle")}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={inputId} className="text-label text-text-primary">
              {t("auth.token_placeholder")}
            </label>
            <div className="flex items-stretch gap-2">
              <input
                id={inputId}
                type={showPassword ? "text" : "password"}
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  if (errorKey) setErrorKey(null);
                }}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                aria-invalid={errorMsg ? true : undefined}
                aria-describedby={errorMsg ? errorId : undefined}
                className="min-h-[44px] w-full min-w-0 rounded-input border border-border-active bg-bg-secondary px-3 py-2 font-mono text-body text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <Button
                type="button"
                variant="outline"
                icon={showPassword ? EyeOff : Eye}
                aria-label={t(showPassword ? "auth.hide_code" : "auth.show_code")}
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              />
            </div>
            {errorMsg && (
              <p id={errorId} role="alert" className="text-body text-error">
                {errorMsg}
              </p>
            )}
          </div>
          <Button type="submit" size="lg" fullWidth loading={isVerifying}>
            {isVerifying ? t("auth.verifying") : t("auth.submit")}
          </Button>
          <p className="text-caption text-text-secondary">{t("auth.stored_locally")}</p>
        </form>

        <nav aria-label={t("auth.links_label")} className="flex flex-col gap-2">
          <h2 className="text-label text-text-secondary">{t("auth.links_label")}</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {SOCIAL_LINKS.map((link) => (
              <li key={link.id}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[44px] items-center gap-3 rounded-button border border-border bg-bg-secondary px-4 py-2 text-body text-text-primary hover:bg-bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <svg className="h-5 w-5 shrink-0 text-text-secondary" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d={link.iconPath} />
                  </svg>
                  <span className="min-w-0">
                    <span className="block font-medium">{link.name}</span>
                    {link.kind === "community" && <span className="block text-caption text-text-secondary">{t("about.discord_body")}</span>}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <p className="text-center text-caption text-text-secondary">{copyrightLine()}</p>
      </div>
    </main>
  );
};

export default AuthGate;
