# Auto Clipper — Enterprise UI/UX Redesign Spec

> **Status**: Draft (brainstorming in progress)  
> **Date**: 2026-07-11  
> **Approach**: Full Restructure — "Studio Workspace"

---

## Design Decisions Summary

| Aspek | Keputusan |
|---|---|
| Vibe | Studio/Creative tool (CapCut, DaVinci Resolve) |
| Layout | Multi-page + sidebar navigasi permanen |
| Sidebar | Always expanded (~200-240px) |
| Icon Library | Lucide Icons (SVG, ganti semua emoji) |
| Styling | Tailwind CSS v3 (migrasi dari inline styles) |
| Theme | Dark + Light (keduanya dipertahankan) |
| Routing | `react-router-dom` dengan `HashRouter` (Electron-compatible) |

### New Dependencies
- `react-router-dom` — page routing
- `lucide-react` — SVG icon library
- `tailwindcss` v3 + `postcss` + `autoprefixer` — utility CSS framework

---

## Section 1: App Shell & Sidebar

### Layout Structure
```
┌──────────────────────────────────────────────────┐
│  App Shell (100vh, flexbox row)                  │
│ ┌──────────┬─────────────────────────────────┐   │
│ │          │                                 │   │
│ │ Sidebar  │     Page Content Area           │   │
│ │ (240px)  │     (flex: 1, scrollable)       │   │
│ │          │                                 │   │
│ │ ┌──────┐ │                                 │   │
│ │ │ Logo │ │                                 │   │
│ │ │ +ver │ │                                 │   │
│ │ └──────┘ │                                 │   │
│ │          │                                 │   │
│ │ ── Nav ─ │                                 │   │
│ │ Workspace│                                 │   │
│ │ History  │                                 │   │
│ │          │                                 │   │
│ │          │                                 │   │
│ │ ── Bot ─ │                                 │   │
│ │ Settings │                                 │   │
│ │ Help/FAQ │                                 │   │
│ │ ●Backend │                                 │   │
│ └──────────┴─────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

### Sidebar Detail
- **Top**: Logo "Auto Clipper" (text, gradient, smaller) + version badge
- **Nav section** (main):
  - `Scissors` icon — **Workspace** (main page, create clips)
  - `Clock` icon — **History** (full page, replaces modal)
- **Bottom section** (pinned to bottom):
  - `Settings` icon — **Settings** (full page, replaces modal)
  - `HelpCircle` icon — **Help** (opens FAQ, bisa tetap modal atau inline)
  - **Backend status indicator** — dot hijau/merah + "Connected"/"Disconnected"
- **Active state**: nav item yang aktif punya background highlight + accent left border (4px)
- **Sidebar background**: slightly elevated dari main bg (misal `#12141a` dark, `#f3f4f6` light)
- **Divider**: subtle horizontal line antara nav groups

### Routing
- `/` → Workspace page
- `/history` → History page
- `/settings` → Settings page

Pakai `react-router-dom` dengan `HashRouter` (karena Electron).

---

## Section 2: Workspace Page (Halaman Utama)

