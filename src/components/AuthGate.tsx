import React, { useEffect, useId, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { API_URL } from "../platform/backendUrl";
import { getAuthToken, setAuthToken, UNAUTHORIZED_EVENT } from "../platform/auth";
import { AUTH_CHANGED_EVENT, saveCloudToken } from "../platform/cloud/token";
import { Button } from "./ui/Button";

// Cloud only (Vercel + Colab): asks for the access token the Colab notebook prints.
// Moved from the former cloud frontend; texts are in src/locales (auth.*).

interface CommunityLink {
  href: string;
  name?: string;
  nameKey?: string;
  bodyKey?: string;
  /** The brand mark (simple-icons path): people find their app by its logo faster than by name. */
  path: string;
}

const LINKS: CommunityLink[] = [
  { href: "https://www.tiktok.com/@auto_clippers", name: "TikTok", path: "M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" },
  { href: "https://www.youtube.com/@autoclipperss", name: "YouTube", path: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
  { href: "https://www.instagram.com/auto_clipperss/", name: "Instagram", path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" },
  { href: "https://github.com/DhimasPH/auto-clipper", name: "GitHub", path: "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" },
  { href: "https://www.facebook.com/people/Auto-Clipper/61592220556873/", name: "Facebook", path: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" },
  { href: "https://discord.gg/5AvvA682UN", nameKey: "auth.discord_title", bodyKey: "auth.discord_body", path: "M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" },
  { href: "https://trakteer.id/dhiimsph", name: "Trakteer", path: "M22.56 5.86a3.86 3.86 0 0 0-3.32-1.92h-1.6V3.81a1.27 1.27 0 0 0-1.27-1.27H3.45A1.27 1.27 0 0 0 2.18 3.81v10.57A4.65 4.65 0 0 0 6.83 19h8.34a4.65 4.65 0 0 0 4.65-4.65v-.42h.85a3.86 3.86 0 0 0 3.86-3.86v-1a3.86 3.86 0 0 0-1.97-3.21zM18.55 14.35a3.38 3.38 0 0 1-3.38 3.38H6.83a3.38 3.38 0 0 1-3.38-3.38V3.81h11.72v10.54zM23.25 9.07a2.59 2.59 0 0 1-2.59 2.59h-2.11V5.21h2.11a2.59 2.59 0 0 1 2.59 2.59v1z" },
];

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
          <h1 className="text-page-title text-text-primary">Auto Clipper</h1>
          <p className="text-body text-text-secondary">{t("auth.tagline")}</p>
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
          <Button type="submit" size="lg" fullWidth loading={isVerifying} disabled={!token.trim()}>
            {isVerifying ? t("auth.verifying") : t("auth.submit")}
          </Button>
          <p className="text-caption text-text-secondary">{t("auth.stored_locally")}</p>
        </form>

        <nav aria-label={t("auth.links_label")} className="flex flex-col gap-2">
          <h2 className="text-label text-text-secondary">{t("auth.links_label")}</h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[44px] items-center gap-3 rounded-button border border-border bg-bg-secondary px-4 py-2 text-body text-text-primary hover:bg-bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <svg className="h-5 w-5 shrink-0 text-text-secondary" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d={link.path} />
                  </svg>
                  <span className="min-w-0">
                    <span className="block font-medium">{link.name ?? t(link.nameKey!)}</span>
                    {link.bodyKey && <span className="block text-caption text-text-secondary">{t(link.bodyKey)}</span>}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <p className="text-center text-caption text-text-secondary">&copy; {new Date().getFullYear()} Auto Clipper</p>
      </div>
    </main>
  );
};

export default AuthGate;
