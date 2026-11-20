### Task 3: Canvas background image upload through `path_guard` (backend + picker)

Spec 4.7 first bullet and roadmap `T1.y` (both). Local web and cloud picked the image with a browser file input and sent a `blob:` address the backend cannot read. The image is now uploaded to `POST /upload-image` and its backend path is used; every job endpoint refuses a canvas image path that `path_guard` protects (E.14).

**Files:**
- Modify: `backend/main.py` (new `CANVAS_IMAGE_EXTENSIONS`, `api_upload_image`, `_canvas_image_refused`; calls in `api_create_job`, `api_create_manual_job`, `api_rerender_job`, `api_rerun_ai_job`, `api_rerender_clip`)
- Test: `backend/tests/test_canvas_image.py` (create)
- Modify: `src/api.ts` (import `API_URL` from `./platform/backendUrl`; new `uploadCanvasImage`)
- Modify: `src/components/ui/CanvasConfigControls.tsx` (`handleWebFileChange`, upload status and error line)
- Modify: `src/locales/{id,en}.json` (`canvas.uploading_image`, `canvas.upload_failed`)
- Test: `src/components/ui/CanvasConfigControls.test.tsx` (extend)

**Interfaces:**
- Consumes: `path_guard.is_protected`, `path_guard.denied`, `path_guard.safe_upload_name`, `workspace.uploads_dir`.
- Produces:
  - `POST /upload-image` (multipart `file`) → `200 {"status": "success", "path": "<abs path under uploads_dir()/images>"}`; `400` for a non-image name; `403 Access denied` for a protected destination.
  - `uploadCanvasImage(file: File): Promise<string>` in `src/api.ts`.

- [ ] **Step 1: Write the failing backend tests** (`backend/tests/test_canvas_image.py`)

```python
"""Canvas background images go to the backend (SP2 spec 4.7) and job requests cannot point the
canvas image at a private app file (AGENTS.md E.14)."""
import os

import pytest
from fastapi.testclient import TestClient

from backend import jobs, main

client = TestClient(main.app)
DENIED = {"status": "error", "message": "Access denied"}


@pytest.fixture
def library(tmp_path, monkeypatch):
    lib = tmp_path / "library"
    monkeypatch.setenv("AUTO_CLIPPER_WORKSPACE", str(lib))
    monkeypatch.delenv("AUTO_CLIPPER_WORK_DIR", raising=False)
    return lib


def _upload(name, data=b"\x89PNG data", kind="image/png"):
    return client.post("/upload-image", files={"file": (name, data, kind)})


def _images(library):
    return os.path.normcase(str(library / "temp_downloads" / "images")) + os.sep


def test_upload_image_stores_the_file_and_returns_its_backend_path(library):
    r = _upload("latar.png")

    assert r.status_code == 200
    path = r.json()["path"]
    assert os.path.normcase(os.path.abspath(path)).startswith(_images(library))
    assert path.endswith("latar.png")
    assert open(path, "rb").read() == b"\x89PNG data"


def test_two_uploads_with_the_same_name_keep_both_files(library):
    first = _upload("latar.jpg", b"one", "image/jpeg").json()["path"]
    second = _upload("latar.jpg", b"two", "image/jpeg").json()["path"]

    assert first != second
    assert open(first, "rb").read() == b"one"
    assert open(second, "rb").read() == b"two"


@pytest.mark.parametrize("name", ["notes.txt", "clip.mp4", "history.db", "no-extension"])
def test_upload_image_refuses_files_that_are_not_images(library, name):
    assert _upload(name, b"x", "application/octet-stream").status_code == 400


@pytest.mark.parametrize("name", ["../../history.db.png", "..\\..\\cookies\\x.png"])
def test_upload_image_name_cannot_climb_out_of_the_images_folder(library, name):
    r = _upload(name)

    assert r.status_code == 200
    assert os.path.normcase(os.path.abspath(r.json()["path"])).startswith(_images(library))


def test_upload_image_refuses_a_protected_destination(library, monkeypatch):
    monkeypatch.setattr("backend.path_guard.is_protected", lambda path: True)

    r = _upload("latar.png")

    assert r.status_code == 403
    assert r.json() == DENIED


_JOB_REQUESTS = [
    ("/jobs", {"url": "https://youtu.be/abc", "provider": "manual_ai", "api_key": "", "title": "t"}),
    ("/jobs/manual", {"url": "https://youtu.be/abc", "clips": [], "title": "t"}),
    ("/jobs/some-id/rerender", {"provider": "openai", "api_key": ""}),
    ("/jobs/some-id/rerun_ai", {"url": "", "provider": "openai", "api_key": ""}),
    ("/jobs/some-id/clips/0/rerender", {"words": [], "aspect_ratio": "9:16", "caption_style": "standard", "burn_subs": True}),
]
_CREATORS = ("create_job", "create_manual_job", "create_rerender_job", "create_rerun_ai_job", "create_rerender_clip_job")


@pytest.mark.parametrize("path, body", _JOB_REQUESTS)
def test_job_requests_refuse_a_protected_canvas_image(library, monkeypatch, path, body):
    started = []
    for name in _CREATORS:
        monkeypatch.setattr(jobs, name, lambda *a, **k: started.append(1) or "job-1")
    monkeypatch.setattr("backend.ai_utils.ping_provider", lambda *a, **k: None)
    canvas = {"enabled": True, "background_type": "image", "background_image_path": str(library / "history.db")}

    r = client.post(path, json={**body, "canvas_config": canvas})

    assert r.status_code == 403
    assert r.json() == DENIED
    assert started == []


def test_a_job_keeps_an_uploaded_canvas_image(library, monkeypatch):
    image = _upload("latar.png").json()["path"]
    seen = {}
    monkeypatch.setattr(jobs, "create_job", lambda *a, **k: seen.update(k) or "job-1")
    monkeypatch.setattr("backend.ai_utils.ping_provider", lambda *a, **k: None)
    canvas = {"enabled": True, "background_type": "image", "background_image_path": image}

    r = client.post("/jobs", json={**_JOB_REQUESTS[0][1], "canvas_config": canvas})

    assert r.status_code == 200
    assert seen["canvas_config"]["background_image_path"] == image
```