### Layout
```
┌─────────────────────────────────────────────────────────┐
│  Workspace Page                                         │
│                                                         │
│  ┌─ Page Header ──────────────────────────────────────┐ │
│  │  "Workspace"  (h1)                                 │ │
│  │  "Create clips from any video"  (subtitle)         │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ Config Panel (satu card besar) ───────────────────┐ │
│  │                                                    │ │
│  │  Source: [URL|Local] segmented control + input      │ │
│  │  Mode:   [AI|Manual] segmented control              │ │
│  │  Output: Aspect ratio buttons + Caption style       │ │
│  │          + Burn subtitles toggle                    │ │
│  │                                                    │ │
│  │  [🚀 Generate Clips] full-width button              │ │
│  │                                                    │ │
│  │  Progress bar (conditional)                        │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ Results Grid (conditional, after DONE) ───────────┐ │
│  │  ClipCard  ClipCard  ClipCard                      │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Detail

**Config Panel**
- Background: elevated card, rounded-xl, border subtle
- Sections dipisah divider/spacing, bukan nested cards

**Source Section**
- Segmented control pill-style: `URL Video` | `Video Lokal`
- URL input: input group dengan `Link` prefix icon
- File input: styled upload area dengan `Upload` icon

**Mode Section**
- Segmented control: `AI Mode` | `Manual Mode`
- Manual: time range inputs (Start/End) dengan `Clock` icon

**Output Settings**
- Aspect Ratio: button group dengan visual ratio preview
- Caption Style: segmented control `Standard` | `Karaoke`
- Burn Subtitles: toggle switch (bukan checkbox)
- Karaoke disabled saat Gemini → tooltip "Not supported with Gemini"

**Generate Button**
- Full-width, gradient bg, `Sparkles` icon (AI) / `Scissors` icon (Manual)
- Running state: menjadi Cancel button (red) + `Loader2` spinner
- Hilangkan animasi pulse-glow (kurang enterprise)

**Progress**
- Thin bar (4px), rounded, smooth gradient
- Status text + percentage di bawah

**Results / ClipCards**
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- ClipCard redesigned:
  - Rounded-xl, subtle border
  - Proper video aspect ratio container
  - Icon action buttons (`Download`, `FolderOpen`, `Subtitles`) dengan tooltip
  - Hover: slight elevation

### Komponen Baru
- `SegmentedControl.tsx` — reusable pill-style toggle
- `ToggleSwitch.tsx` — proper on/off toggle
- `InputGroup.tsx` — input dengan prefix icon + label + helper text

---

## Section 3: History Page

### Layout
- Full page (replaces modal)
- Page header + history list

### Job Card
- Rounded-xl card, border subtle, elevated bg
- **Header row**: URL (truncated, clickable) + timestamp + status badge
- **Status badge**: pill-shaped, color-coded
  - `DONE` → green (`bg-emerald-500/10 text-emerald-400`)
  - `ERROR` → red
  - `CANCELLED` → gray
- **Clips row**: horizontal scroll, per clip: mini thumb + Download icon + FolderOpen icon
- **Actions bar**:
  - `RotateCw` + "Re-render" — outline button
  - `Sparkles` + "AI Koreksi" — outline button
  - `Trash2` + "Hapus" — ghost red button
- **Expandable panels**: Re-render / AI Koreksi options slide-down smooth

### Re-render Panel
- SegmentedControl untuk aspect ratio
- ToggleSwitch untuk burn subs
- Select untuk caption style
- "Mulai Re-render" (primary) + "Batal" (ghost)

### AI Koreksi Panel
- Styled textarea + label + placeholder
- "Jalankan AI" (primary) + "Batal" (ghost)

### Delete Confirmation
- Custom confirmation dialog (modal kecil) — ganti `window.confirm()`

### Empty State
- Centered: large icon (`Film`/`Clapperboard`), heading, subtitle, CTA ke Workspace

---

## Section 4: Settings Page

### Layout
- Full page (replaces modal)
- Max content width ~640px
- Settings grouped dalam section cards

### Section Cards

**Appearance** (`Palette` icon)
- Theme: 3 card-style buttons (dark/light/system) dengan mini color preview + checkmark active
- Language: Segmented control `🇮🇩 Indonesia` | `🇬🇧 English`

**AI Provider** (`Brain` icon)
- Provider: SegmentedControl `OpenAI` | `Gemini` (2 options saja)
- API Key: input group + `Eye`/`EyeOff` toggle, `Lock` icon helper text
- Warning saat kosong: "API key required for AI mode"

**Output** (`FolderOutput` icon)
- Output Folder: read-only input + `FolderOpen` Browse btn + `X` Reset btn
- Video Quality: styled select dropdown

### Behavioral Changes
- **Auto-save** — hapus tombol "Simpan". Perubahan langsung persist (mirip VS Code settings)
- Setiap setting item pakai pattern: Label → Description → Control

---

## Section 5: Toast, Color Palette & Design System

### Toast Notifications (Redesigned)

**Current**: top-right, inline colors, basic rounded.

**Redesign**:
- Position: top-right, proper stacking + entrance/exit animation
- Structure:
  ```
  ┌─ [icon]  Toast message text           [✕] ─┐
  └──────────────────────────────────────────────┘
  ```
- Variants:
  - `info` → `Info` icon, blue-ish accent bg
  - `success` → `CheckCircle` icon, emerald bg
  - `error` → `AlertTriangle` icon, red bg
  - `warning` → `AlertCircle` icon, amber bg (new)
- Animation: slide-in from right + fade, exit slide-out + fade
- Auto-dismiss: 4s (info/success), 8s (error), subtle progress bar di bawah toast
- Dismiss button: `X` icon di kanan
- Max 3 toast visible, sisanya queued

### Color Palette

#### Dark Theme (Primary)
```
Background:
  --bg-primary:     #0c0d11     (deep dark, almost black)
  --bg-secondary:   #14161e     (card backgrounds)
  --bg-elevated:    #1a1d28     (hover states, popups)
  --bg-surface:     #21242f     (input fields, dropdowns)

