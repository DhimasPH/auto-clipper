// The backend address. A live binding: modules that import API_URL always read the current value.
// App.tsx re-exports both names so existing `import { API_URL } from "../App"` keeps working.

export let API_URL = "http://127.0.0.1:8000";

export function setApiUrl(url: string): void {
  API_URL = url.replace(/\/+$/, "");
}
