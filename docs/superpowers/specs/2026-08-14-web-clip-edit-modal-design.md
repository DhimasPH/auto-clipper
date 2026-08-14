# Web ClipEditModal Alignment Design

## Overview
The goal is to align the subtitle editing capabilities of the Web (Cloud) version of Auto Clipper with the Desktop version. Specifically, the Web version currently lacks the detailed "Word Grid" UI for editing individual words and relies on a direct API call for AI correction, which is incompatible with the Cloud environment (no Bring Your Own Key / BYOK).

This design implements a "Manual AI Assistant" flow and a "Word Grid" UI in the Web `ClipEditModal.tsx`.

## Architecture & UI Changes

### 1. Remove Existing Legacy UI
- Remove the current "AI Auto Correct" section that relies on `apiCorrectSubtitle` and direct API key injection.
- Remove the raw "Manual JSON Edit" textarea section.

### 2. Add AI Assistant (Manual Prompt)
A new accordion section replacing the old AI feature, containing:
- **Step 1 (Generate & Copy Prompt):** A read-only textarea displaying a generated prompt. The prompt includes instructions for the AI (e.g., ChatGPT/Claude) to correct spelling/grammar while maintaining the JSON structure. A "Copy" button is provided for convenience.
- **Step 2 (Paste AI Result):** A writable textarea where the user pastes the JSON response from the AI. Includes a "Apply Changes" button that safely parses the JSON (removing markdown wrappers like ` ```json `) and updates the state.

### 3. Add Word Grid UI
A new section below the AI Assistant:
- **Header:** Contains a Search bar to filter words, a Word Count display, and a "Reset" button that appears if there are unsaved changes.
- **Grid Layout:** A responsive grid displaying each word.
  - Each cell shows the `start` and `end` times.
  - Each cell contains a text input for the word itself.
  - Words that have been modified (compared to `originalWords`) are highlighted with a distinct background/border color.
  - Words matching the search query are highlighted.

### 4. Output Settings
The bottom section containing `OutputStyleSelector` and `SubtitlePresetBar` will remain exactly as it is, maintaining the simplified Web UI approach for styling.

## State Management
The `ClipEditModal` component will be updated with the following state:
- `words`: The current array of word objects being edited.
- `originalWords`: A deep copy of the initial `words` fetched from the API, used for the "Reset" feature and change detection.
- `search`: String for filtering the word grid.
- `isAiAssistantOpen`: Boolean for toggling the AI Assistant accordion.
- `pasteInput`: String holding the text pasted into the AI result textarea.

## Error Handling
- Safe JSON parsing when applying manual AI results, handling edge cases where the AI includes markdown code blocks.
- Alerts for invalid JSON formats.

## Testing & Verification
- Verify that copying the prompt and pasting a valid JSON result correctly updates the `words` state.
- Verify that editing a word in the grid updates the state and highlights the changed word.
- Verify that clicking "Save & Rerender" successfully triggers the rerender API with the correct payload structure.
