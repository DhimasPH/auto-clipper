import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { ErrorCard } from "./ErrorCard";
import { localErrorInfo, type LocalErrorCode } from "../lib/localErrors";
import { getAuthToken, UNAUTHORIZED_EVENT } from "../platform/auth";
import { API_URL } from "../platform/backendUrl";
import {
  BACKEND_LOST_EVENT,
  gateStateAfterCheck,
  initialGateState,
  localEnv,
  type LocalGateState,
} from "../platform/local/token";

// Local web only (spec 5): the page needs the token the launcher put in the address,
// and the server lives only while the "Auto Clipper Web" window is open.

const CARDS: Record<"no_token" | "token_expired" | "server_closed", LocalErrorCode> = {
  no_token: "LOCAL_TOKEN_MISSING",
  token_expired: "LOCAL_TOKEN_EXPIRED",
  server_closed: "LOCAL_SERVER_CLOSED",
};

export const LocalGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [state, setState] = useState<LocalGateState>(() => initialGateState(localEnv(), getAuthToken() || ""));

  const runCheck = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/settings/whisper-models`, { timeout: 15000 });
      setState(gateStateAfterCheck(res.status));
    } catch (err) {
      const status = (err as { response?: { status?: number } } | null)?.response?.status;
      setState(gateStateAfterCheck(typeof status === "number" ? status : null));
    }
  }, []);

  useEffect(() => {
    if (state === "checking") void runCheck();
  }, [state, runCheck]);

  useEffect(() => {
    const expired = () => setState("token_expired");
    const lost = () => setState("server_closed");
    window.addEventListener(UNAUTHORIZED_EVENT, expired);
    window.addEventListener(BACKEND_LOST_EVENT, lost);
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, expired);
      window.removeEventListener(BACKEND_LOST_EVENT, lost);
    };
  }, []);

  if (state === "ok") return <>{children}</>;

  if (state === "checking") {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center text-text-secondary">
        <div className="flex flex-col items-center gap-3" role="status">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" aria-hidden="true" />
          <span className="text-caption">{t("local_gate.checking")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6">
      <ErrorCard
        info={localErrorInfo(CARDS[state])}
        handlers={{ retry: () => setState("checking") }}
        announce
        className="w-full max-w-lg"
      />
    </div>
  );
};
