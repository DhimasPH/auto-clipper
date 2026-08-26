# Auto Clipper Cloud - Dashboard UI/UX Revamp

## 1. Goal
Revamp the current 4-step wizard Cloud UI (located in `web/`) into a modern, enterprise-level, action-centric centralized Dashboard. The new design must not remove or degrade any existing backend functionality, especially the manual intervention features (AI prompt modification and JSON pasting).

## 2. Architecture & Layout
- **Global Layout:** A unified single-page dashboard interface replaces the linear `MainWizard` steps.
- **Header:** Minimalist header containing the Auto Clipper Cloud logo, Colab connection status indicator, and quick actions (e.g., Logout).
- **Theme:** Retain the elegant Dark Mode (using Tailwind neutral/zinc palettes), adopting a flatter, cleaner aesthetic to emphasize content and status. Lucide React icons will continue to be used.

## 3. The "Hero Input" Component (Job Creation)
- **Positioning:** Fixed at the top of the dashboard main area.
- **Input Field:** A large, prominent text input specifically for pasting the YouTube URL (or uploading a file, if supported).
- **Quick Configurations:** Instead of a separate wizard step, configuration options are presented as quick toggle pills directly below the URL input:
  - **Output Style/Format:** (e.g., Face Crop, Landscape, Canvas Blur).
  - **Subtitle Preset:** (e.g., Viral Pop, Podcast).
- **Call to Action:** A primary, highly visible "Generate Clips" button that becomes active once a valid URL is provided.
- **Advanced Options:** An expandable accordion or drawer labeled "Advanced Settings" hides complex configurations to keep the default view clean for most users.

## 4. History List & "Awaiting Manual" Flow (Replaces Wizard Steps 2 & 3)
- **Unified Job List:** Below the Hero Input, all jobs (pending, processing, awaiting manual, completed, failed) are displayed in a clean grid or list format. This allows users to monitor multiple jobs concurrently.
- **Handling Manual Intervention (`AWAITING_MANUAL`):**
  - When a job requires manual input (previously triggering Step 2 and 3), its card in the list is highlighted (e.g., amber border) with a clear call-to-action button: **"Action Required: Review AI Prompt & JSON"**.
  - **Review Modal/Drawer:** Clicking the action button opens a side drawer or modal containing:
    - The AI Prompt text (from Step 2).
    - The JSON paste textarea (from Step 3).
  - **Resuming:** Submitting the JSON via the modal calls the existing `resumeJobWithJson` API. The modal closes, and the job card in the dashboard updates its progress bar to show rendering status.

## 5. Result View (Replaces Wizard Step 4)
- Completed jobs display a **"View Clips"** button on their card.
- Clicking this opens the existing `ClipEditModal` (or a refined results modal) allowing users to view clips, download, trigger per-clip AI corrections, or initiate rerendering.

## 6. Technical Implementation Notes
- Modify `App.tsx` to remove the linear `currentStep` state machine.
- Refactor the `useJobPolling` hook logic if necessary to handle multiple active polling sessions, or keep it focused on the "active" job but visually represent other jobs via regular history polling. *(Note: currently `useJobPolling` handles one active job at a time. For a true multi-job dashboard, the polling logic may need to be generalized to poll a list of active jobs, or rely on the `HistoryList` periodic refetch)*.
- Ensure the `ac_wizard_current_step` local storage logic is safely removed and cleaned up.
