### Task 5: Shell: three destinations, bottom/side navigation, connection status, routes and redirects, `caps.keepOpen`

Spec 4.1 and 5 (disconnected banner). Six menus become three: **Buat klip** (`/`), **Riwayat** (`/riwayat`, `/riwayat/:id`), **Pengaturan** (`/pengaturan`). Phones get a bottom bar with three labelled icons; from 768 px a slim side bar with the same three. The connection status is a small labelled dot in the header; a lost backend shows a banner with "Hubungkan ulang" and a per-platform explanation. Old addresses redirect. `LandingPage` and `Sidebar` go. The existing pages are mounted at the new paths for now (Tasks 8, 13, 14 replace them), so the app works after this task.

**Files:**
- Modify: `src/platform/types.ts` (`KeepOpen`, `Caps.keepOpen`), `src/platform/caps.ts`, `src/platform/caps.test.ts`
- Create: `src/lib/routes.ts`, `src/components/nav/legacyRoutes.tsx`, `src/lib/routes.test.tsx`
- Create: `src/hooks/useBackendStatus.tsx`, `src/hooks/useScrollToHash.ts`
- Create: `src/components/nav/navItems.ts`, `BottomNav.tsx`, `SideNav.tsx`, `ConnectionStatus.tsx`, `BackendBanner.tsx`, `src/components/nav/nav.test.tsx`
- Modify: `src/layouts/AppLayout.tsx`, `src/App.tsx`, `src/hooks/useErrorActions.ts`, `src/hooks/useClipJobs.ts` (one line), `src/pages/SettingsPage.tsx` (temporary anchors)
- Delete: `src/components/sidebar/Sidebar.tsx`, `src/pages/LandingPage.tsx`
- Modify: `src/locales/{id,en}.json` (`nav.*`, `banner.*`)

**Interfaces:**
- Consumes: `useBackendHealth()` → `{ status: BackendStatusKey, reconnect(): Promise<void> }`; `platform().caps`.
- Produces:
  - `type KeepOpen = "app" | "window" | "none"`; `Caps.keepOpen` (`desktop: "app"`, `local: "window"`, `cloud: "none"`).
  - `ROUTES = { create: "/", projects: "/riwayat", settings: "/pengaturan" }`, `projectPath(id: string): string`, `SETTINGS_ANCHORS = { general: "umum", youtube: "youtube", advanced: "lanjutan", downloader: "pengunduh", help: "bantuan" }`, `LEGACY_REDIRECTS: Record<string, string>` (`src/lib/routes.ts`).
  - `legacyRouteElements(): React.ReactElement[]` (`src/components/nav/legacyRoutes.tsx`).
  - `BackendStatusProvider`, `BackendStatusContext`, `useBackendStatus(): { status: BackendStatusKey; reconnect: () => Promise<void> }` (`src/hooks/useBackendStatus.tsx`).
  - `useScrollToHash(): void` (`src/hooks/useScrollToHash.ts`).
  - `NAV_ITEMS` (`src/components/nav/navItems.ts`).

- [ ] **Step 1: Write the failing tests**

`src/platform/caps.test.ts`: in each of the three `toEqual` objects add the new field — desktop `keepOpen: "app"`, local `keepOpen: "window"`, cloud `keepOpen: "none"` — and add:

```ts
  it("says what must stay open while a job runs (spec 4.3)", () => {
    expect([CAPS.desktop.keepOpen, CAPS.local.keepOpen, CAPS.cloud.keepOpen]).toEqual(["app", "window", "none"]);
  });
```

`src/lib/routes.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { legacyRouteElements } from "../components/nav/legacyRoutes";
import { LEGACY_REDIRECTS, projectPath } from "./routes";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Where() {
  const location = useLocation();
  return <p>{location.pathname + location.hash}</p>;
}

describe("routes (spec 4.1)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    root = createRoot(container);
  });

  afterEach(() => act(() => root.unmount()));

  it("keeps every old address working", () => {
    expect(LEGACY_REDIRECTS).toEqual({
      "/manual-ai": "/",
      "/downloader": "/pengaturan#pengunduh",
      "/history": "/riwayat",
      "/settings": "/pengaturan",
      "/help": "/pengaturan#bantuan",
    });
  });

  it.each(Object.entries(LEGACY_REDIRECTS))("%s opens %s", (from, to) => {
    act(() =>
      root.render(
        <MemoryRouter initialEntries={[from]}>
          <Routes>
            {legacyRouteElements()}
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>,
      ),
    );
    expect(container.textContent).toBe(to);
  });

  it("builds a project address that survives odd ids", () => {
    expect(projectPath("a b/c")).toBe("/riwayat/a%20b%2Fc");
  });
});
```

