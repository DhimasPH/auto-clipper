# Font Variations in Web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated Font Selector to the Auto Clipper Cloud Web UI with live previews using Google Fonts.

**Architecture:** We will load 6 new fonts via Google Fonts in `web/index.html`. We will create a `FontSelector` React component that displays font previews, and we will integrate this into `ClipEditModal.tsx` and `HistoryList.tsx` so users can override the preset's default font.

**Tech Stack:** React, Tailwind CSS, Google Fonts

---

### Task 1: Integrate Google Fonts

**Files:**
- Modify: `web/index.html`

- [ ] **Step 1: Add Google Fonts link**
Modify `web/index.html` to include the Google Fonts stylesheet for Montserrat, Bebas Neue, Poppins, Oswald, Anton, and Permanent Marker in the `<head>`.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Montserrat:wght@400;700&family=Oswald:wght@400;700&family=Permanent+Marker&family=Poppins:wght@400;700&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Commit (if auto_commit enabled)**
Check `.agent/config.yml` for `auto_commit` setting.
If `auto_commit: true` (default when absent):
```bash
git add web/index.html
git commit -m "feat: add google fonts for subtitle variations"
```
If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."

---

### Task 2: Create FontSelector Component

**Files:**
- Create: `web/src/components/FontSelector.tsx`

- [ ] **Step 1: Create FontSelector.tsx**
Create the UI component with a standard `<select>` element. Each `<option>` must apply `style={{ fontFamily: ... }}` so it previews its own font.

```tsx
import React from 'react';

const FONTS = [
  { id: '', label: 'Preset Default (Ikut Style)', family: 'inherit' },
  { id: 'Impact', label: 'Impact', family: 'Impact, sans-serif' },
  { id: 'Arial', label: 'Arial', family: 'Arial, sans-serif' },
  { id: 'Montserrat', label: 'Montserrat', family: "'Montserrat', sans-serif" },
  { id: 'Bebas Neue', label: 'Bebas Neue', family: "'Bebas Neue', sans-serif" },
  { id: 'Poppins', label: 'Poppins', family: "'Poppins', sans-serif" },
  { id: 'Oswald', label: 'Oswald', family: "'Oswald', sans-serif" },
  { id: 'Anton', label: 'Anton', family: "'Anton', sans-serif" },
  { id: 'Permanent Marker', label: 'Permanent Marker', family: "'Permanent Marker', cursive" },
];

interface FontSelectorProps {
  value: string;
  onChange: (font: string) => void;
}

export const FontSelector: React.FC<FontSelectorProps> = ({ value, onChange }) => {
  return (
    <div className="flex flex-col space-y-1">
      <label className="text-sm text-neutral-400 font-medium">Custom Font</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg p-2 focus:outline-none focus:border-blue-500"
        style={{ fontFamily: FONTS.find(f => f.id === value)?.family || 'inherit' }}
      >
        {FONTS.map(font => (
          <option 
            key={font.label} 
            value={font.id} 
            style={{ fontFamily: font.family }}
          >
            {font.label}
          </option>
        ))}
      </select>
    </div>
  );
};
```

- [ ] **Step 2: Commit (if auto_commit enabled)**
Check `.agent/config.yml` for `auto_commit` setting.
If `auto_commit: true` (default when absent):
```bash
git add web/src/components/FontSelector.tsx
git commit -m "feat: create FontSelector component"
```
If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."

---

### Task 3: Integrate FontSelector into ClipEditModal

**Files:**
- Modify: `web/src/components/ClipEditModal.tsx`

- [ ] **Step 1: Import and add state**
Import `FontSelector` and add a new state `const [customFont, setCustomFont] = useState<string>("")`.
In `handleSaveRerender`, resolve the final font.

```tsx
// At top of file:
import { FontSelector } from "./FontSelector";

// Inside ClipEditModal component (around line 34):
const [customFont, setCustomFont] = useState<string>("");

// Inside handleSaveRerender:
const presetBase = SUBTITLE_PRESETS[subtitlePreset]?.config || {};
const finalFont = customFont || presetBase.font_family || "Arial";

const subtitleConfig: SubtitleConfig = {
  ...DEFAULT_SUBTITLE_CONFIG,
  ...presetBase,
  font_family: finalFont,
};
```

- [ ] **Step 2: Render FontSelector UI**
In the JSX, find the `SubtitlePresetBar` (around line 250-260) and insert `FontSelector` right below it.

```tsx
          {/* Subtitle Style */}
          <div className="space-y-4">
            <h4 className="font-medium text-neutral-200">Subtitle Style</h4>
            <SubtitlePresetBar
              value={subtitlePreset}
              onChange={setSubtitlePreset}
            />
            
            <FontSelector 
              value={customFont}
              onChange={setCustomFont}
            />
          </div>
```

- [ ] **Step 3: Commit (if auto_commit enabled)**
Check `.agent/config.yml` for `auto_commit` setting.
If `auto_commit: true` (default when absent):
```bash
git add web/src/components/ClipEditModal.tsx
git commit -m "feat: integrate FontSelector into ClipEditModal"
```
If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."

---

### Task 4: Integrate FontSelector into HistoryList

**Files:**
- Modify: `web/src/components/HistoryList.tsx`

- [ ] **Step 1: Import and add state**
Import `FontSelector` and add a new state `const [customFont, setCustomFont] = useState<string>("")`.
In `handleRerenderSubmit`, resolve the final font.

```tsx
// At top of file:
import { FontSelector } from "./FontSelector";

// Inside HistoryList component (around line 22):
const [customFont, setCustomFont] = useState<string>("");

// Inside handleRerenderSubmit:
const presetBase = SUBTITLE_PRESETS[subtitlePreset]?.config || {};
const finalFont = customFont || presetBase.font_family || "Arial";

const subtitleConfig: SubtitleConfig = {
  ...DEFAULT_SUBTITLE_CONFIG,
  ...presetBase,
  font_family: finalFont,
};
```

- [ ] **Step 2: Render FontSelector UI**
In the JSX, find where the `SubtitlePresetBar` is rendered for the Rerender Settings (around line 315) and insert `FontSelector` below it.

```tsx
                  <SubtitlePresetBar
                    value={subtitlePreset}
                    onChange={setSubtitlePreset}
                  />
                  
                  <div className="mt-4">
                    <FontSelector 
                      value={customFont}
                      onChange={setCustomFont}
                    />
                  </div>
```

- [ ] **Step 3: Commit (if auto_commit enabled)**
Check `.agent/config.yml` for `auto_commit` setting.
If `auto_commit: true` (default when absent):
```bash
git add web/src/components/HistoryList.tsx
git commit -m "feat: integrate FontSelector into HistoryList"
```
If `auto_commit: false`: skip commit and staging. Print: "Skipping commit (auto_commit: false)."
