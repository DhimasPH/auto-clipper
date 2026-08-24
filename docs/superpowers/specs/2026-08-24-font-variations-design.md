# Auto Clipper - Subtitle Font Variations Design

## 1. Overview
This feature introduces a dedicated font selector in the Auto Clipper Cloud (Web UI) and Tauri Desktop App, allowing users to override the default font defined by subtitle presets. It includes visual previews of popular fonts commonly used in short-form video editing.

## 2. Supported Fonts
The following fonts will be integrated via Google Fonts in the frontend to allow visual previews:
- **Impact** (System default)
- **Arial** (System default)
- **Montserrat** (Google Fonts)
- **Bebas Neue** (Google Fonts)
- **Poppins** (Google Fonts)
- **Oswald** (Google Fonts)
- **Anton** (Google Fonts)
- **Permanent Marker** (Google Fonts)

*Note: For the video rendering to succeed, these fonts must be installed on the host OS where the backend sidecar is running (Windows/macOS).*

## 3. Frontend Architecture

### 3.1. Google Fonts Integration
Add a `<link>` tag to `web/index.html` (and `src/index.html` for Tauri if needed) to fetch the required web fonts from `fonts.googleapis.com`.

### 3.2. FontSelector Component
Create a new reusable UI component `FontSelector.tsx` in `web/src/components/`:
- **Props**: `value: string`, `onChange: (font: string) => void`
- **UI**: A stylized dropdown (or a custom list via headless UI / native select) where each option is styled with its corresponding `font-family` so users can visually preview the font.
- An option for "Use Preset Default" will be the default state, meaning the system falls back to the font defined in the selected `SubtitlePreset`.

### 3.3. UI Integration (`ClipEditModal.tsx` & `HistoryList.tsx`)
- Introduce a new state: `const [customFont, setCustomFont] = useState<string>("")`
- Render the `FontSelector` below or alongside the `SubtitlePresetBar`.
- When constructing the `subtitle_config` payload for the rerender API, override the `font_family` if `customFont` is not empty:
  ```typescript
  const finalFont = customFont || presetBase.font_family;
  const subtitleConfig = {
    ...DEFAULT_SUBTITLE_CONFIG,
    ...presetBase,
    font_family: finalFont,
  };
  ```

## 4. Backend Architecture
No code changes are strictly necessary on the backend (`crop_utils.py`), as it already accepts the `font_family` field dynamically via the ASS `Style` header generation:
`font_name = cfg.get("font_family", "Arial")`

However, the user running the backend must ensure the requested fonts are installed in their OS for FFmpeg/ASS to resolve them.