Accent:
  --accent:         #6366f1     (indigo — retained)
  --accent-hover:   #818cf8     (lighter on hover)
  --accent-muted:   rgba(99, 102, 241, 0.12)  (subtle backgrounds)

Text:
  --text-primary:   #f0f1f4     (main text, high contrast)
  --text-secondary: #7c8097     (labels, descriptions)
  --text-tertiary:  #4a4f65     (placeholder, disabled)

Border:
  --border:         rgba(255, 255, 255, 0.08)
  --border-active:  rgba(255, 255, 255, 0.16)

Semantic:
  --success:        #10b981     (emerald)
  --error:          #ef4444     (red)
  --warning:        #f59e0b     (amber)
  --info:           #3b82f6     (blue)
```

#### Light Theme
```
Background:
  --bg-primary:     #f8f9fb
  --bg-secondary:   #ffffff
  --bg-elevated:    #ffffff
  --bg-surface:     #f1f3f7

Accent:
  --accent:         #4f46e5
  --accent-hover:   #4338ca
  --accent-muted:   rgba(79, 70, 229, 0.08)

Text:
  --text-primary:   #111827
  --text-secondary: #6b7280
  --text-tertiary:  #9ca3af

Border:
  --border:         rgba(0, 0, 0, 0.08)
  --border-active:  rgba(0, 0, 0, 0.16)

Semantic:
  --success:        #059669
  --error:          #dc2626
  --warning:        #d97706
  --info:           #2563eb
