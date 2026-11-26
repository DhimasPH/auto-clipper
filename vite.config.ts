import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// The one app version (SP4 spec 4.1): src/lib/appInfo.ts reads it as __APP_VERSION__.
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset URLs: the same build is loaded by Tauri, by the backend at "/" and by Vercel.
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
