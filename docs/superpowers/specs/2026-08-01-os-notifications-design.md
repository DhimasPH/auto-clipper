# OS Notifications Integration

## Problem
The user wants all in-app notifications to be mirrored as native OS notifications so they are aware of events even when the application is minimized or running in the background.

## Solution
Use the official Tauri plugin `@tauri-apps/plugin-notification` to trigger native OS notifications whenever the `notify()` function in `useToasts.ts` is called.

## Architecture & Components

### 1. Dependencies
- **Frontend**: Install `@tauri-apps/plugin-notification` via npm.
- **Backend**: Add `tauri-plugin-notification` to `Cargo.toml`.

### 2. Backend Configuration
- Modify `src-tauri/src/lib.rs` to initialize the plugin: `tauri_plugin_notification::init()`.
- Update capability files (e.g., `src-tauri/capabilities/default.json`) to allow notification permissions, if applicable for Tauri v2.

### 3. Frontend Integration
- **`useToasts.ts`**: Update the `notify` function to invoke the OS notification using `isPermissionGranted`, `requestPermission`, and `sendNotification` from `@tauri-apps/plugin-notification`. 
- **Cleanup**: Remove legacy web API `Notification` usages from `src/hooks/useClipJobs.ts` and `src/lib/notify.ts` to rely fully on the new implementation.

## Error Handling
- If the OS notification fails (e.g. permission denied or unsupported OS feature), the application will gracefully degrade and still show the in-app toast notification without crashing.

## Scope Check & Ambiguity
- **Scope**: Single isolated task. Suitable for one implementation plan.
- **Ambiguity**: Should OS notifications mirror the toast exactly? Yes, title will be "Auto Clipper" and the body will be the toast text. 
