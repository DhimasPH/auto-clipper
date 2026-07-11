# Splash Screen & Brand Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a clean, minimalist splash screen with the Auto Clipper brand identity that replaces the default loading text during app initialization.

**Architecture:** The `SplashScreen` will be a React component mounted in `App.tsx`. It will receive `isInitializing` as a prop. When `isInitializing` becomes false, it will trigger a CSS fade-out animation and then signal its completion to `App.tsx` via an `onFinish` callback, allowing the main app UI to take over smoothly.

**Tech Stack:** React, Tailwind CSS, TypeScript.

---

### Task 1: Create the SplashScreen Component

**Files:**
- Create: `src/components/SplashScreen.tsx`

- [ ] **Step 1: Write the component implementation**
Create `src/components/SplashScreen.tsx` with the following content:

```tsx
import React, { useEffect, useState } from "react";

interface SplashScreenProps {
  isInitializing: boolean;
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ isInitializing, onFinish }) => {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (!isInitializing) {
      setFading(true);
      const timer = setTimeout(() => {
        onFinish();
      }, 500); // 500ms fade-out duration
      return () => clearTimeout(timer);
    }
  }, [isInitializing, onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F9FAFB] transition-opacity duration-500 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* The Minimalist Crop Logo */}
      <div className="relative mb-6 flex items-center justify-center h-20 w-20">
        {/* Play Button Triangle */}
        <div 
          className="w-0 h-0 border-t-[20px] border-t-transparent border-l-[30px] border-l-[#0F172A] border-b-[20px] border-b-transparent ml-2 z-10" 
        />
        {/* Crop Lines (Vertical/Horizontal accent) */}
        <div className="absolute top-0 left-2 w-1 h-24 bg-[#3B82F6] transform -translate-y-2 opacity-80" />
        <div className="absolute bottom-2 right-0 w-24 h-1 bg-[#3B82F6] transform translate-x-2 opacity-80" />
      </div>

      <h1 className="text-4xl font-bold text-[#0F172A] mb-2 tracking-tight font-sans">
        Auto Clipper
      </h1>
      
      <p className="text-[#6B7280] text-sm mb-12">
        Long-form to Shorts. Secara Otomatis.
      </p>

      {/* Minimalist Loading Indicator */}
      <div className="w-48 h-1 bg-gray-200 rounded overflow-hidden">
        <div className="h-full bg-[#3B82F6] animate-pulse rounded" style={{ width: '60%' }} />
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Commit (if auto_commit enabled)**

Check `.agent/config.yml` for `auto_commit` setting.

If `auto_commit: true` (default when absent):
```bash
git add src/components/SplashScreen.tsx
git commit -m "feat: create minimalist splash screen component"
```

If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."


### Task 2: Integrate SplashScreen into App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update App.tsx to use the SplashScreen**
In `src/App.tsx`, import `SplashScreen` and manage its display state.

Locate the imports at the top and add:
```tsx
import { SplashScreen } from "./components/SplashScreen";
```

Locate the state hooks inside `App()`:
```tsx
  const [url, setUrl] = useState("");
```
Add:
```tsx
  const [splashComplete, setSplashComplete] = useState(false);
```

Locate the `isInitializing` check:
```tsx
  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary text-text-secondary">
        <div className="spinner mr-4" />
        <span>{t('main.loading_settings', 'Loading settings...')}</span>
      </div>
    );
  }
```
Replace it with:
```tsx
  if (!splashComplete) {
    return (
      <SplashScreen 
        isInitializing={isInitializing} 
        onFinish={() => setSplashComplete(true)} 
      />
    );
  }
```

- [ ] **Step 2: Commit (if auto_commit enabled)**

Check `.agent/config.yml` for `auto_commit` setting.

If `auto_commit: true` (default when absent):
```bash
git add src/App.tsx
git commit -m "feat: integrate splash screen into app initialization flow"
```

If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."
