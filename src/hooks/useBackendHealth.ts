import { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../App";

/** Polls the backend /health endpoint so the indicator self-heals on boot. */
export function useBackendHealth() {
  const [backendStatus, setBackendStatus] = useState("Checking...");

  useEffect(() => {
    let active = true;

    const check = (overrideUrl?: string) => {
      const url = overrideUrl || API_URL;
      axios
        .get(`${url}/health`, { timeout: 2500 })
        .then(() => {
          if (active) setBackendStatus("Connected");
        })
        .catch(() => {
          if (active) setBackendStatus("Disconnected");
        });
    };

    check();

    const handlePortFound = (e: any) => {
      const port = e?.detail;
      if (port) {
        check(`http://127.0.0.1:${port}`);
      } else {
        check();
      }
    };

    window.addEventListener("backend-port-found", handlePortFound as EventListener);
    const id = setInterval(() => check(), 3000);

    return () => {
      active = false;
      window.removeEventListener("backend-port-found", handlePortFound as EventListener);
      clearInterval(id);
    };
  }, []);

  return backendStatus;
}

