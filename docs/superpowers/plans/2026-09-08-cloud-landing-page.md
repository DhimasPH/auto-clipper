# Cloud Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Cloud UI (`web/`) entry page look exactly like the Desktop `LandingPage.tsx` (light theme, 3D character, animations) with an added login modal.

**Architecture:** We will copy the Tailwind animations from the desktop `tailwind.config.js` to the web `tailwind.config.js`. We will add the `Outfit` font to `web/index.html`. Finally, we will refactor `web/src/components/AuthGate.tsx` to render the exact markup of the desktop Landing Page, while maintaining its `token` state and adding a modal for the token input.

**Tech Stack:** React, Tailwind CSS

---

### Task 1: Update Web HTML and Tailwind Config

**Files:**
- Modify: `web/index.html`
- Modify: `web/tailwind.config.js`

- [ ] **Step 1: Add Outfit font to index.html**
Modify `web/index.html` to include the `Outfit` font. Append it to the existing Google Fonts link or add a new one.

```html
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Update tailwind.config.js**
Modify `web/tailwind.config.js` to include the custom animations and font family.

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'gradient-x': 'gradient-x 3s ease infinite',
        'mesh': 'mesh 15s ease infinite',
        'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          },
        },
        'mesh': {
          '0%, 100%': {
            'background-size': '400% 400%',
            'background-position': '0% 50%'
          },
          '50%': {
            'background-size': '400% 400%',
            'background-position': '100% 50%'
          }
        },
        'fade-in-up': {
          '0%': {
            opacity: '0',
            transform: 'translateY(20px)'
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)'
          }
        }
      }
    },
  },
  plugins: [],
}
```

- [ ] **Step 3: Commit (if auto_commit enabled)**

Check `.agent/config.yml` for `auto_commit` setting.

If `auto_commit: true` (default when absent):
```bash
git add web/index.html web/tailwind.config.js
git commit -m "chore: update tailwind config and fonts for cloud landing page"
```

If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."

---

### Task 2: Refactor AuthGate Component

**Files:**
- Modify: `web/src/components/AuthGate.tsx`

- [ ] **Step 1: Rewrite AuthGate.tsx to match LandingPage.tsx**

Modify `web/src/components/AuthGate.tsx`. The file should look like this (incorporating the UI from `LandingPage.tsx` and adding a modal for login):

```tsx
import React, { useState, useEffect } from "react";
import { KeyRound, Eye, EyeOff, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
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
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  useEffect(() => {
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
      setAuthToken(cleanToken);
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

  const handleExternalLink = (
    e: React.MouseEvent<HTMLAnchorElement>,
    url: string,
  ) => {
    e.preventDefault();
    window.open(url, '_blank');
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-100 via-purple-50 to-pink-100 animate-mesh text-gray-900 w-full relative">
      <div className="w-full max-w-md bg-white/95 rounded-[2.5rem] shadow-2xl overflow-hidden p-6 sm:p-8 flex flex-col items-center relative z-10">
        <div className="flex flex-col items-center mb-8 animate-fade-in-up">
          <img
            src="/character.png"
            alt="Faceless 3D Character"
            className="w-32 h-32 object-cover mb-2 animate-float drop-shadow-xl rounded-full"
          />
          <img
            src="/logo.png"
            alt="Auto Clipper Logo"
            className="w-16 h-16 rounded-full object-cover shadow-md ring-2 ring-gray-50 mb-4 -mt-6 z-10"
          />
          <h1 className="text-3xl font-extrabold mb-1 text-center tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-pink-500 to-red-500 animate-gradient-x">
            Auto Clipper Cloud
          </h1>
          <p className="text-gray-500 text-center text-sm font-medium">
            Automated AI video generator
          </p>
        </div>

        <div className="w-full mb-6">
          <button
            onClick={() => setIsLoginModalOpen(true)}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 ease-out animate-fade-in-up flex items-center justify-center gap-2"
          >
            Login to Workspace
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        <div className="w-full flex flex-col gap-3">
          {/* GitHub Link for example */}
          <a
            href="https://github.com/DhimasPH/auto-clipper"
            onClick={(e) => handleExternalLink(e, "https://github.com/DhimasPH/auto-clipper")}
            className="group w-full flex items-center justify-between px-6 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 hover:scale-105 hover:bg-gray-900 hover:border-gray-900 transition-all duration-300 ease-out animate-fade-in-up opacity-0"
            style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
          >
            <span className="font-semibold text-gray-700 group-hover:text-white transition-colors">
              GitHub
            </span>
            <svg
              className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
          </a>
        </div>

        <div className="mt-8">
          <p className="text-xs text-gray-400 font-medium tracking-wide">
            &copy; {new Date().getFullYear()} Auto Clipper
          </p>
        </div>
      </div>

      {isLoginModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 w-full max-w-sm relative animate-fade-in-up">
            <button 
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Login</h2>
              <p className="text-sm text-gray-500">Enter your Colab access token</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="AUTO_CLIPPER_WEB_TOKEN"
                  autoFocus
                  className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifying || !token.trim()}
                className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Unlock</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-400">
              <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
              <span>Token is stored locally</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Commit (if auto_commit enabled)**

Check `.agent/config.yml` for `auto_commit` setting.

If `auto_commit: true` (default when absent):
```bash
git add web/src/components/AuthGate.tsx
git commit -m "feat: redesign cloud landing page and add login modal"
```

If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."

---