`src/components/nav/nav.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { BackendStatusContext } from "../../hooks/useBackendStatus";
import { CAPS, setPlatform, type Platform } from "../../platform";
import { BackendBanner } from "./BackendBanner";
import { BottomNav } from "./BottomNav";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("navigation shell", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setPlatform(null);
  });

  it("shows three labelled destinations and marks the current one", () => {
    act(() => root.render(<MemoryRouter initialEntries={["/riwayat/abc"]}><BottomNav /></MemoryRouter>));
    const links = [...container.querySelectorAll("a")];
    expect(links.map((a) => a.textContent)).toEqual([i18n.t("nav.create"), i18n.t("nav.projects"), i18n.t("nav.settings")]);
    expect(links.map((a) => a.getAttribute("aria-current"))).toEqual([null, "page", null]);
  });

  it("explains a lost connection per platform and reconnects on request", () => {
    setPlatform({ caps: CAPS.cloud } as Platform);
    const reconnect = vi.fn(async () => {});
    act(() =>
      root.render(
        <BackendStatusContext.Provider value={{ status: "disconnected", reconnect }}>
          <BackendBanner />
        </BackendStatusContext.Provider>,
      ),
    );
    expect(container.textContent).toContain(i18n.t("banner.lost_none"));
    act(() => container.querySelector("button")!.click());
    expect(reconnect).toHaveBeenCalledTimes(1);
  });

  it("shows no banner while connected", () => {
    setPlatform({ caps: CAPS.desktop } as Platform);
    act(() =>
      root.render(
        <BackendStatusContext.Provider value={{ status: "connected", reconnect: vi.fn(async () => {}) }}>
          <BackendBanner />
        </BackendStatusContext.Provider>,
      ),
    );
    expect(container.innerHTML).toBe("");
  });
});
```

Run: `npx vitest run src/platform/caps.test.ts src/lib/routes.test.tsx src/components/nav` → FAIL (missing modules and `keepOpen`).

- [ ] **Step 2: Platform cap**

`src/platform/types.ts`, above `export interface Caps`:

```ts
/**
 * What must stay open for a running job to continue (spec 4.3): the desktop app, the
 * "Auto Clipper Web" window, or nothing (cloud: the job runs on Colab).
 */
export type KeepOpen = "app" | "window" | "none";
```

and inside `Caps`, after `preventSleep`:

```ts
  /** See KeepOpen. Picks the "may I close this?" text and the disconnected-banner text. */
  keepOpen: KeepOpen;
```

`src/platform/caps.ts`: append `keepOpen: "app"` to desktop, `keepOpen: "window"` to local, `keepOpen: "none"` to cloud.

- [ ] **Step 3: Routes**

`src/lib/routes.ts`:

```ts
// The three destinations of the app (spec 4.1) and where the old addresses go. HashRouter paths.

export const ROUTES = {
  create: "/",
  projects: "/riwayat",
  settings: "/pengaturan",
} as const;

export function projectPath(id: string): string {
  return `${ROUTES.projects}/${encodeURIComponent(id)}`;
}

/** Sections of Pengaturan that other pages link to (`/pengaturan#<id>`). */
export const SETTINGS_ANCHORS = {
  general: "umum",
  youtube: "youtube",
  advanced: "lanjutan",
  downloader: "pengunduh",
  help: "bantuan",
} as const;

/** Addresses from before SP2 (guides, bookmarks) and where they open now. */
export const LEGACY_REDIRECTS: Record<string, string> = {
  "/manual-ai": ROUTES.create,
  "/downloader": `${ROUTES.settings}#${SETTINGS_ANCHORS.downloader}`,
  "/history": ROUTES.projects,
  "/settings": ROUTES.settings,
  "/help": `${ROUTES.settings}#${SETTINGS_ANCHORS.help}`,
};
```

`src/components/nav/legacyRoutes.tsx`:

```tsx
import { Navigate, Route } from "react-router-dom";
import { LEGACY_REDIRECTS } from "../../lib/routes";

/** One redirect route per old address; call inside <Routes>. */
export function legacyRouteElements() {
  return Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
    <Route key={from} path={from} element={<Navigate to={to} replace />} />
  ));
}
```

`src/hooks/useScrollToHash.ts`:

```ts
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Scroll to `#bantuan` and friends: inside HashRouter the browser cannot do it by itself. */
export function useScrollToHash(): void {
  const { hash } = useLocation();
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!target) return;
    target.scrollIntoView({ block: "start" });
    target.focus({ preventScroll: true });
  }, [hash]);
}
```

- [ ] **Step 4: Shared backend status**

`src/hooks/useBackendStatus.tsx`:

```tsx
import React, { createContext, useContext } from "react";
import { useBackendHealth, type BackendStatusKey } from "./useBackendHealth";

