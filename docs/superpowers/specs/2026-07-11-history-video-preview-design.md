# History Page Video Preview Design

## Problem Context
Currently, the History (Riwayat) page only displays generated clips as simple "Download" and "Open Folder" buttons. The user wants to see actual video previews for these clips, just like the ones shown in the Generated Clips section on the Workspace page.

## Proposed Solution
We will reuse the `ClipCard` component in the `HistoryPage.tsx` to display the clips.

### Component Usage
- Import `ClipCard` into `src/pages/HistoryPage.tsx`.
- Replace the existing `a` (download) and `Button` (open folder) rendering with `ClipCard` instances.
- The `ClipCard` component already handles the video preview (aspect 9:16), download button, and open folder button.

### Data Mapping
- Map the `job.result_clips` array into the format expected by `ClipCard`.
- `videoSrc` prop will be passed as `(path) => \`\${API_URL}/video?path=\${encodeURIComponent(path)}\``.
- Provide required props like `clip` (type `Clip`), `index`, and `mode="ai"`.

### Layout
- Use a horizontally scrollable container for the clips: `flex gap-6 overflow-x-auto py-4`.
- This ensures the history page doesn't grow excessively long vertically when there are many clips per job.
