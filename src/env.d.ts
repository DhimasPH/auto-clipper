/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "cloud" for the Vercel build (.env.cloud). */
  readonly VITE_TARGET?: string;
  /** Cloud: the Colab tunnel address, set in Vercel. */
  readonly VITE_API_URL?: string;
  /** "true": use a backend started by hand on 127.0.0.1:8000 with token "dev-token". */
  readonly VITE_DEV_BACKEND?: string;
  readonly VITE_ENABLE_EXPERIMENTAL_FEATURES?: string;
}