export interface BackendStatus {
  status: BackendStatusKey;
  reconnect: () => Promise<void>;
}

/** One /health poller for the whole app (header dot, banner, preflight re-check). */
export const BackendStatusContext = createContext<BackendStatus | null>(null);

export const BackendStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useBackendHealth();
  return <BackendStatusContext.Provider value={value}>{children}</BackendStatusContext.Provider>;
};

export function useBackendStatus(): BackendStatus {
  const value = useContext(BackendStatusContext);
  if (!value) throw new Error("useBackendStatus needs <BackendStatusProvider>.");
  return value;
}
```

- [ ] **Step 5: Navigation components**

`src/components/nav/navItems.ts`:

```ts
import { History, Scissors, Settings, type LucideIcon } from "lucide-react";
import { ROUTES } from "../../lib/routes";

export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
  /** Only the exact path counts as active ("/" would otherwise match everything). */
  end: boolean;
}

// The icons sit next to their labels: on a phone they let people tell the three apart at a glance.
export const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.create, labelKey: "nav.create", icon: Scissors, end: true },
  { to: ROUTES.projects, labelKey: "nav.projects", icon: History, end: false },
  { to: ROUTES.settings, labelKey: "nav.settings", icon: Settings, end: false },
];
```

`src/components/nav/BottomNav.tsx`:

```tsx
import React from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "./navItems";

