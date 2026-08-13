import React from "react";
import { open } from "@tauri-apps/plugin-shell";

interface LandingPageProps {
  onEnter: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter }) => {
  const handleExternalLink = async (
    e: React.MouseEvent<HTMLAnchorElement>,
    url: string,
  ) => {
    e.preventDefault();
    try {
      await open(url);
    } catch (err) {
      console.error("Failed to open URL", err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-100 via-purple-50 to-pink-100 animate-mesh text-gray-900 w-full">
      {/* Main Card Container */}
      <div className="w-full max-w-md bg-white/95 rounded-[2.5rem] shadow-2xl overflow-hidden p-8 flex flex-col items-center">
        {/* Profile Header */}
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
            Auto Clipper
          </h1>
          <p className="text-gray-500 text-center text-sm font-medium">
            The smartest way to automate your video clips.
          </p>
        </div>

        {/* Enter App Button */}
        <div className="w-full mb-6">
          <button
            onClick={onEnter}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 ease-out animate-fade-in-up flex items-center justify-center gap-2"
          >
            Enter to Workspace
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </button>
        </div>

        {/* Social Links Container */}
        <div className="w-full flex flex-col gap-3">
          {/* TikTok */}
          <a
            href="https://www.tiktok.com/@auto_clippers"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) =>
              handleExternalLink(e, "https://www.tiktok.com/@auto_clippers")
            }
            className="group w-full flex items-center justify-between px-6 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 hover:scale-105 hover:bg-black hover:border-black transition-all duration-300 ease-out animate-fade-in-up opacity-0"
            style={{ animationDelay: "100ms", animationFillMode: "forwards" }}
          >
            <span className="font-semibold text-gray-700 group-hover:text-white transition-colors">
              TikTok
            </span>
            <svg
              className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
            </svg>
          </a>

          {/* YouTube */}
          <a
            href="https://www.youtube.com/@autoclipperss"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) =>
              handleExternalLink(e, "https://www.youtube.com/@autoclipperss")
            }
            className="group w-full flex items-center justify-between px-6 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 hover:scale-105 hover:bg-red-600 hover:border-red-600 transition-all duration-300 ease-out animate-fade-in-up opacity-0"
            style={{ animationDelay: "200ms", animationFillMode: "forwards" }}
          >
            <span className="font-semibold text-gray-700 group-hover:text-white transition-colors">
              YouTube
            </span>
            <svg
              className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
          </a>

          {/* Instagram */}
          <a
            href="https://www.instagram.com/auto_clipperss/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) =>
              handleExternalLink(e, "https://www.instagram.com/auto_clipperss/")
            }
            className="group w-full flex items-center justify-between px-6 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 hover:scale-105 hover:bg-pink-600 hover:border-pink-600 transition-all duration-300 ease-out animate-fade-in-up opacity-0"
            style={{ animationDelay: "300ms", animationFillMode: "forwards" }}
          >
            <span className="font-semibold text-gray-700 group-hover:text-white transition-colors">
              Instagram
            </span>
            <svg
              className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
          </a>

          {/* GitHub */}
          <a
            href="https://github.com/DhimasPH/auto-clipper"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) =>
              handleExternalLink(e, "https://github.com/DhimasPH/auto-clipper")
            }
            className="group w-full flex items-center justify-between px-6 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 hover:scale-105 hover:bg-gray-900 hover:border-gray-900 transition-all duration-300 ease-out animate-fade-in-up opacity-0"
            style={{ animationDelay: "400ms", animationFillMode: "forwards" }}
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

          {/* Facebook */}
          <a
            href="https://www.facebook.com/people/Auto-Clipper/61592220556873/"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) =>
              handleExternalLink(
                e,
                "https://www.facebook.com/people/Auto-Clipper/61592220556873/",
              )
            }
            className="group w-full flex items-center justify-between px-6 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 hover:scale-105 hover:bg-blue-600 hover:border-blue-600 transition-all duration-300 ease-out animate-fade-in-up opacity-0"
            style={{ animationDelay: "500ms", animationFillMode: "forwards" }}
          >
            <span className="font-semibold text-gray-700 group-hover:text-white transition-colors">
              Facebook
            </span>
            <svg
              className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </a>

          {/* Discord Community */}
          <a
            href="https://discord.gg/5AvvA682UN"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) =>
              handleExternalLink(e, "https://discord.gg/5AvvA682UN")
            }
            className="group w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 hover:scale-[1.02] hover:bg-[#5865F2] hover:border-[#5865F2] transition-all duration-300 ease-out animate-fade-in-up opacity-0"
            style={{ animationDelay: "600ms", animationFillMode: "forwards" }}
          >
            <div className="flex flex-col text-left pr-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-700 group-hover:text-white transition-colors">
                  Discord Community
                </span>
                <span className="text-[10px] font-semibold bg-indigo-50 text-[#5865F2] group-hover:bg-white/20 group-hover:text-white px-2 py-0.5 rounded-full transition-colors">
                  Community
                </span>
              </div>
              <p className="text-xs text-gray-500 group-hover:text-white/90 transition-colors leading-relaxed">
                Report bugs, request features, showcase content & ideas, and
                chat with fellow clippers.
              </p>
            </div>
            <div className="flex-shrink-0 p-2 rounded-xl bg-gray-50 group-hover:bg-white/20 transition-colors">
              <svg
                className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </div>
          </a>

          {/* Trakteer */}
          <a
            href="https://trakteer.id/dhiimsph"
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) =>
              handleExternalLink(e, "https://trakteer.id/dhiimsph")
            }
            className="group w-full flex items-center justify-between px-6 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 hover:scale-105 hover:bg-[#BE1E2D] hover:border-[#BE1E2D] transition-all duration-300 ease-out animate-fade-in-up opacity-0"
            style={{ animationDelay: "700ms", animationFillMode: "forwards" }}
          >
            <span className="font-semibold text-gray-700 group-hover:text-white transition-colors">
              Trakteer
            </span>
            <svg
              className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M22.56 5.86a3.86 3.86 0 0 0-3.32-1.92h-1.6V3.81a1.27 1.27 0 0 0-1.27-1.27H3.45A1.27 1.27 0 0 0 2.18 3.81v10.57A4.65 4.65 0 0 0 6.83 19h8.34a4.65 4.65 0 0 0 4.65-4.65v-.42h.85a3.86 3.86 0 0 0 3.86-3.86v-1a3.86 3.86 0 0 0-1.97-3.21zM18.55 14.35a3.38 3.38 0 0 1-3.38 3.38H6.83a3.38 3.38 0 0 1-3.38-3.38V3.81h11.72v10.54zM23.25 9.07a2.59 2.59 0 0 1-2.59 2.59h-2.11V5.21h2.11a2.59 2.59 0 0 1 2.59 2.59v1z" />
            </svg>
          </a>
        </div>

        {/* Footer */}
        <div className="mt-8">
          <p className="text-xs text-gray-400 font-medium tracking-wide">
            &copy; {new Date().getFullYear()} Auto Clipper
          </p>
        </div>
      </div>
    </div>
  );
};
