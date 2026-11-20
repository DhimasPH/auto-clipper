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
