# API Key Test Button Design Spec

## 1. Goal Description
Add "Test" buttons in the Settings page to allow users to verify their AI Provider API Key and Pexels API Key before using the main features. This prevents silent failures and helps users know if their quota/keys are valid.

## 2. Architecture & Backend changes
- **AI Provider Test Endpoint**: 
  - Add `POST /api/settings/test-ai` in `backend/main.py`.
  - The endpoint will accept JSON containing `provider`, `api_key`, `custom_base_url`, and `custom_model_name`.
  - It will call the existing `ping_provider()` function from `backend/ai_utils.py`.
  - If `ping_provider()` throws an exception, catch it and return `{ "status": "error", "message": str(e) }`.
  - Otherwise, return `{ "status": "success", "message": "API Key is valid!" }`.

- **Pexels Provider Test Endpoint**:
  - Create a new function `ping_pexels(api_key: str)` in `backend/broll.py`. This function will perform a simple `GET https://api.pexels.com/v1/search?query=test&per_page=1` request using the provided key. If it fails, raise an Exception.
  - Add `POST /api/settings/test-pexels` in `backend/main.py` which accepts the `pexels_api_key`.
  - It will call `ping_pexels()`. Handle errors similarly to the AI test endpoint.

## 3. Frontend & UI Changes
- Modify `src/components/settings/ProviderSection.tsx`.
- **UI State**:
  - Add `testAiStatus` (idle | loading | success | error) and `testAiMessage` (string).
  - Add `testPexelsStatus` (idle | loading | success | error) and `testPexelsMessage` (string).
- **Test Buttons**:
  - Render a small `Button` component next to or immediately below the AI Provider API Key input.
  - Render another `Button` next to/below the Pexels API Key input.
  - Both buttons will show a loading spinner when their respective status is `loading`.
- **Result Display**:
  - Below each input group, conditionally render a text element showing the `testMessage` if the status is `success` (green text) or `error` (red text).
  - The status and message should be cleared (reset to idle) whenever the user changes the corresponding API key input value.

## 4. Edge Cases & Error Handling
- **Empty Keys**: If the user clicks "Test" when the input is empty, the frontend should immediately show an error message ("API Key cannot be empty") without making a backend request.
- **Custom Provider**: For the AI provider test, if the provider is 'custom', the `custom_base_url` and `custom_model_name` must be passed to the backend endpoint.

## 5. Scope
This design only touches the Settings page and adds two very lightweight testing endpoints. It is small and focused enough to be implemented in a single pull request.
