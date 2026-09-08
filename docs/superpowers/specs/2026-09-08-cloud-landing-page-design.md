# Auto Clipper Cloud - Landing Page & Login Design

## Overview
Replace the current dark-themed `AuthGate` in the Web UI (`web/src/components/AuthGate.tsx`) with a light-themed `LandingPage` that matches the Desktop UI. The new design will include a popup modal for token-based authentication and will be optimized for mobile devices.

## Architecture & Components

### 1. Tailwind Configuration Updates
- **File**: `web/tailwind.config.js`
- **Changes**: Copy custom keyframes (`float`, `gradient-x`, `mesh`, `fade-in-up`) and animations from the Desktop `tailwind.config.js` to ensure the landing page has the same dynamic visuals.

### 2. AuthGate Component Revamp
- **File**: `web/src/components/AuthGate.tsx`
- **Changes**:
  - Replace the current dark UI with the Desktop `LandingPage` UI markup.
  - Add the 3D character (`character.png`) and logo (`logo.png`).
  - Add the social media links with their hover animations.
  - Change the main button text to "Login to Workspace".
  - Maintain the existing token-checking logic (`useEffect` verifying token, custom event listeners).

### 3. Login Modal
- **State**: Add state `isLoginModalOpen` to `AuthGate.tsx`.
- **UI**: When "Login to Workspace" is clicked, display a fixed overlay modal.
- **Form**: The modal will contain the Token input form, previously part of the main `AuthGate` view.
- **Styling**: Light-themed modal with a slight glassmorphism effect (backdrop blur) to fit the new aesthetic. Includes a close button (X) to dismiss the modal.

### 4. Responsive Design
- Ensure padding, font sizes, and layout constraints (e.g. `max-w-md`, `p-4`) work seamlessly on mobile browsers.

## Data Flow
1. User visits `/`. `AuthGate` checks for a token.
2. If unauthenticated, the `LandingPage` UI is shown.
3. User clicks "Login to Workspace" -> `isLoginModalOpen = true`.
4. User enters token and submits -> Backend is verified.
5. If valid, `isAuthenticated = true` -> The main `MainWizard` (Dashboard) is rendered.

## Implementation Steps
1. Update `web/tailwind.config.js` with animations.
2. Refactor `web/src/components/AuthGate.tsx`.
3. Test layout on mobile viewport.
4. Verify token login flow still functions correctly.
