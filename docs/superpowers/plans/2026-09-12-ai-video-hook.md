# AI Video Hook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional "AI Hook" feature that duplicates an engaging 3-5s clip at the start of the video, followed by a synthetic glitch transition.

**Architecture:** We will modify the LLM prompt to return `hook_start` and `hook_end`, generate a glitch transition via FFmpeg, and update the backend renderer to optionally render the hook and concatenate it. We will also update the frontend UI (both Desktop and Web) to expose this toggle.

**Tech Stack:** Python, FFmpeg, React, Vite.

---

### Task 1: Generate Transition Asset and Update PyInstaller Spec

**Files:**
- Create: `backend/assets/glitch_transition.mp4` (Via script)
- Modify: `backend.spec`

- [ ] **Step 1: Create assets directory and generate the glitch transition**

```bash
mkdir backend\assets
ffmpeg -f lavfi -i "nullsrc=s=1080x1920:d=0.5, geq=random(1)*255:128:128" -f lavfi -i "anoise=c=pink:d=0.5" -c:v libx264 -c:a aac -y backend\assets\glitch_transition.mp4
```

- [ ] **Step 2: Modify `backend.spec` to include the assets directory**

Modify `backend.spec` around where `datas` are defined. Add `('backend/assets', 'backend/assets')` to the list of `datas`.

```python
    datas=[
        ('backend/metadata.py', 'backend'),
        ('backend/fonts', 'backend/fonts'),
        ('backend/assets', 'backend/assets'),
    ],
```

- [ ] **Step 3: Commit (if auto_commit enabled)**

Check `.agent/config.yml` for `auto_commit` setting.
If `auto_commit: true` (default when absent):
```bash
git add backend/assets/glitch_transition.mp4 backend.spec
git commit -m "feat: generate hook transition asset and update spec"
```

---

### Task 2: Update AI Prompt for Hook Timestamps

**Files:**
- Modify: `backend/ai_utils.py`

- [ ] **Step 1: Update `HIGHLIGHT_GUIDANCE` to instruct the AI to find a hook**

Modify `HIGHLIGHT_GUIDANCE` in `backend/ai_utils.py` to mention picking a hook.

```python
HIGHLIGHT_GUIDANCE = (
    "Pick the most engaging, self-contained moments for vertical short-form "
    "video (TikTok/Reels/Shorts). Each highlight must: start on a STRONG hook that grabs attention in the first 2 seconds, "
    "contain a complete thought AND a complete sentence (NEVER cut mid-sentence or mid-word), be genuinely "
    "interesting/funny/surprising on its own without context, and run strictly between "
    "20-120 seconds. Set start/end PRECISELY on natural speech pauses (silence gaps). "
    "Prefer longer clips (60-90s) when the narrative arc is compelling, but allow shorter (20-30s) for punchy standalone moments. "
    "Ensure that the first word is clearly spoken from the beginning and the last word finishes completely. "
    "For EACH highlight, you MUST also select a 'hook_start' and 'hook_end' (exactly 3-5 seconds long) from WITHIN the highlight itself. This hook should be the most exciting/curiosity-inducing part of the clip. "
    "Return them in chronological order and avoid intros, filler, and dead air."
)
```

- [ ] **Step 2: Update `SOCIAL_PROMPT_TEMPLATE` JSON schema**

Modify `SOCIAL_PROMPT_TEMPLATE` to require the new JSON fields.

```python
SOCIAL_PROMPT_TEMPLATE = (
    "Return a JSON object with a 'highlights' key holding an array of objects. "
    "Each object must have 'start_time', 'end_time', 'hook_start', 'hook_end' (all in HH:MM:SS.mmm format), "
    "'description_en' (in English), 'description_id' (in Indonesian), "
...
```

- [ ] **Step 3: Commit**

```bash
git add backend/ai_utils.py
git commit -m "feat(ai): update prompt to extract hook timestamps"
```

---

### Task 3: Backend Video Pipeline for Hook

**Files:**
- Modify: `backend/jobs.py`

- [ ] **Step 1: Update `create_job` arguments**

In `backend/jobs.py`, modify `create_job` to accept `enable_hook: bool = False`. Pass it into the `metadata` dictionary.

```python
def create_job(url: str, provider: str, api_key: str, aspect_ratio: str = "9:16", caption_style: str = "standard", burn_subs: bool = True, output_dir: str = "", quality: str = "best", title: str = "", enable_broll: bool = False, pexels_api_key: str = "", max_clips: int = 0, custom_base_url: str = "", custom_model_name: str = "", is_gaming_video: bool = False, whisper_model: str = "small", model: str = "", canvas_config: dict = None, subtitle_config: dict = None, tracking_mode: str = "auto", enable_hook: bool = False) -> str:
...
    job = {
...
        "enable_broll": enable_broll,
        "enable_hook": enable_hook,
...
```

- [ ] **Step 2: Add hook rendering to `_render_video_clips`**

In `backend/jobs.py`, find `_render_video_clips`. When iterating through `segments`, check if `enable_hook` is true and `hook_start` is available.