- [ ] **Step 2: Run them to verify they fail**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_canvas_image.py -q -p no:cacheprovider`
Expected: the upload tests FAIL with 404/405 (no route), the job tests FAIL with 200/400 instead of 403.

- [ ] **Step 3: Implement in `backend/main.py`**

Add `import secrets` to the top-level imports if it is not there. After `api_upload_video` add:

```python
CANVAS_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp")


@app.post("/upload-image")
def api_upload_image(file: UploadFile = File(...)):
    """A canvas background image from the browser (spec 4.7): the backend cannot read a blob: address."""
    from backend.path_guard import denied, is_protected, safe_upload_name
    from backend.workspace import uploads_dir
    name = safe_upload_name(file.filename)
    if not name.lower().endswith(CANVAS_IMAGE_EXTENSIONS):
        return JSONResponse(status_code=400, content={"status": "error", "message": "Only PNG, JPG or WEBP images."})
    folder = os.path.abspath(os.path.join(uploads_dir(), "images"))
    # A random part keeps two images with the same name apart.
    path = os.path.join(folder, f"bg_{secrets.token_hex(4)}_{name}")
    if is_protected(path):
        return denied("upload_image", path)
    os.makedirs(folder, exist_ok=True)
    with open(path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"status": "success", "path": path}


def _canvas_image_refused(canvas_config, endpoint: str):
    """E.14: the canvas image is a path from the request like any other. Returns the 403 or None."""
    from backend.path_guard import denied, is_protected
    if canvas_config is None:
        return None
    if isinstance(canvas_config, dict):
        path = canvas_config.get("background_image_path") or ""
    else:
        path = getattr(canvas_config, "background_image_path", "") or ""
    if path and is_protected(path):
        return denied(endpoint, path)
    return None
```

Add as the **first lines** of each handler (before any other check):

```python
    refused = _canvas_image_refused(req.canvas_config, "jobs")                # api_create_job
    if refused:
        return refused