/** Phones (< 768 px): the three destinations at the bottom, in reach of the thumb. */
export const BottomNav: React.FC = () => {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("nav.label")}
      className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg-secondary pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-3">
        {NAV_ITEMS.map(({ to, labelKey, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-[56px] flex-col items-center justify-center gap-1 text-label ${
                  isActive ? "text-accent font-semibold" : "text-text-secondary hover:text-text-primary"
                }`
              }
            >
              <Icon className="w-6 h-6" aria-hidden="true" />
              <span>{t(labelKey)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};
```

`src/components/nav/SideNav.tsx`:

```tsx
import React from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NAV_ITEMS } from "./navItems";

/** From 768 px: a slim bar with the same three destinations (labels under the icon, beside it from 1024 px). */
export const SideNav: React.FC = () => {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t("nav.label")}
      className="hidden md:flex sticky top-0 h-dvh w-24 lg:w-56 shrink-0 flex-col gap-2 border-r border-border bg-bg-secondary px-2 py-4 lg:px-3"
    >
      <p className="hidden lg:block px-3 pb-4 text-card-title text-text-primary">Auto Clipper</p>
      {NAV_ITEMS.map(({ to, labelKey, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex min-h-[56px] flex-col lg:flex-row items-center lg:justify-start justify-center gap-1 lg:gap-3 rounded-button px-2 lg:px-3 text-label lg:text-body ${
              isActive ? "bg-accent-muted text-accent font-semibold" : "text-text-secondary hover:bg-bg-surface hover:text-text-primary"
            }`
          }
        >
          <Icon className="w-6 h-6 shrink-0" aria-hidden="true" />
          <span>{t(labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  );
};
```

`src/components/nav/ConnectionStatus.tsx`:

```tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { useBackendStatus } from "../../hooks/useBackendStatus";

const DOT: Record<string, string> = {
  connected: "bg-success",
  connecting: "bg-text-secondary",
  reconnecting: "bg-warning",
  disconnected: "bg-error",
};

/** Header: a small dot plus a word (the word carries the meaning, the dot only marks it). */
export const ConnectionStatus: React.FC = () => {
  const { t } = useTranslation();
  const { status } = useBackendStatus();
  return (
    <p role="status" className="flex items-center gap-2 text-label text-text-secondary">
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${DOT[status]}`} />
      {t(`banner.status_${status}`)}
    </p>
  );
};
```

`src/components/nav/BackendBanner.tsx`:

```tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw } from "lucide-react";
import { useBackendStatus } from "../../hooks/useBackendStatus";
import { platform } from "../../platform";
import { Button } from "../ui/Button";

/** Spec 5: the backend is gone. What happened, why (per platform), and the one thing to try. */
export const BackendBanner: React.FC = () => {
  const { t } = useTranslation();
  const { status, reconnect } = useBackendStatus();
  if (status !== "disconnected" && status !== "reconnecting") return null;
  return (
    <div role="alert" className="border-b border-border bg-bg-surface px-4 py-3 md:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-body font-semibold text-text-primary">{t("banner.lost_title")}</p>
          <p className="text-body text-text-primary">{t(`banner.lost_${platform().caps.keepOpen}`)}</p>
        </div>
        <Button variant="outline" icon={RefreshCw} loading={status === "reconnecting"} onClick={() => void reconnect()}>
          {t("banner.reconnect")}
        </Button>
      </div>
    </div>
  );
};
```

- [ ] **Step 6: Layout and routes**

`src/layouts/AppLayout.tsx`:

```tsx
import React from "react";
import { Outlet } from "react-router-dom";
import BusyOverlay from "../components/BusyOverlay";
import { BackendBanner } from "../components/nav/BackendBanner";
import { BottomNav } from "../components/nav/BottomNav";
import { ConnectionStatus } from "../components/nav/ConnectionStatus";
import { SideNav } from "../components/nav/SideNav";
import { BackendStatusProvider } from "../hooks/useBackendStatus";

/** One responsive frame (spec 4.1): bottom bar under 768 px, slim side bar above. */
export const AppLayout: React.FC = () => (
  <BackendStatusProvider>
    <div className="min-h-dvh bg-bg-primary text-text-primary md:flex">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg-primary px-4 md:px-8">
          <span className="text-card-title text-text-primary md:invisible lg:visible">Auto Clipper</span>
          <ConnectionStatus />
        </header>
        <BackendBanner />
        <main className="w-full flex-1 px-4 pb-28 pt-4 md:px-8 md:pb-10 md:pt-6">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <BusyOverlay />
    </div>
  </BackendStatusProvider>
);
```

(`BusyOverlay` stays until Task 10.)

`src/App.tsx`:
- Remove the imports of `LandingPage`, `ManualDownloaderPage`, `HelpPage`, `Navigate`; import `legacyRouteElements` from `./components/nav/legacyRoutes`.
- Remove the `showLanding` state and the `showLanding ? … :` branch.
- Replace the `<Routes>` block with:

```tsx
  const routes = (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        {/* Replaced by CreatePage in Task 8. Cloud has no API keys: the manual page. */}
        <Route index element={platform().caps.apiKeys ? <WorkspacePage /> : <ManualAIEditorPage />} />
        <Route path="riwayat" element={<HistoryPage />} />
        <Route path="riwayat/:id" element={<HistoryPage />} />
        <Route path="pengaturan" element={<SettingsPage />} />
        {legacyRouteElements()}
      </Route>
    </Routes>
  );
```

`src/pages/SettingsPage.tsx` (temporary, replaced in Task 14): import `ManualDownloaderPage`, `HelpPage`, `useScrollToHash`; call `useScrollToHash()` at the top of the component; append inside the column, after the updater section:

```tsx
        <section id="pengunduh" tabIndex={-1}><ManualDownloaderPage /></section>
        <section id="bantuan" tabIndex={-1}><HelpPage /></section>
```

`src/hooks/useErrorActions.ts`: `openSettings: () => navigate("/settings")` becomes `openSettings: () => navigate(\`${ROUTES.settings}#${SETTINGS_ANCHORS.advanced}\`)` (import both from `../lib/routes`).

`src/hooks/useClipJobs.ts`: `window.location.hash = "#/history";` becomes `window.location.hash = "#/riwayat";` (Task 11 removes the jump).

Delete `src/components/sidebar/Sidebar.tsx` and `src/pages/LandingPage.tsx`.

- [ ] **Step 7: Texts** (`node scripts/add-locale-keys.mjs`)

```json
{
  "id": {
    "nav": { "label": "Menu utama", "create": "Buat klip", "projects": "Riwayat", "settings": "Pengaturan" },
    "banner": {
      "status_connecting": "Menghubungkan…",
      "status_connected": "Terhubung",
      "status_disconnected": "Terputus",
      "status_reconnecting": "Menghubungkan ulang…",
      "lost_title": "Auto Clipper tidak tersambung",
      "lost_app": "Bagian aplikasi yang memproses video berhenti. Tekan Hubungkan ulang untuk menyalakannya lagi.",
      "lost_window": "Jendela Auto Clipper Web tidak menjawab. Pastikan jendela itu masih terbuka, lalu tekan Hubungkan ulang.",
      "lost_none": "Server di Google Colab tidak menjawab. Pastikan kotak server di Colab masih berjalan, lalu tekan Hubungkan ulang.",
      "reconnect": "Hubungkan ulang"
    }
  },
  "en": {
    "nav": { "label": "Main menu", "create": "Make clips", "projects": "History", "settings": "Settings" },
    "banner": {
      "status_connecting": "Connecting…",
      "status_connected": "Connected",
      "status_disconnected": "Disconnected",
      "status_reconnecting": "Reconnecting…",
      "lost_title": "Auto Clipper is not connected",
      "lost_app": "The part of the app that processes videos stopped. Press Reconnect to start it again.",
      "lost_window": "The Auto Clipper Web window is not answering. Make sure it is still open, then press Reconnect.",
      "lost_none": "The Google Colab server is not answering. Make sure the server cell in Colab is still running, then press Reconnect.",
      "reconnect": "Reconnect"
    }
  }
}
```

- [ ] **Step 8: Run all checks and look at it**

`npx vitest run` → 151 passing (140 + 1 caps + 7 routes + 3 nav; record the printed total). `npx oxlint src` 0 errors. `npm run build`, `npm run build:cloud` exit 0. In the browser (built app via `backend.main --web`): at 360 px wide the bottom bar shows three items and the page content is not hidden behind it (scroll to the very bottom of Settings); at 800 px the side bar shows icon over label; at 1280 px icon beside label; `#/help` lands on Pengaturan scrolled to the help section; Tab reaches the three nav links with a visible focus ring; stop the backend → banner with "Hubungkan ulang".

- [ ] **Step 9: Log and commit**

PROGRESS-LOG entry; ledger `Task 5: complete (...)`.

```bash
git add -A src/platform src/lib/routes.ts src/lib/routes.test.tsx src/components/nav src/hooks src/layouts src/App.tsx src/pages src/components/sidebar src/locales tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): three destinations with bottom and side navigation, redirects and connection banner

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Flow logic: active step, link check, auto title, remembered choices

Spec 4.2 (step order, link check, remembered choices) and Spec gaps 5, 12, 16. Pure functions only, so Tasks 8, 10 and 11 build on tested logic.

**Files:**
- Create: `src/lib/createFlow.ts`, `src/lib/createFlow.test.ts`
- Create: `src/lib/clipChoices.ts`, `src/lib/clipChoices.test.ts`

**Interfaces:**
- Consumes: `Caps` (`src/platform/types.ts`), `CanvasConfig`/`DEFAULT_CANVAS_CONFIG`, `SubtitleConfig`/`DEFAULT_SUBTITLE_CONFIG`.
- Produces (`src/lib/createFlow.ts`):
  - `PREPARE_STAGES = ["download", "extract_audio", "transcribe"]`, `CHOOSE_STAGES = ["ai_analysis"]`, `MAKE_STAGES = ["tracking", "render", "hook_concat", "publish"]` (readonly string tuples)
  - `type FlowStep = 1 | 2 | 3 | 4`; `type StepState = "done" | "active" | "todo"`
  - `interface FlowState { status: string; running: boolean; currentStage: string | null; awaitingAnswer: boolean; makePhase: boolean; hasClips: boolean }`
  - `activeStep(f: FlowState): FlowStep`; `stepStates(active: FlowStep, finished: boolean): StepState[]`
  - `type LinkProblem = "empty" | "unsupported"`; `linkProblem(text: string): LinkProblem | null`
  - `type VideoSourceName = { kind: "link"; url: string } | { kind: "file"; name: string }`; `sourceName(s): string`; `autoProjectTitle(s: VideoSourceName, now: Date): string`
  - `type AiMode = "manual" | "auto"`; `MANUAL_PROVIDER = "manual_ai"`; `effectiveProvider(caps: Pick<Caps, "apiKeys">, aiMode: AiMode, provider: string): string`
- Produces (`src/lib/clipChoices.ts`):
  - `type ShapeValue = "9:16" | "1:1" | "16:9"`; `interface ClipChoices { aspectRatio: ShapeValue; trackingMode: "auto" | "center"; burnSubtitles: boolean; subtitleConfig: SubtitleConfig; canvasConfig: CanvasConfig; enableHook: boolean; enableBroll: boolean; maxClips: number; isGamingVideo: boolean }`
  - `CLIP_CHOICES_KEY = "ac_clip_choices"`, `DEFAULT_CLIP_CHOICES: ClipChoices`, `MAX_CLIP_OPTIONS = [0, 3, 5, 10, 15, 20]`
  - `loadClipChoices(storage: Pick<Storage, "getItem"> | null): ClipChoices`; `saveClipChoices(storage: Pick<Storage, "setItem"> | null, c: ClipChoices): void`

- [ ] **Step 1: Write the failing tests**

`src/lib/createFlow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CAPS } from "../platform/caps";
import { activeStep, autoProjectTitle, effectiveProvider, linkProblem, stepStates, type FlowState } from "./createFlow";

const idle: FlowState = { status: "IDLE", running: false, currentStage: null, awaitingAnswer: false, makePhase: false, hasClips: false };

describe("activeStep (spec 4.2: Video, Siapkan, Pilih momen, Klip)", () => {
  it.each<[string, Partial<FlowState>, number]>([
    ["nothing started", {}, 1],
    ["upload or queue, no stage yet", { running: true, status: "GENERATING" }, 2],
    ["downloading", { running: true, status: "DOWNLOADING", currentStage: "download" }, 2],
    ["making subtitles", { running: true, status: "TRANSCRIBING", currentStage: "transcribe" }, 2],
    ["waiting for the AI answer", { awaitingAnswer: true }, 3],
    ["API key mode picking moments", { running: true, status: "TRANSCRIBING", currentStage: "ai_analysis" }, 3],
    ["tracking faces", { running: true, status: "CROPPING", currentStage: "tracking" }, 4],
    ["answer sent, job still queued", { running: true, status: "PENDING", makePhase: true }, 4],
    ["between two clips", { running: true, status: "CROPPING" }, 4],
    ["clips ready", { status: "DONE", hasClips: true }, 4],
    ["failed before any clip", { status: "ERROR" }, 1],
  ])("%s → step %i", (_name, patch, step) => {
    expect(activeStep({ ...idle, ...patch })).toBe(step);
  });
});

describe("stepStates", () => {
  it("ticks finished steps and marks the active one", () => {
    expect(stepStates(3, false)).toEqual(["done", "done", "active", "todo"]);
  });

  it("ticks every step once the clips are ready", () => {
    expect(stepStates(4, true)).toEqual(["done", "done", "done", "done"]);
  });
});

describe("linkProblem (same list as backend/main.py SUPPORTED_URL_RE)", () => {
  it.each([
    ["https://www.youtube.com/watch?v=abc", null],
    ["youtu.be/abc", null],
    ["https://m.youtube.com/shorts/abc", null],
    ["https://vt.tiktok.com/ZS123/", null],
    ["https://www.instagram.com/reel/abc/", null],
    ["https://x.com/user/status/1", null],
    ["  ", "empty"],
    ["https://vimeo.com/123", "unsupported"],
    ["youtube.com", "unsupported"],
    ["hello", "unsupported"],
  ])("%s → %s", (text, problem) => {
    expect(linkProblem(text)).toBe(problem);
  });
});

describe("autoProjectTitle (the backend needs a unique title)", () => {
  const now = new Date(2026, 10, 20, 14, 5, 9);

  it("names a link after its site and the time", () => {
    expect(autoProjectTitle({ kind: "link", url: "https://youtu.be/abc" }, now)).toBe("YouTube 2026-11-20 14.05.09");
    expect(autoProjectTitle({ kind: "link", url: "https://www.tiktok.com/@a/video/1" }, now)).toBe("TikTok 2026-11-20 14.05.09");
  });

  it("names a file after the file, without characters a folder name cannot hold", () => {
    expect(autoProjectTitle({ kind: "file", name: "Podcast: Radit #12?.mp4" }, now)).toBe("Podcast Radit 12 2026-11-20 14.05.09");
  });
});

describe("effectiveProvider (spec 4.2: manual AI unless API key mode is on)", () => {
  it("uses manual AI by default and on platforms without API keys", () => {
    expect(effectiveProvider(CAPS.desktop, "manual", "openai")).toBe("manual_ai");
    expect(effectiveProvider(CAPS.cloud, "auto", "openai")).toBe("manual_ai");
  });

  it("uses the chosen provider in API key mode", () => {
    expect(effectiveProvider(CAPS.local, "auto", "gemini")).toBe("gemini");
  });
});
```

`src/lib/clipChoices.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_CANVAS_CONFIG } from "../types/canvas";
import { CLIP_CHOICES_KEY, DEFAULT_CLIP_CHOICES, loadClipChoices, saveClipChoices } from "./clipChoices";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => (k in data ? data[k] : null),
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
}

describe("remembered clip choices (spec 4.2)", () => {
  it("starts from good defaults", () => {
    expect(loadClipChoices(null)).toEqual(DEFAULT_CLIP_CHOICES);
    expect(DEFAULT_CLIP_CHOICES.aspectRatio).toBe("9:16");
    expect(DEFAULT_CLIP_CHOICES.burnSubtitles).toBe(true);
  });

  it("keeps the last choices for the next video", () => {
    const storage = memoryStorage();
    const choices = { ...DEFAULT_CLIP_CHOICES, aspectRatio: "1:1" as const, enableHook: true, maxClips: 5 };
    saveClipChoices(storage, choices);
    expect(loadClipChoices(storage)).toEqual(choices);
  });

  it("ignores damaged or unknown values", () => {
    expect(loadClipChoices(memoryStorage({ [CLIP_CHOICES_KEY]: "{not json" }))).toEqual(DEFAULT_CLIP_CHOICES);
    const odd = JSON.stringify({ aspectRatio: "4:5", maxClips: 7, enableHook: "yes", trackingMode: "left" });
    expect(loadClipChoices(memoryStorage({ [CLIP_CHOICES_KEY]: odd }))).toEqual(DEFAULT_CLIP_CHOICES);
  });

  it("does not carry a canvas image to the next video (it lives on one backend's disk)", () => {
    const storage = memoryStorage();
    const canvasConfig = { ...DEFAULT_CANVAS_CONFIG, enabled: true, background_type: "image" as const, background_image_path: "/work/bg.png" };
    saveClipChoices(storage, { ...DEFAULT_CLIP_CHOICES, aspectRatio: "16:9", canvasConfig });
    const loaded = loadClipChoices(storage);
    expect(loaded.canvasConfig.enabled).toBe(true);
    expect(loaded.canvasConfig.background_type).toBe("blur");
    expect(loaded.canvasConfig.background_image_path).toBe("");
  });

  it("survives blocked storage", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(loadClipChoices(blocked)).toEqual(DEFAULT_CLIP_CHOICES);
    expect(() => saveClipChoices(blocked, DEFAULT_CLIP_CHOICES)).not.toThrow();
  });
});
```

Run: `npx vitest run src/lib/createFlow.test.ts src/lib/clipChoices.test.ts` → FAIL (modules missing).

- [ ] **Step 2: Implement `src/lib/createFlow.ts`**

```ts
import type { Caps } from "../platform/types";

// The "Buat klip" flow (spec 4.2): which step is active, plus small helpers for step 1. No React.

/** Stages per step, named as in backend/stage_timer.py and timing.stage_*. */
export const PREPARE_STAGES = ["download", "extract_audio", "transcribe"] as const;
export const CHOOSE_STAGES = ["ai_analysis"] as const;
export const MAKE_STAGES = ["tracking", "render", "hook_concat", "publish"] as const;

export type FlowStep = 1 | 2 | 3 | 4;
export type StepState = "done" | "active" | "todo";

export interface FlowState {
  /** Status from useClipJobs: IDLE, GENERATING, PENDING, DOWNLOADING, TRANSCRIBING, CROPPING, DONE, ERROR. */
  status: string;
  running: boolean;
  /** `current.stage` of the job status, or null between stages. */
  currentStage: string | null;
  /** A project waits for the pasted AI answer. */
  awaitingAnswer: boolean;
  /** The running job started at clip making (answer sent, re-render), so "no stage yet" means step 4. */
  makePhase: boolean;
  /** This flow's clips are on screen. */
  hasClips: boolean;
}

const isIn = (list: readonly string[], stage: string | null) => !!stage && list.includes(stage);

export function activeStep(f: FlowState): FlowStep {
  if (f.awaitingAnswer) return 3;
  if (f.running) {
    if (isIn(CHOOSE_STAGES, f.currentStage)) return 3;
    if (isIn(MAKE_STAGES, f.currentStage) || f.status === "CROPPING" || f.makePhase) return 4;
    return 2;
  }
  return f.hasClips ? 4 : 1;
}

export function stepStates(active: FlowStep, finished: boolean): StepState[] {
  return ([1, 2, 3, 4] as const).map((n) =>
    n < active || (finished && n === active) ? "done" : n === active ? "active" : "todo",
  );
}

// Same sites as SUPPORTED_URL_RE in backend/main.py; change both together.
const SUPPORTED_LINK =
  /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be|tiktok\.com|vt\.tiktok\.com|instagram\.com|x\.com|twitter\.com)\/.+/i;