```python
        try:
            if job.get("enable_hook") and "hook_start" in seg and "hook_end" in seg:
                job["progress"] = f"Merender Hook untuk klip {i+1}..."
                log_app(f"[{job_id}] " + str(f"Merender Hook untuk klip {i+1}..."))
                hook_output = os.path.normpath(os.path.join(ws["clips_dir"], f"{ws['safe_title']}_hook_{i+1}.mp4"))
                main_output = os.path.normpath(os.path.join(ws["clips_dir"], f"{ws['safe_title']}_main_{i+1}.mp4"))
                
                # Render Hook
                crop_to_vertical(output_path, hook_output, seg["hook_start"], seg["hook_end"], subtitle_path=subtitle_path if job.get("burn_subs", True) else None, aspect_ratio=job["aspect_ratio"], register_proc=lambda p: _register_proc(job, p), should_cancel=is_cancelled, broll_path=None, layout=job_layout, canvas_config=job.get("canvas_config"), subtitle_config=job.get("subtitle_config"), tracking_mode=job.get("tracking_mode", "auto"))
                
                # Render Main
                crop_to_vertical(output_path, main_output, seg["start_time"], seg["end_time"], subtitle_path=subtitle_path if job.get("burn_subs", True) else None, aspect_ratio=job["aspect_ratio"], register_proc=lambda p: _register_proc(job, p), should_cancel=is_cancelled, broll_path=broll_path, layout=job_layout, canvas_config=job.get("canvas_config"), subtitle_config=job.get("subtitle_config"), tracking_mode=job.get("tracking_mode", "auto"))

                # Concat
                import subprocess
                job["progress"] = f"Menggabungkan Hook untuk klip {i+1}..."
                transition_asset = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "glitch_transition.mp4")
                concat_cmd = ["ffmpeg", "-y", "-i", hook_output, "-i", transition_asset, "-i", main_output, "-filter_complex", "[0:v]setsar=1[v0];[1:v]setsar=1,scale=1080:1920[v1];[2:v]setsar=1[v2];[v0][0:a][v1][1:a][v2][2:a]concat=n=3:v=1:a=1[v][a]", "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-c:a", "aac", clip_output]
                subprocess.run(concat_cmd, check=True)
                
                # Cleanup temp
                if os.path.exists(hook_output): os.remove(hook_output)
                if os.path.exists(main_output): os.remove(main_output)
            else:
                result_path = crop_to_vertical(
                    output_path, clip_output, seg["start_time"], seg["end_time"],
                    subtitle_path=subtitle_path if job.get("burn_subs", True) else None,
                    aspect_ratio=job["aspect_ratio"],
                    register_proc=lambda p: _register_proc(job, p),
                    should_cancel=is_cancelled,
                    broll_path=broll_path,
                    layout=job_layout,
                    canvas_config=job.get("canvas_config"),
                    subtitle_config=job.get("subtitle_config"),
                    tracking_mode=job.get("tracking_mode", "auto")
                )
```
*(Make sure to adjust indentation and import subprocess if needed).*

- [ ] **Step 3: Update `main.py` API endpoint**

In `backend/main.py`, update `JobRequest` model to accept `enable_hook: bool = False` and pass it to `create_job`.

```python
class JobRequest(BaseModel):
...
    enable_hook: bool = False
...
```

- [ ] **Step 4: Commit**

```bash
git add backend/jobs.py backend/main.py
git commit -m "feat(backend): add hook rendering and concatenation pipeline"
```

---

### Task 4: Frontend UI Updates (Desktop)

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/GenerateForm.tsx`
- Modify: `src/hooks/useClipJobs.ts`

- [ ] **Step 1: Add state to `App.tsx`**

Add `enableHook` state next to `enableBroll`.
```typescript
const [enableHook, setEnableHook] = useState(false);
...
<GenerateForm
  enableHook={enableHook}
  setEnableHook={setEnableHook}
...
```

- [ ] **Step 2: Add Toggle in `GenerateForm.tsx`**

Add the prop types and the actual toggle switch.

```typescript
// Add to Props interface
enableHook: boolean;
setEnableHook: (v: boolean) => void;

// Add to UI near enableBroll toggle
<div className="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-slate-800/50 rounded-xl border border-gray-100 dark:border-slate-700/50">
  <div className="flex flex-col">
    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
      Tambahkan Hook Otomatis
    </span>
    <span className="text-xs text-gray-500 dark:text-gray-400">
      Menduplikasi 3-5 detik momen menarik di awal video sebagai Hook pemancing perhatian.
    </span>
  </div>
  <ToggleSwitch checked={enableHook} onChange={setEnableHook} />
</div>
```

- [ ] **Step 3: Update `useClipJobs.ts` payload**

Make sure to pass `enableHook` to the `/api/job` payload. Add it to `CreateJobParams` interface as well.
```typescript
interface CreateJobParams {
  ...
  enableHook: boolean;
}

// In startAutoJob:
enable_hook: p.enableHook,
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/GenerateForm.tsx src/hooks/useClipJobs.ts
git commit -m "feat(ui): add auto hook toggle"
```

---

### Task 5: Web UI Updates (Cloud)

**Files:**
- Modify: `web/src/types/job.ts` (if it exists, else skip)

- [ ] **Step 1: Check if Cloud UI Job types need update**

If `web/src/types/job.ts` exists, add `enable_hook?: boolean;` to it so the cloud UI can use it when necessary.

- [ ] **Step 2: Commit**

```bash
git add web/src/types/job.ts
git commit -m "feat(web): add enable_hook to job types"
```
