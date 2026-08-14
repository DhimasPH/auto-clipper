import type { CreateJobPayload, JobResponse } from "./types/job";

export const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "https://be-clipper.dhims.web.id"
    : "http://localhost:8000");

export const STORAGE_AUTH_KEY = "AUTO_CLIPPER_WEB_TOKEN";
export const STORAGE_AUTH_LEGACY_KEY = "ac_web_token";

export function getAuthToken(): string {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem(STORAGE_AUTH_KEY) ||
    localStorage.getItem(STORAGE_AUTH_LEGACY_KEY) ||
    ""
  );
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  const trimmed = token.trim();
  if (trimmed) {
    localStorage.setItem(STORAGE_AUTH_KEY, trimmed);
    localStorage.setItem(STORAGE_AUTH_LEGACY_KEY, trimmed);
    window.dispatchEvent(new CustomEvent("ac_auth_changed", { detail: { token: trimmed } }));
  } else {
    clearAuthToken();
  }
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_AUTH_KEY);
  localStorage.removeItem(STORAGE_AUTH_LEGACY_KEY);
  window.dispatchEvent(new CustomEvent("ac_auth_changed", { detail: { token: "" } }));
}

export function hasAuthToken(): boolean {
  return Boolean(getAuthToken());
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers = new Headers(options.headers || {});
  
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent("ac_unauthorized"));
    throw new ApiError("Unauthorized: Token invalid or expired", 401);
  }

  let data: any = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg =
      (data && typeof data === "object" && (data.message || data.detail || data.error)) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(errorMsg, response.status, data);
  }

  return data as T;
}

export async function apiCheckHealth(): Promise<boolean> {
  try {
    const res = await apiFetch<{ status: string }>("/health");
    return res?.status === "ok";
  } catch {
    return false;
  }
}

export async function apiCreateJob(
  payload: CreateJobPayload
): Promise<{ status: string; job_id: string; message?: string }> {
  try {
    return await apiFetch<{ status: string; job_id: string; message?: string }>("/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    // If 404, fallback to /api/jobs
    if (err.status === 404) {
      return await apiFetch<{ status: string; job_id: string; message?: string }>("/api/jobs", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    throw err;
  }
}

export async function apiGetJob(jobId: string): Promise<JobResponse> {
  try {
    return await apiFetch<JobResponse>(`/jobs/${jobId}`);
  } catch (err: any) {
    if (err.status === 404) {
      return await apiFetch<JobResponse>(`/api/jobs/${jobId}`);
    }
    throw err;
  }
}

export async function apiResumeManualJob(
  jobId: string,
  jsonPayload: string
): Promise<{ status: string; job_id: string; message?: string }> {
  try {
    return await apiFetch<{ status: string; job_id: string; message?: string }>(
      `/jobs/${jobId}/resume-manual`,
      {
        method: "POST",
        body: JSON.stringify({ json_payload: jsonPayload }),
      }
    );
  } catch (err: any) {
    if (err.status === 404) {
      return await apiFetch<{ status: string; job_id: string; message?: string }>(
        `/api/jobs/${jobId}/resume-manual`,
        {
          method: "POST",
          body: JSON.stringify({ json_payload: jsonPayload }),
        }
      );
    }
    throw err;
  }
}

export async function apiCancelJob(jobId: string): Promise<{ status: string }> {
  try {
    return await apiFetch<{ status: string }>(`/jobs/${jobId}/cancel`, {
      method: "POST",
    });
  } catch (err: any) {
    if (err.status === 404) {
      return await apiFetch<{ status: string }>(`/api/jobs/${jobId}/cancel`, {
        method: "POST",
      });
    }
    throw err;
  }
}

export function getVideoStreamUrl(pathOrUrl: string, version?: number): string {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
    return pathOrUrl;
  }
  const vParam = version !== undefined && version !== 0 ? `&v=${version}` : "";
  return `${API_URL}/video?path=${encodeURIComponent(pathOrUrl)}${vParam}`;
}

export async function apiGetHistory(): Promise<JobResponse[]> {
  try {
    return await apiFetch<JobResponse[]>("/history");
  } catch (err: any) {
    if (err.status === 404) {
      return await apiFetch<JobResponse[]>("/api/history");
    }
    throw err;
  }
}

export async function apiDeleteHistory(jobId: string): Promise<{ status: string }> {
  const safeId = encodeURIComponent(jobId);
  try {
    return await apiFetch<{ status: string }>(`/history/${safeId}`, { method: "DELETE" });
  } catch (err: any) {
    if (err.status === 404) {
      return await apiFetch<{ status: string }>(`/api/history/${safeId}`, { method: "DELETE" });
    }
    throw err;
  }
}

export async function apiCreateRerenderJob(
  jobId: string,
  payload: any
): Promise<{ status: string; job_id: string; message?: string }> {
  const safeId = encodeURIComponent(jobId);
  try {
    return await apiFetch<{ status: string; job_id: string; message?: string }>(`/jobs/${safeId}/rerender`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    if (err.status === 404) {
      return await apiFetch<{ status: string; job_id: string; message?: string }>(`/api/jobs/${safeId}/rerender`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    throw err;
  }
}

export async function apiCreateRerunAiJob(
  jobId: string,
  payload: any
): Promise<{ status: string; job_id: string; message?: string }> {
  const safeId = encodeURIComponent(jobId);
  try {
    return await apiFetch<{ status: string; job_id: string; message?: string }>(`/jobs/${safeId}/rerun-ai`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    if (err.status === 404) {
      return await apiFetch<{ status: string; job_id: string; message?: string }>(`/api/jobs/${safeId}/rerun-ai`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    throw err;
  }
}

