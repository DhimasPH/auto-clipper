import React from "react";
import {
  Scissors,
  Clock,
  RefreshCw,
  X,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { apiCheckHealth } from "../api";

export interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const [status, setStatus] = React.useState<"connected" | "disconnected" | "reconnecting">("connected");
  const currentYear = new Date().getFullYear();

  const checkHealth = React.useCallback(async () => {
    try {
      const isOk = await apiCheckHealth();
      setStatus(isOk ? "connected" : "disconnected");
    } catch {
      setStatus("disconnected");
    }
  }, []);

  React.useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const reconnect = async () => {
    setStatus("reconnecting");
    await checkHealth();
  };

  const isConnected = status === "connected";
  const isReconnecting = status === "reconnecting";

  const statusLabel = {
    connected: "Connected to Colab",
    disconnected: "Colab Offline",
    reconnecting: "Reconnecting...",
  }[status];

  const renderNavContent = (isMobile: boolean) => (
    <>
      <div className="p-5 sm:p-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-pink-500 to-red-500">
            Auto Clipper
          </h1>
          <div className="mt-1 flex items-center">
            <span className="text-caption text-text-tertiary bg-bg-surface px-1.5 py-0.5 rounded border border-border">
              Cloud
            </span>
          </div>
        </div>
        {isMobile && onClose && (
          <button
            onClick={onClose}
            className="p-2 text-text-tertiary hover:text-text-primary rounded-xl hover:bg-bg-surface transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
        <div className="text-overline text-text-tertiary px-3 mb-2 mt-2">
          Menu
        </div>

        <NavLink
          to="/"
          onClick={() => {
            if (isMobile && onClose) onClose();
          }}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-body font-medium transition-colors ${
              isActive
                ? "bg-purple-50 text-purple-700 font-semibold border-l-4 border-purple-600 shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-surface border-l-4 border-transparent"
            }`
          }
        >
          <Scissors className="w-5 h-5" />
          Workspace
        </NavLink>

        <NavLink
          to="/history"
          onClick={() => {
            if (isMobile && onClose) onClose();
          }}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-body font-medium transition-colors ${
              isActive
                ? "bg-purple-50 text-purple-700 font-semibold border-l-4 border-purple-600 shadow-sm"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-surface border-l-4 border-transparent"
            }`
          }
        >
          <Clock className="w-5 h-5" />
          History
        </NavLink>
      </nav>

      <div className="p-4 mt-auto border-t border-border space-y-2 bg-slate-50/50">
        <div className="px-2 py-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex h-2.5 w-2.5">
              {isConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  isConnected
                    ? "bg-success"
                    : isReconnecting
                      ? "bg-accent animate-pulse"
                      : "bg-error"
                }`}
              ></span>
            </div>
            <span className="text-caption text-text-secondary font-medium">
              {statusLabel}
            </span>
          </div>

          {(status === "disconnected" || isReconnecting) && (
            <button
              type="button"
              onClick={reconnect}
              disabled={isReconnecting}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-caption font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isReconnecting ? "animate-spin" : ""}`}
              />
              {isReconnecting ? "Reconnecting..." : "Reconnect"}
            </button>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-border/60 flex flex-col items-center gap-1 text-caption text-text-tertiary">
          <span>&copy; {currentYear} Auto Clipper</span>
          <a
            href="https://auto-clipper.dhims.web.id"
            target="_blank"
            rel="noreferrer"
            className="hover:text-purple-600 transition-colors cursor-pointer"
          >
            Official Website
          </a>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden md:flex w-60 h-screen bg-bg-secondary border-r border-border flex-col transition-all duration-200 shrink-0">
        {renderNavContent(false)}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden animate-fadeIn"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white border-r border-border z-50 flex flex-col transition-transform duration-300 shadow-2xl md:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {renderNavContent(true)}
      </aside>
    </>
  );
};
