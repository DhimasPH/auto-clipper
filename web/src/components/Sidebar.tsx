import React from "react";
import {
  Scissors,
  Clock,
  RefreshCw,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import { apiCheckHealth } from "../api";

export const Sidebar: React.FC = () => {
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

  return (
    <aside className="w-60 h-screen bg-bg-secondary border-r border-border flex flex-col transition-all duration-200 shrink-0">
      <div className="p-6">
        <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-pink-500 to-red-500">
          Auto Clipper
        </h1>
        <div className="mt-1 flex items-center">
          <span className="text-caption text-text-tertiary bg-bg-surface px-1.5 py-0.5 rounded">
            Cloud
          </span>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        <div className="text-overline text-text-tertiary px-3 mb-2 mt-4">
          Menu
        </div>

        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-body transition-colors ${
              isActive
                ? "bg-accent/10 text-accent font-medium border-l-2 border-accent"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated border-l-2 border-transparent"
            }`
          }
        >
          <Scissors className="w-5 h-5" />
          Workspace
        </NavLink>



        <NavLink
          to="/history"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-body transition-colors ${
              isActive
                ? "bg-accent/10 text-accent font-medium border-l-2 border-accent"
                : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated border-l-2 border-transparent"
            }`
          }
        >
          <Clock className="w-5 h-5" />
          History
        </NavLink>
      </nav>

      <div className="p-4 mt-auto border-t border-border space-y-2">
        <div className="mt-2 px-3 py-2 space-y-2">
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
            <span className="text-caption text-text-secondary">
              {statusLabel}
            </span>
          </div>

          {(status === "disconnected" || isReconnecting) && (
            <button
              type="button"
              onClick={reconnect}
              disabled={isReconnecting}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-caption font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isReconnecting ? "animate-spin" : ""}`}
              />
              {isReconnecting ? "Reconnecting..." : "Reconnect"}
            </button>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-border/30 flex flex-col items-center gap-1 text-caption text-text-tertiary">
          <span>&copy; {currentYear} Auto Clipper</span>
          <a
            href="https://auto-clipper.dhims.web.id"
            target="_blank"
            rel="noreferrer"
            className="hover:text-text-primary transition-colors cursor-pointer"
          >
            Official Website
          </a>
        </div>
      </div>
    </aside>
  );
};
