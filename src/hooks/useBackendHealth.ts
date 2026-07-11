import { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../App";

/** Polls the backend /health endpoint so the indicator self-heals on boot. */
export function useBackendHealth() {
  const [backendStatus, setBackendStatus] = useState("Checking...");

  useEffect(() => {
    let active = true;
    const check = () => {
      axios
        .get(`${API_URL}/health`, { timeout: 2500 })
        .then(() => active && setBackendStatus("Connected"))
        .catch(() => active && setBackendStatus("Disconnected"));
    };
    check();
    const id = setInterval(check, 3000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return backendStatus;
}