export type LinkProblem = "empty" | "unsupported";

export function linkProblem(text: string): LinkProblem | null {
  const link = text.trim();
  if (!link) return "empty";
  return SUPPORTED_LINK.test(link) ? null : "unsupported";
}

export type VideoSourceName = { kind: "link"; url: string } | { kind: "file"; name: string };

const SITES: [RegExp, string][] = [
  [/youtube\.com|youtu\.be/i, "YouTube"],
  [/tiktok\.com/i, "TikTok"],
  [/instagram\.com/i, "Instagram"],
  [/(^|[/.])(x|twitter)\.com/i, "X"],
];

export function sourceName(source: VideoSourceName): string {
  if (source.kind === "file") return source.name.replace(/\.[^.]+$/, "") || "Video";
  return SITES.find(([re]) => re.test(source.url))?.[1] ?? "Video";
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A unique project name, e.g. "YouTube 2026-11-20 14.05.09" (the backend wants a unique title). */
export function autoProjectTitle(source: VideoSourceName, now: Date): string {
  // Same characters backend/jobs.py sanitize_title keeps, so the folder name matches.
  const base =
    sourceName(source)
      .replace(/[^\w\s\-.,()[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60) || "Video";
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
  return `${base} ${date} ${time}`;
}

export type AiMode = "manual" | "auto";
export const MANUAL_PROVIDER = "manual_ai";

/** Manual AI (copy, ask ChatGPT or Gemini, paste) unless API key mode is on where keys exist. */
export function effectiveProvider(caps: Pick<Caps, "apiKeys">, aiMode: AiMode, provider: string): string {
  return caps.apiKeys && aiMode === "auto" && provider ? provider : MANUAL_PROVIDER;
}
```

- [ ] **Step 3: Implement `src/lib/clipChoices.ts`**

```ts
import { DEFAULT_CANVAS_CONFIG, type CanvasConfig } from "../types/canvas";
import { DEFAULT_SUBTITLE_CONFIG, type SubtitleConfig } from "../types/subtitle";

// "Atur tampilan klip" (spec 4.2): good defaults, and the last choices are kept for the next video.

export type ShapeValue = "9:16" | "1:1" | "16:9";

export interface ClipChoices {
  aspectRatio: ShapeValue;
  trackingMode: "auto" | "center";
  burnSubtitles: boolean;
  subtitleConfig: SubtitleConfig;
  canvasConfig: CanvasConfig;
  enableHook: boolean;
  enableBroll: boolean;
  maxClips: number;
  isGamingVideo: boolean;
}

export const CLIP_CHOICES_KEY = "ac_clip_choices";
export const MAX_CLIP_OPTIONS = [0, 3, 5, 10, 15, 20];
const SHAPES: ShapeValue[] = ["9:16", "1:1", "16:9"];

export const DEFAULT_CLIP_CHOICES: ClipChoices = {
  aspectRatio: "9:16",
  trackingMode: "auto",
  burnSubtitles: true,
  subtitleConfig: DEFAULT_SUBTITLE_CONFIG,
  canvasConfig: DEFAULT_CANVAS_CONFIG,
  enableHook: false,
  enableBroll: false,
  maxClips: 0,
  isGamingVideo: false,
};

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function merged<T extends object>(value: unknown, fallback: T): T {
  return isObject(value) ? { ...fallback, ...value } : fallback;
}

export function loadClipChoices(storage: Pick<Storage, "getItem"> | null): ClipChoices {
  let saved: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(CLIP_CHOICES_KEY) || "null");
    if (isObject(parsed)) saved = parsed;
  } catch {
    // Damaged or blocked: the defaults.
  }
  const d = DEFAULT_CLIP_CHOICES;
  const flag = (key: keyof ClipChoices) => (typeof saved[key] === "boolean" ? (saved[key] as boolean) : (d[key] as boolean));
  return {
    // "4:5" from before SP2 is not offered any more: back to vertical.
    aspectRatio: SHAPES.includes(saved.aspectRatio as ShapeValue) ? (saved.aspectRatio as ShapeValue) : d.aspectRatio,
    trackingMode: saved.trackingMode === "center" ? "center" : "auto",
    burnSubtitles: flag("burnSubtitles"),
    subtitleConfig: merged(saved.subtitleConfig, d.subtitleConfig),
    canvasConfig: merged(saved.canvasConfig, d.canvasConfig),
    enableHook: flag("enableHook"),
    enableBroll: flag("enableBroll"),
    maxClips: MAX_CLIP_OPTIONS.includes(saved.maxClips as number) ? (saved.maxClips as number) : d.maxClips,
    isGamingVideo: flag("isGamingVideo"),
  };
}

export function saveClipChoices(storage: Pick<Storage, "setItem"> | null, choices: ClipChoices): void {
  // A canvas image lives on one backend's disk (plan Spec gap 16): not carried to the next video.
  const canvasConfig: CanvasConfig =
    choices.canvasConfig.background_type === "image"
      ? { ...choices.canvasConfig, background_type: "blur", background_image_path: "" }
      : choices.canvasConfig;
  try {
    storage?.setItem(CLIP_CHOICES_KEY, JSON.stringify({ ...choices, canvasConfig }));
  } catch {
    // Storage blocked: the choices still apply to this video.
  }
}
```

- [ ] **Step 4: Run the tests**

`npx vitest run src/lib/createFlow.test.ts src/lib/clipChoices.test.ts` → PASS (createFlow 11 + 2 + 10 + 2 + 2 = 27, clipChoices 5). Whole suite → 183 passing (151 + 32; record the printed total). `npx oxlint src` 0 errors. `npm run build` exit 0.

- [ ] **Step 5: Log and commit**

PROGRESS-LOG entry; ledger `Task 6: complete (...)`.

```bash
git add src/lib/createFlow.ts src/lib/createFlow.test.ts src/lib/clipChoices.ts src/lib/clipChoices.test.ts tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): flow logic for the four steps, link check, auto title and remembered choices

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
