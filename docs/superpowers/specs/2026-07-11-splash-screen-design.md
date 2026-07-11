# Splash Screen & Brand Identity Design

## Overview
This document outlines the design specifications for the Auto Clipper splash screen and its visual brand identity. The goal is to provide a clean, minimalist, and professional first impression while the application initializes its backend services.

## Brand Identity (Logo & Copywriting)
- **Vibe:** Simple, Clean, & Minimalist.
- **Logo Concept:** "The Minimalist Crop". A geometric combination of a Play button (triangle) and vertical Crop marks (representing the 9:16 aspect ratio).
- **Color Palette:**
  - Background: Solid White (`#FFFFFF`) or very light gray (`#F9FAFB`).
  - Primary Logo Color: Deep Slate/Black (`#0F172A`).
  - Accent Color: Electric Blue (`#3B82F6` or `#2563EB`) applied subtly to the logo.
- **Typography:** Modern sans-serif (e.g., Inter, Outfit, or system-ui).
- **Tagline:** "Long-form to Shorts. Secara Otomatis."

## User Interface (UI) Layout
The Splash Screen is a full-window view that completely covers the main application dashboard until initialization is complete.
1. **Center Alignment:** All elements are vertically and horizontally centered.
2. **Top:** The "Minimalist Crop" logo.
3. **Middle:** The application name "Auto Clipper" in bold font.
4. **Bottom:** The tagline in a muted gray color (e.g., `#6B7280`).
5. **Loading Indicator:** Instead of a standard circular spinner, a minimalist linear progress bar or a subtle glowing animation on the logo's accent color will indicate background loading.

## Data Flow & Architecture
- **Trigger:** The splash screen mounts immediately upon launching the Electron/React app.
- **Background Process:** While the splash screen is visible, the app checks and initializes required dependencies (e.g., FFmpeg, Python backend, API keys).
- **Transition:** 
  - **Success:** Once a `backend_ready` signal is received, the splash screen triggers a CSS `opacity` fade-out transition (duration ~500ms) and unmounts, revealing the main dashboard.
  - **Error/Timeout:** If initialization fails or times out, the splash screen should display a minimal error state (e.g., "Gagal memuat mesin AI. Silakan muat ulang aplikasi.") with a retry button.

## Future Scope / Implementation Constraints
- Implemented as a top-level React component (e.g., `<SplashScreen />`) rendered conditionally in `App.tsx`.
- Must not block the main process; strictly acts as a visual overlay while asynchronous checks resolve.