```

### Typography Scale

Font: **Outfit** (retained)

| Token | Size | Weight | Usage |
|---|---|---|---|
| `text-page-title` | 24px (1.5rem) | 700 | Page titles |
| `text-section-title` | 18px (1.125rem) | 600 | Section card titles |
| `text-card-title` | 16px (1rem) | 600 | ClipCard / Job card title |
| `text-body` | 14px (0.875rem) | 400 | Body text, descriptions |
| `text-label` | 13px (0.8125rem) | 500 | Form labels |
| `text-caption` | 12px (0.75rem) | 400 | Helper text, timestamps, badges |
| `text-overline` | 11px (0.6875rem) | 600 | Section overlines, ALL CAPS labels |

### Spacing System

Tailwind default (4px base) + semantic tokens:

| Token | Value | Usage |
|---|---|---|
| `space-page-padding` | 32px (p-8) | Page content padding |
| `space-card-padding` | 24px (p-6) | Card internal padding |
| `space-section-gap` | 24px (gap-6) | Gap between sections |
| `space-field-gap` | 16px (gap-4) | Gap between form fields |
| `space-inline-gap` | 8px (gap-2) | Gap between inline elements |

### Border Radius

| Token | Value | Usage |
|---|---|---|
| `rounded-card` | 12px (rounded-xl) | Cards, modals |
| `rounded-input` | 8px (rounded-lg) | Inputs, selects, buttons |
| `rounded-button` | 8px (rounded-lg) | Buttons |
| `rounded-badge` | 9999px (rounded-full) | Status badges, pills |

### Shadows

| Token | Value |
|---|---|
| `shadow-card` | `0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)` |
| `shadow-card-hover` | `0 4px 12px rgba(0,0,0,0.15)` |
| `shadow-dropdown` | `0 8px 24px rgba(0,0,0,0.25)` |
| `shadow-toast` | `0 4px 16px rgba(0,0,0,0.3)` |

### Transition Defaults

All interactive elements: `transition-all duration-200 ease-in-out`

Exceptions:
- Page transitions: `duration-300`
- Toast enter/exit: `duration-300`
- Expandable panels: `duration-200`

---

## Section 6: File Structure & Component Architecture

### Current Structure (Problems)
```
src/
├── App.tsx              ← 958 lines! God component
├── index.css            ← 110 lines
├── main.tsx
├── components/
│   ├── Header.tsx       ← inline styles
│   ├── ClipCard.tsx     ← inline styles
│   ├── FAQModal.tsx     ← inline styles
│   ├── HistoryModal.tsx ← inline styles, 278 lines
│   └── SettingsModal.tsx← inline styles, 332 lines
└── locales/
```

### New Structure
```
src/
├── main.tsx
├── App.tsx                           ← routing setup only (~30-50 lines)
├── index.css                         ← Tailwind directives + custom utilities
│
├── layouts/
│   └── AppLayout.tsx                 ← Shell: sidebar + content area
│
├── pages/
│   ├── WorkspacePage.tsx             ← main clip creation page
│   ├── HistoryPage.tsx               ← full history page
│   └── SettingsPage.tsx              ← full settings page
│
├── components/
│   ├── ui/                           ← reusable UI primitives
│   │   ├── SegmentedControl.tsx
│   │   ├── ToggleSwitch.tsx
│   │   ├── InputGroup.tsx
│   │   ├── Button.tsx
│   │   ├── Badge.tsx
│   │   ├── Select.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── Toast.tsx
│   │   └── PageHeader.tsx
│   │
│   ├── sidebar/
│   │   └── Sidebar.tsx
│   │
│   ├── workspace/
│   │   ├── SourceInput.tsx
│   │   ├── ModeSelector.tsx
│   │   ├── OutputSettings.tsx
│   │   ├── GenerateButton.tsx
│   │   └── ClipCard.tsx
│   │
│   ├── history/
│   │   ├── JobCard.tsx
│   │   ├── RerenderPanel.tsx
│   │   ├── AiCorrectionPanel.tsx
│   │   └── EmptyState.tsx
│   │
│   └── settings/
│       ├── AppearanceSection.tsx
│       ├── ProviderSection.tsx
│       └── OutputSection.tsx
│
├── hooks/
│   ├── useBackendStatus.ts
│   ├── useJob.ts
│   ├── useApiKeys.ts
│   ├── useSettings.ts
│   └── useToast.ts
│
├── lib/
│   ├── api.ts
│   └── constants.ts
│
├── locales/                          ← unchanged
└── env.d.ts                          ← unchanged
```

### Hook Responsibilities

| Hook | Extracted from App.tsx | Responsibilities |
|---|---|---|
| `useBackendStatus` | Lines 160-184 | Health polling, status state |
| `useJob` | Lines 186-311 | Job creation, polling, cancel, clips state |
| `useApiKeys` | Lines 34-86 | Key load/save, electron/localStorage |
| `useSettings` | Lines 19-101 | Provider, quality, theme, outputFolder |
| `useToast` | Lines 145-153 | Toast state, notify function |

### UI Component Props

| Component | Key Props |
|---|---|
| `SegmentedControl` | `options`, `value`, `onChange`, `disabled` |
| `ToggleSwitch` | `checked`, `onChange`, `label`, `disabled` |
| `InputGroup` | `icon`, `label`, `helperText`, `...inputProps` |
| `Button` | `variant` (primary/outline/ghost/danger), `icon`, `loading` |
| `Badge` | `variant` (success/error/warning/neutral), `children` |
| `Select` | `options`, `value`, `onChange`, `label` |
| `ConfirmDialog` | `title`, `message`, `onConfirm`, `onCancel` |
| `PageHeader` | `title`, `subtitle` |

### Migration Map

| Old File | → New Location |
|---|---|
| `App.tsx` (958 lines) | Split → hooks, pages, components |
| `Header.tsx` | → `Sidebar.tsx` + `PageHeader.tsx` |
| `ClipCard.tsx` | → `workspace/ClipCard.tsx` |
| `SettingsModal.tsx` | → `SettingsPage.tsx` + 3 sections |
| `HistoryModal.tsx` | → `HistoryPage.tsx` + 4 sub-components |
| `FAQModal.tsx` | → Kept as modal, polished with Tailwind + Lucide |

### Files Deleted
- `components/Header.tsx` → replaced by Sidebar
- `components/SettingsModal.tsx` → replaced by SettingsPage
- `components/HistoryModal.tsx` → replaced by HistoryPage

### Files Unchanged
- `main.tsx` (minor tweak for router)
- `locales/*` (may add new keys)
- `env.d.ts`
- `i18n.ts`

---

## Section 7: Migration Strategy — Execution Order

### Phase 1: Foundation (Setup, no visual change)
1. Install dependencies: `tailwindcss` v3, `postcss`, `autoprefixer`, `lucide-react`, `react-router-dom`
2. Configure Tailwind: `tailwind.config.js`, update `postcss.config.js`, replace `index.css`
3. Verify: app still works, Tailwind classes available

### Phase 2: Architecture (Extract logic)
4. Create `hooks/` — extract all logic from App.tsx:
   - `useBackendStatus.ts`
   - `useApiKeys.ts`
   - `useSettings.ts`
   - `useToast.ts`
   - `useJob.ts`
5. Create `lib/api.ts` + `lib/constants.ts`
6. Verify: App.tsx now uses hooks, all functionality intact

### Phase 3: UI Primitives (Design system)
7. Create all `components/ui/` primitives:
   - Button, SegmentedControl, ToggleSwitch, InputGroup, Badge, Select, PageHeader, ConfirmDialog, Toast
8. Verify: components render correctly

### Phase 4: Layout Shell (Sidebar + Routing)
9. Create `layouts/AppLayout.tsx` + `components/sidebar/Sidebar.tsx`
10. Create page shells (initially wrapping old content)
11. Rewrite `App.tsx` → slim router
12. Verify: navigation works, sidebar renders, old content visible

### Phase 5: Page-by-Page Redesign
13. **SettingsPage** (most independent, easiest first)
    - Create section components, compose page, migrate styles → Tailwind
    - Implement auto-save, delete old SettingsModal.tsx
14. **HistoryPage** (medium complexity)
    - Create sub-components, compose page, implement ConfirmDialog
    - Delete old HistoryModal.tsx
15. **WorkspacePage** (most complex, last)
    - Create workspace components, redesign ClipCard
    - Compose page, migrate all inline styles → Tailwind

### Phase 6: Polish & Cleanup
16. Polish Toast system
17. Polish FAQModal (Tailwind + Lucide)
18. Delete old Header.tsx
19. Review transitions and animations
20. Test dark + light theme end-to-end
21. Final cleanup: remove unused CSS, dead code

### Risk Mitigation
- Each phase verifiable before proceeding
- Phase 2 (hooks extraction) is most critical — test thoroughly
- Phase 4 (routing) may affect Electron — test in Electron shell
- Git commit per phase for easy rollback

### Estimated Scope

| Phase | Files | Complexity |
|---|---|---|
| Phase 1: Foundation | 3-4 config files | Low |
| Phase 2: Architecture | 5 hooks + 2 lib + App.tsx refactor | **High** |
| Phase 3: UI Primitives | 9 new components | Medium |
| Phase 4: Layout Shell | 4 new files + App.tsx rewrite | Medium |
| Phase 5: Page Redesign | ~15 new components, 3 old deleted | **High** |
| Phase 6: Polish | ~5-8 files tweaked | Low |

**Total: ~35-40 new/modified files**