```

with the endpoint names `"jobs"`, `"jobs_manual"` (`api_create_manual_job`), `"jobs_rerender"` (`api_rerender_job`, before its `try:`), `"jobs_rerun_ai"` (`api_rerun_ai_job`, before its `try:`), `"clip_rerender"` (`api_rerender_clip`).

- [ ] **Step 4: Run the backend tests**

Run: `C:\Users\dhima\projects\ac-venv\Scripts\python.exe -m pytest backend/tests/test_canvas_image.py backend/tests/test_protected_paths.py -q -p no:cacheprovider` → PASS. Whole suite → 844 passed, 12 skipped (829 + 15).

- [ ] **Step 5: Write the failing frontend tests** (extend `src/components/ui/CanvasConfigControls.test.tsx`)

At the top, after the imports, add:

```tsx
import i18n from "../../i18n";
import { uploadCanvasImage } from "../../api";

vi.mock("../../api", () => ({ uploadCanvasImage: vi.fn() }));
```

(and drop the bare `import "../../i18n";` line, since `i18n` is now imported by name). Add inside the `describe` block:

```tsx
  async function chooseFile(file: File) {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  it("without OS dialogs uploads the image and keeps the backend path, never a blob: address", async () => {
    vi.mocked(uploadCanvasImage).mockResolvedValue("/work/temp_downloads/images/bg_1a2b3c4d_latar.png");
    const createObjectURL = vi.fn(() => "blob:http://127.0.0.1/1");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL }));
    setPlatform(fakePlatform(CAPS.local, vi.fn(async () => null)));
    const onChange = vi.fn();
    renderControls(onChange);
    const file = new File(["png"], "latar.png", { type: "image/png" });

    await chooseFile(file);

    expect(uploadCanvasImage).toHaveBeenCalledWith(file);
    expect(onChange).toHaveBeenCalledWith({
      ...imageConfig,
      background_type: "image",
      background_image_path: "/work/temp_downloads/images/bg_1a2b3c4d_latar.png",
    });
    expect(createObjectURL).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("says under the button that the upload failed and keeps the old image", async () => {
    vi.mocked(uploadCanvasImage).mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    setPlatform(fakePlatform(CAPS.cloud, vi.fn(async () => null)));
    const onChange = vi.fn();
    renderControls(onChange);

    await chooseFile(new File(["png"], "latar.png", { type: "image/png" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(i18n.t("canvas.upload_failed"));
  });
```

Run: `npx vitest run src/components/ui/CanvasConfigControls.test.tsx` → the two new tests FAIL (`uploadCanvasImage` not called; no alert).

- [ ] **Step 6: Implement the frontend**

`src/api.ts`: change the first import pair to

```ts
import axios from "axios";
import { API_URL } from "./platform/backendUrl";
```

and add:

```ts
/** Upload a canvas background image (spec 4.7); returns the path the backend reads it from. */
export const uploadCanvasImage = async (file: File): Promise<string> => {
  const form = new FormData();
  form.append("file", file);
  const res = await axios.post(`${API_URL}/upload-image`, form);
  if (res.data?.status !== "success" || typeof res.data.path !== "string") {
    throw new Error(res.data?.message || "upload-image failed");
  }
  return res.data.path;
};
```

`src/components/ui/CanvasConfigControls.tsx`: import `useState` with `useRef`, and `import { uploadCanvasImage } from "../../api";`. Inside the component add:

```tsx
  const [uploading, setUploading] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
```

Replace `handleWebFileChange` with:

```tsx
  // The backend cannot read a browser blob: address (spec 4.7): upload the image, keep its backend path.
  const handleWebFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadFailed(false);
    try {
      const path = await uploadCanvasImage(file);
      onChange({ ...config, background_type: "image", background_image_path: path });
    } catch (err) {
      console.error("Canvas image upload failed:", err);
      setUploadFailed(true);
    } finally {
      setUploading(false);
    }
  };
```

Directly after the `<div className="flex items-center gap-3">…</div>` that holds the image button, add:

```tsx
              {uploading && (
                <p role="status" className="text-body text-text-secondary">
                  {t("canvas.uploading_image")}
                </p>
              )}
              {uploadFailed && (
                <p role="alert" className="text-body text-error">
                  {t("canvas.upload_failed")}
                </p>
              )}
```

Locale keys (stdin of `node scripts/add-locale-keys.mjs`):

```json
{
  "id": { "canvas": {
    "uploading_image": "Mengunggah gambar…",
    "upload_failed": "Gambar belum terunggah. Periksa sambungan ke Auto Clipper, lalu pilih gambarnya lagi."
  } },
  "en": { "canvas": {
    "uploading_image": "Uploading the image…",
    "upload_failed": "The image was not uploaded. Check the connection to Auto Clipper, then pick the image again."
  } }
}
```

- [ ] **Step 7: Run all checks**

`npx vitest run` → 91 passing (89 + 2). `npx oxlint src` → 0 errors. `npm run build` and `npm run build:cloud` → exit 0. pytest whole suite → 844 passed, 12 skipped.

- [ ] **Step 8: Log, roadmap and commit**

PROGRESS-LOG entry (endpoint, guard on five job endpoints, picker uploads, test numbers). In `tasks/roadmap-todo.md` tick both `T1.y` lines with the commit hash and the note "canvas image: upload + path_guard (SP2 Task 3); `output_dir` stays a free path (SP3)" — leave `output_dir` explicitly open on the first line (split the line into a ticked canvas part and an open `output_dir` part). Ledger: `Task 3: complete (...)` plus `Ruling: output_dir free path not in spec SP2 — stays SP3 — cost if wrong: none new`.

```bash
git add backend/main.py backend/tests/test_canvas_image.py src/api.ts src/components/ui/CanvasConfigControls.tsx src/components/ui/CanvasConfigControls.test.tsx src/locales/id.json src/locales/en.json tasks/roadmap-todo.md tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "fix(sp2): upload canvas background images instead of sending blob: addresses

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Visual base: colour tokens, type scale, focus, contrast and plain-words tests

Spec 4.6 (visual) and spec 7 step 2 (base style). New token values (Global Constraints table), defined missing colour classes (Spec gap 9), 16 px body text, 44 px controls, visible focus, reduced motion, `<html lang>` and a remembered language, plus two guard tests: WCAG AA over the tokens and banned words in main-screen text.

**Files:**
- Modify: `src/index.css`, `tailwind.config.js`, `src/i18n.ts`
- Modify: `src/components/ui/Button.tsx`, `ToggleSwitch.tsx`, `InputGroup.tsx`, `Select.tsx`, `SegmentedControl.tsx`, `ConfirmDialog.tsx`
- Modify: `src/locales/{id,en}.json` (`timing.stage_render`, `timing.device_encoder`, `common.close`)
- Create: `src/styles/contrast.test.ts`, `src/locales/plainWords.test.ts`, `src/i18n.test.ts`, `src/components/ui/ConfirmDialog.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - Tailwind colour classes used by every later task: `bg-bg-primary`, `bg-bg-secondary`, `bg-bg-surface`, `bg-bg-tertiary`, `text-text-primary`, `text-text-secondary`, `text-text-muted`, `border-border`, `border-border-active`, `bg-accent`, `hover:bg-accent-hover`, `text-on-accent`, `bg-accent-muted`, `bg-input-bg`, `bg-scrim`, `text-error`, `text-danger`, `text-warning`, `text-success`.
  - `MAIN_NAMESPACES` (exported from `src/locales/plainWords.test.ts`): `["nav", "create", "progress", "moment", "result", "projects", "banner"]`; Task 10 adds `"toast"`.
  - `ConfirmDialog` closes on Escape, has `role="dialog"`, focuses its cancel button.
  - `Button` sizes all at least 44 px tall; icon-only buttons 44 × 44.

- [ ] **Step 1: Write the failing tests**

`src/styles/contrast.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// WCAG 2.x contrast of the colour tokens in src/index.css (spec 4.6, antislop R-25).
const css = readFileSync("src/index.css", "utf8");

function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No "${selector} {" block in src/index.css`);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

const TEXT: [string, string][] = [
  ["text-primary", "bg-primary"], ["text-primary", "bg-secondary"], ["text-primary", "bg-surface"],
  ["text-secondary", "bg-primary"], ["text-secondary", "bg-secondary"], ["text-secondary", "bg-surface"],
  ["text-tertiary", "bg-secondary"], ["accent", "bg-primary"], ["accent", "bg-secondary"],
  ["accent", "accent-muted"], ["text-primary", "accent-muted"], ["on-accent", "accent"],
  ["on-accent", "accent-hover"], ["error", "bg-primary"], ["error", "bg-secondary"],
  ["warning", "bg-secondary"], ["success", "bg-secondary"],
];
// Control edges and the focus ring (WCAG 1.4.11): 3:1.
const UI: [string, string][] = [
  ["border-active", "bg-primary"], ["border-active", "bg-secondary"], ["accent", "bg-primary"],
];

describe("contrast formula", () => {
  it("matches the antislop-human reference table", () => {
    expect(contrast("#777777", "#FFFFFF")).toBe(4.48);
    expect(contrast("#000000", "#FFFFFF")).toBe(21);
  });
});

describe.each([
  ["dark", ":root"],
  ["light", '[data-theme="light"]'],
])("%s theme tokens", (_name, selector) => {
  const t = tokens(selector);

  it.each(TEXT)("%s on %s is at least 4.5:1", (fg, bg) => {
    expect(t[fg], `--${fg} missing`).toBeDefined();
    expect(t[bg], `--${bg} missing`).toBeDefined();
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI)("%s against %s is at least 3:1", (fg, bg) => {
    expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(3);
  });
});
```

`src/locales/plainWords.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import en from "./en.json";
import id from "./id.json";

// Spec 4.6: no technical words, no decorative emoji and no em dash in main-screen text.
// Each task that adds a main-screen namespace adds it here (Task 10 adds "toast").
export const MAIN_NAMESPACES = ["nav", "create", "progress", "moment", "result", "projects", "banner"];
const BANNED = [
  "transkripsi", "transcription", "render", "encoder", "json", "sidecar", "token",
  "prompt", "backend", "ffmpeg", "nvenc", "cuda", "whisper",
];
const EMOJI = /\p{Extended_Pictographic}/u;

type Entry = [path: string, text: string];

function texts(node: unknown, path: string): Entry[] {
  if (typeof node === "string") return [[path, node]];
  if (Array.isArray(node)) return node.flatMap((v, i) => texts(v, `${path}.${i}`));
  if (node && typeof node === "object") return Object.entries(node).flatMap(([k, v]) => texts(v, `${path}.${k}`));
  return [];
}

export function mainScreenTexts(locale: Record<string, unknown>): Entry[] {
  const out = MAIN_NAMESPACES.flatMap((ns) => (ns in locale ? texts(locale[ns], ns) : []));
  const timing = (locale.timing ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(timing)) {
    if (key.startsWith("stage_")) out.push(...texts(value, `timing.${key}`));
  }
  return out;
}

describe.each([
  ["id", id],
  ["en", en],
])("main-screen text (%s)", (_lang, locale) => {
  const entries = mainScreenTexts(locale as Record<string, unknown>);

  it("has no technical words", () => {
    const hits = entries
      .filter(([, text]) => BANNED.some((word) => text.toLowerCase().includes(word)))
      .map(([path, text]) => `${path}: ${text}`);
    expect(hits).toEqual([]);
  });

  it("has no emoji and no em dash", () => {
    const hits = entries
      .filter(([, text]) => EMOJI.test(text) || text.includes("\u2014"))
      .map(([path, text]) => `${path}: ${text}`);
    expect(hits).toEqual([]);
  });
});
```

`src/i18n.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import i18n from "./i18n";

describe("language", () => {
  afterEach(() => i18n.changeLanguage("id"));

  it("sets <html lang> so screen readers read the right language", async () => {
    await i18n.changeLanguage("en");
    expect(document.documentElement.lang).toBe("en");
    await i18n.changeLanguage("id");
    expect(document.documentElement.lang).toBe("id");
  });

  it("remembers the chosen language for the next visit", async () => {
    await i18n.changeLanguage("en");
    expect(localStorage.getItem("ac_lang")).toBe("en");
  });
});
```

`src/components/ui/ConfirmDialog.test.tsx`:

```tsx
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import { ConfirmDialog } from "./ConfirmDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ConfirmDialog", () => {
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
  });

  function open(onCancel = vi.fn(), onConfirm = vi.fn()) {
    act(() =>
      root.render(
        <ConfirmDialog isOpen title="Batalkan proses ini?" message="m" confirmLabel="Ya" cancelLabel="Tidak"
          onConfirm={onConfirm} onCancel={onCancel} />,
      ),
    );
    return { onCancel, onConfirm };
  }

  it("is a labelled modal dialog and focuses the safe choice", () => {
    open();
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent).toBe("Batalkan proses ini?");
    expect(document.activeElement?.textContent).toBe("Tidak");
  });

  it("closes with Escape", () => {
    const { onCancel } = open();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
```

Run: `npx vitest run src/styles src/locales src/i18n.test.ts src/components/ui/ConfirmDialog.test.tsx`
Expected: contrast tests FAIL (missing `--on-accent`, `--text-tertiary` dark fails, light `text-text-primary`-on-accent pair missing), plain-words FAIL on `timing.stage_render: Merender klip`, i18n FAIL (`lang` stays `en`), ConfirmDialog FAIL (no `role="dialog"`).

- [ ] **Step 2: Colour tokens and type scale** (`src/index.css`)

Replace the whole `@layer base { … }` block and the custom scrollbar rules with:

```css
@layer base {
  /* SP2 (spec 4.6): calm and neutral, one blue accent, light and dark. Dark is the default,
     light applies with data-theme="light" (useTheme). Every text/background pair is checked
     for WCAG AA by src/styles/contrast.test.ts; change a value only with that test green. */
  :root {
    color-scheme: dark;
    --bg-primary: #141517;
    --bg-secondary: #1C1D20;
    --bg-elevated: #1C1D20;
    --bg-surface: #26272B;

    --accent: #7EA8FF;
    --accent-hover: #A3C1FF;
    --accent-muted: #1E2A40;
    --on-accent: #0D1B33;

    --text-primary: #ECECEA;
    --text-secondary: #A6A8AD;
    --text-tertiary: #A6A8AD;

    --border: #2E3034;
    --border-active: #7A7D84;

    --success: #6FD39A;
    --error: #FF8A80;
    --warning: #F2B866;
    --info: #7EA8FF;
    --scrim: rgba(0, 0, 0, 0.6);
  }

  [data-theme="light"] {
    color-scheme: light;
    --bg-primary: #F6F6F4;
    --bg-secondary: #FFFFFF;
    --bg-elevated: #FFFFFF;
    --bg-surface: #ECECE9;

    --accent: #1F5FCC;
    --accent-hover: #194FAA;
    --accent-muted: #E8EEFB;
    --on-accent: #FFFFFF;

    --text-primary: #1C1D1F;
    --text-secondary: #55585E;
    --text-tertiary: #55585E;

    --border: #DCDDD9;
    --border-active: #85888E;

    --success: #1E7A3E;
    --error: #B42318;
    --warning: #9A5B00;
    --info: #1F5FCC;
    --scrim: rgba(0, 0, 0, 0.45);
  }

  body {
    @apply bg-[var(--bg-primary)] text-[var(--text-primary)] min-h-screen font-sans;
    margin: 0;
  }

  /* 16 px in form fields: readable on a phone, and iOS does not zoom in on focus. */
  input,
  select,
  textarea {
    font-size: 16px;
  }

  /* Visible keyboard focus everywhere (antislop R-32); components may add a ring on top. */
  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
}

@layer utilities {
  .text-page-title {
    @apply text-[24px] leading-tight font-bold;
  }
  .text-section-title {
    @apply text-[20px] leading-snug font-semibold;
  }
  .text-card-title {
    @apply text-[18px] leading-snug font-semibold;
  }
  .text-body {
    @apply text-[16px] leading-relaxed font-normal;
  }
  .text-label {
    @apply text-[14px] font-medium;
  }
  .text-caption {
    @apply text-[14px] font-normal;
  }
  .text-overline {
    @apply text-[12px] font-semibold uppercase tracking-wide;
  }
}

::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: var(--bg-primary);
}
::-webkit-scrollbar-thumb {
  background: var(--border-active);
  border-radius: 4px;
}
```

`tailwind.config.js`, inside `theme.extend.colors`: add `tertiary: 'var(--bg-surface)'` to `bg`, `muted: 'var(--text-secondary)'` to `text`, and the top-level entries

```js
        'on-accent': 'var(--on-accent)',
        'input-bg': 'var(--bg-secondary)',
        scrim: 'var(--scrim)',
        danger: 'var(--error)',
```

- [ ] **Step 3: Language** (`src/i18n.ts`)

Replace the `i18n.use(...).init({...})` call with:

```ts
function savedLanguage(): string {
  try {
    const saved = localStorage.getItem("ac_lang");
    return saved === "en" || saved === "id" ? saved : "id";
  } catch {
    return "id";
  }
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

/** <html lang> follows the language (screen readers), and the choice is kept for the next visit. */
function applyLanguage(lng: string): void {
  const lang = lng.startsWith("en") ? "en" : "id";
  if (typeof document !== "undefined") document.documentElement.lang = lang;
  try {
    localStorage.setItem("ac_lang", lang);
  } catch {
    // Storage blocked: the language still applies for this visit.
  }
}

applyLanguage(i18n.language);
i18n.on("languageChanged", applyLanguage);
```

- [ ] **Step 4: Primitives**

`src/components/ui/Button.tsx`: replace `baseClasses`, `variants` and `sizes` and the icon rendering with:

```tsx
  const baseClasses =
    'inline-flex items-center justify-center gap-2 rounded-button text-label transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-accent hover:bg-accent-hover text-on-accent font-semibold',
    outline: 'border border-border-active bg-bg-secondary hover:bg-bg-surface text-text-primary',
    ghost: 'hover:bg-bg-surface text-text-primary',
    danger: 'border border-error text-error bg-bg-secondary hover:bg-bg-surface',
  };

  // Every size keeps a 44 px touch target (spec 4.6); icon-only buttons are 44 × 44.
  const sizes = {
    sm: 'min-h-[44px] px-3',
    md: 'min-h-[44px] px-4',
    lg: 'min-h-[52px] px-6 text-body font-semibold',
  };
  const iconOnly = !children ? 'min-w-[44px] !px-0' : '';
```

use `${iconOnly}` in the class list, add `aria-busy={loading || undefined}` to the `<button>`, and render icons as `<Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />` / `<Icon className="w-5 h-5" aria-hidden="true" />` (no `mr-2`; the `gap-2` spaces them).

`src/components/ui/ToggleSwitch.tsx`: replace the returned JSX with:

```tsx
    <label className={`inline-flex min-h-[44px] items-center gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <span className="relative inline-flex">
        <input
          type="checkbox"
          role="switch"
          aria-checked={checked}
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
        />
        <span
          aria-hidden="true"
          className={`block w-11 h-6 rounded-full border transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg-primary ${
            checked ? 'bg-accent border-accent' : 'bg-bg-surface border-border-active'
          }`}
        />
        <span
          aria-hidden="true"
          className={`absolute left-1 top-1 w-4 h-4 rounded-full transition-transform duration-150 ${
            checked ? 'translate-x-5 bg-on-accent' : 'bg-text-secondary'
          }`}
        />
      </span>
      {label && <span className="text-body text-text-primary">{label}</span>}
    </label>
```

(`bg-text-secondary` needs `text-secondary` as a colour: it already is one through `text.secondary`, so the class is `bg-text-secondary`.)

`src/components/ui/InputGroup.tsx`: use React's `useId` (`const autoId = useId(); const inputId = id || autoId; const helpId = \`${inputId}-help\`;`), give the input `aria-invalid={error || undefined}` and `aria-describedby={helperText ? helpId : undefined}`, give the helper `<p id={helpId}>`, and change the input classes to `w-full min-h-[44px] bg-bg-secondary border ${error ? 'border-error' : 'border-border-active focus:border-accent'} rounded-input py-2 … text-body …` (keep the rest).

`src/components/ui/Select.tsx`: the `<select>` gets `min-h-[44px] bg-bg-secondary border-border-active` in place of its current height, background and border classes.

`src/components/ui/SegmentedControl.tsx`: each option button gets `min-h-[44px]` and `aria-pressed={isActive}`; active style `bg-bg-secondary text-text-primary shadow-sm border border-border-active`.

`src/components/ui/ConfirmDialog.tsx`: replace the component body with:

```tsx
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-scrim p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-bg-secondary w-full max-w-md rounded-card border border-border shadow-dropdown"
      >
        <div className="flex justify-between items-start gap-3 p-5 border-b border-border">
          <h2 id={titleId} className="text-section-title text-text-primary">{title}</h2>
          <Button variant="ghost" icon={X} aria-label={t('common.close', 'Tutup')} onClick={onCancel} />
        </div>
        <p className="p-5 text-body text-text-primary">{message}</p>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 p-5 border-t border-border">
          <Button ref={cancelRef} variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={isDestructive ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
```

with imports `React, { useEffect, useId, useRef }`, `useTranslation`, `X` from lucide and `Button`. `Button` must forward the ref: wrap it as `export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({…}, ref) => (<button ref={ref} …>…</button>));` and set `Button.displayName = 'Button'`. (The `AlertTriangle` decoration goes: the destructive button already says what happens.)

- [ ] **Step 5: Locale texts**

Edit the values in place (the add script refuses changed texts):
- `timing.stage_render`: id `Membuat klip`, en `Making the clips` (question 3).
- `timing.device_encoder`: id `Pembuatan klip`, en `Making the clips`.

Add with `node scripts/add-locale-keys.mjs`:

```json
{ "id": { "common": { "close": "Tutup" } }, "en": { "common": { "close": "Close" } } }
```

- [ ] **Step 6: Contrast cross-check with the antislop-human script**

Run (Git Bash) and paste the output into the ledger entry of this task:

```bash
S="C:/Users/dhima/.claude/plugins/cache/anti-slop/antislop/3.2.17/skills/antislop-human/contrast-check.py"
P=/c/Users/dhima/projects/ac-venv/Scripts/python.exe
for pair in "#1C1D1F #F6F6F4" "#55585E #ECECE9" "#FFFFFF #1F5FCC" "#1F5FCC #F6F6F4" "#B42318 #FFFFFF" "#ECECEA #141517" "#A6A8AD #26272B" "#0D1B33 #7EA8FF" "#7EA8FF #141517" "#FF8A80 #1C1D20"; do set -- $pair; echo "$1 on $2: $($P "$S" "$1" "$2" | head -1)"; done
```

Expected: every ratio ≥ 4.5 (values from planning: 15.59, 6.03, 5.89, 5.44, 6.57, 15.45, 6.27, 7.31, 7.77, 7.38). If the plugin path is missing, the Vitest contrast test is the record.

- [ ] **Step 7: Run all checks**

`npx vitest run` → 91 + new (contrast: 1 + 2 × (17 + 3) = 41; plain words 4; i18n 2; ConfirmDialog 2) = 140 passing. `npx oxlint src` 0 errors. `npm run build`, `npm run build:cloud` exit 0. Open the built app once (`backend.main --web`) in light and dark: primary buttons are blue with white (light) / dark navy (dark) text; nothing lost its colour.

- [ ] **Step 8: Log and commit**

PROGRESS-LOG entry; ledger `Task 4: complete (...)` with the Step 6 output.

```bash
git add src/index.css tailwind.config.js src/i18n.ts src/i18n.test.ts src/styles/contrast.test.ts src/locales src/components/ui tasks/PROGRESS-LOG.md tasks/sp2-ledger.md
git commit -m "feat(sp2): calm colour tokens, 16 px body text, 44 px controls, focus and contrast tests

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
