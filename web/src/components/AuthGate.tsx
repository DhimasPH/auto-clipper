import React, { useState, useEffect } from "react";
import { KeyRound, Lock, Eye, EyeOff, Sparkles, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { getAuthToken, setAuthToken, clearAuthToken, apiFetch } from "../api";

export interface AuthGateProps {
  children: React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [token, setToken] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  useEffect(() => {
    // Check initial token
    const existingToken = getAuthToken();
    if (existingToken) {
      apiFetch("/api/settings/whisper-models")
        .then(() => {
          setIsAuthenticated(true);
        })
        .catch((err: any) => {
          if (err.status !== 401) {
            setErrorMsg("Cannot connect to backend. Server might be offline.");
          }
          setIsAuthenticated(false);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }

    // Listen for custom auth events
    const handleUnauthorized = () => {
      clearAuthToken();
      setIsAuthenticated(false);
      setErrorMsg("Session expired or token invalid. Please re-enter your access token.");
    };

    const handleAuthChanged = (e: Event) => {
      const customEvent = e as CustomEvent<{ token: string }>;
      if (customEvent.detail?.token) {
        setIsAuthenticated(true);
        setErrorMsg(null);
      } else {
        setIsAuthenticated(false);
      }
    };

    window.addEventListener("ac_unauthorized", handleUnauthorized);
    window.addEventListener("ac_auth_changed", handleAuthChanged);

    return () => {
      window.removeEventListener("ac_unauthorized", handleUnauthorized);
      window.removeEventListener("ac_auth_changed", handleAuthChanged);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = token.trim();
    if (!cleanToken) {
      setErrorMsg("Please enter your access token");
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      // Save token first
      setAuthToken(cleanToken);
      // Verify token with an authenticated endpoint
      await apiFetch("/api/settings/whisper-models");
      setIsAuthenticated(true);
      setToken("");
    } catch (err: any) {
      setErrorMsg(err.status === 401 ? "Invalid Access Token." : (err?.message || "Failed to authenticate with backend"));
      clearAuthToken();
    } finally {
      setIsVerifying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          <span className="text-xs font-mono">Initializing Auto Clipper...</span>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center px-4 sm:px-6 py-12 selection:bg-amber-400 selection:text-neutral-950 antialiased">
      {/* Background Decorative Blur */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <div className="w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-3xl" />
        <div className="w-[400px] h-[400px] bg-sky-500/5 rounded-full blur-3xl -translate-x-32 -translate-y-32" />
      </div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-amber-400/10 border border-amber-400/20 text-amber-400 mb-2 shadow-inner">
            <Lock className="w-7 h-7" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-neutral-100 font-sans">
              Auto Clipper <span className="text-amber-400 font-normal">Cloud</span>
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-800 text-amber-400 border border-amber-400/20">
              <Sparkles className="w-2.5 h-2.5" />
              v1.0
            </span>
          </div>
          <p className="text-xs text-neutral-400 max-w-xs mx-auto">
            Enter your secret access token to connect to your Colab GPU instance
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-neutral-900/80 backdrop-blur-md border border-neutral-800/90 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-5">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="access-token"
                className="text-xs font-semibold text-neutral-300 flex items-center justify-between"
              >
                <span>Access Token</span>
                <span className="text-[11px] font-normal text-neutral-500 font-mono">
                  AUTO_CLIPPER_WEB_TOKEN
                </span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="access-token"
                  type={showPassword ? "text" : "password"}
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Enter your static secret token..."
                  autoFocus
                  autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-2.5 bg-neutral-950/80 border border-neutral-800 rounded-xl text-neutral-100 placeholder:text-neutral-600 text-sm focus:outline-none focus:border-amber-400/80 focus:ring-1 focus:ring-amber-400/50 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-500 hover:text-neutral-300 transition-colors"
                  aria-label={showPassword ? "Hide token" : "Show token"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-xl text-red-300 text-xs flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying || !token.trim()}
              className="w-full py-2.5 px-4 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-950 font-semibold text-sm rounded-xl transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-amber-400/10 active:scale-[0.99]"
            >
              {isVerifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-neutral-950/30 border-t-neutral-950 rounded-full animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <span>Unlock Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-3 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Saved locally in browser</span>
            </div>
            <span className="font-mono">Encrypted Session</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthGate;
