# Download Bug Fix via Forced Attachment

## Problem Statement
The current implementation of the download button in `StepResult.tsx` uses `fetch()` to download the video as a Blob. This approach has multiple failure modes:
1. **Blob Memory Limit:** High-resolution videos or long clips consume too much RAM, causing mobile browsers to crash.
2. **Popup Blockers:** If `fetch` fails (e.g. due to Cloudflare CORS or memory limits), the fallback `window.open` is executed asynchronously and gets blocked by popup blockers.
3. **Cross-Origin Restrictions:** The `download` attribute on `<a>` tags is ignored for cross-origin URLs (e.g., Ngrok/Cloudflare tunnel), resulting in the browser navigating to the video and playing it inline instead of downloading.

## Proposed Solution
We will shift the responsibility of forcing the download to the backend by manipulating the `Content-Disposition` header.

### 1. Backend (`backend/main.py`)
- Modify the existing `@app.get("/video")` endpoint to accept an optional `dl: int = 0` query parameter.
- Accept an optional `title: str = None` query parameter to allow the frontend to specify a clean filename.
- If `dl == 1`, set the `Content-Disposition` header to `attachment; filename="{title_or_basename}"`.
- If `dl == 0` (default), keep it as `inline; filename="{basename}"` so the video player in the UI still works.

### 2. API Layer (`web/src/api.ts`)
- Add a new helper function `getDownloadUrl(path: string, version?: number, customName?: string)` that constructs the URL to the `/video` endpoint with `&dl=1` and `&title={encoded_name}`.

### 3. Frontend (`web/src/components/Steps/StepResult.tsx`)
- Refactor `handleDownloadClip(clip, index)`:
  - Remove `await fetch(...)` and the Blob conversion.
  - Generate a clean filename based on the clip description.
  - Get the download URL using `getDownloadUrl`.
  - Create a hidden `<a>` element, set its `href` to the download URL, and synchronously trigger a `.click()`.
  - Remove the loading state `setDownloadingIndex` since the browser's native download manager will immediately take over without blocking the UI thread.

## Error Handling
- Since we are delegating to the browser's download manager, network errors will be handled natively by the browser (showing "Network Error" in the downloads list) instead of crashing the UI.
- The UI will remain responsive immediately after the button is clicked.

## Testing Strategy
- Test downloading a clip on a desktop browser.
- Test downloading a clip on a mobile browser (simulated or real).
- Ensure the video player in the UI still correctly streams the video inline.
