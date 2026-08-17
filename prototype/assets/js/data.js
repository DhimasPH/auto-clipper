/* =============================================================================
   MOCK DATA — Auto Clipper UI/UX Revamp Prototype
   -----------------------------------------------------------------------------
   No backend. Every shape here mirrors the real app so the prototype can be
   read as a spec:

     Clip          -> src/components/ClipCard.tsx (Clip, SocialData)
     CanvasConfig  -> src/types/canvas.ts
     SubtitleConfig-> src/types/subtitle.ts
     Providers     -> src/lib/providers.ts
     Job payload   -> src/hooks/useClipJobs.ts (POST /jobs)

   STATUS VOCABULARY (proposed, see README "Status mapping"):
     QUEUED · DOWNLOADING · TRANSCRIBING · ANALYZING · RENDERING
     DONE · ERROR · CANCELLED · AWAITING_MANUAL
============================================================================= */

window.AC = window.AC || {};

/* --------------------------------------------------------------------------
   Phases — the visible spine of a job.
   ANALYZING is NEW: in the current build the LLM highlight step has no status
   of its own, so the UI silently sits on TRANSCRIBING while it runs.
-------------------------------------------------------------------------- */
AC.PHASES = [
  { key: 'DOWNLOADING',  label: 'Downloading',   desc: 'Fetching source video',            icon: 'download' },
  { key: 'TRANSCRIBING', label: 'Transcribing',  desc: 'Whisper speech-to-text',           icon: 'mic' },
  { key: 'ANALYZING',    label: 'Finding moments', desc: 'AI scores highlight candidates', icon: 'sparkles' },
  { key: 'RENDERING',    label: 'Rendering clips', desc: 'Crop, canvas & subtitle burn-in', icon: 'film' },
];

AC.STATUS_META = {
  QUEUED:          { label: 'Queued',        tone: 'neutral', icon: 'clock' },
  DOWNLOADING:     { label: 'Downloading',   tone: 'info',    icon: 'download' },
  TRANSCRIBING:    { label: 'Transcribing',  tone: 'info',    icon: 'mic' },
  ANALYZING:       { label: 'Analyzing',     tone: 'info',    icon: 'sparkles' },
  RENDERING:       { label: 'Rendering',     tone: 'info',    icon: 'film' },
  DONE:            { label: 'Completed',     tone: 'success', icon: 'check' },
  ERROR:           { label: 'Failed',        tone: 'error',   icon: 'alert' },
  CANCELLED:       { label: 'Cancelled',     tone: 'neutral', icon: 'ban' },
  AWAITING_MANUAL: { label: 'Needs your AI', tone: 'warning', icon: 'hand' },
};

AC.MODES = [
  {
    id: 'ai',
    label: 'AI Auto',
    tagline: 'Let the AI pick the moments',
    desc: 'Transcribes, scores every segment and renders the best clips end to end. Needs an API key.',
    icon: 'sparkles',
    est: '~8 min for a 45 min video',
  },
  {
    id: 'byo_llm',
    label: 'Bring your own LLM',
    tagline: 'You run the prompt yourself',
    desc: 'Auto Clipper prepares the prompt, you paste it into any chat model, then paste the result back. No API key needed.',
    icon: 'hand',
    est: '~5 min + your own turnaround',
  },
  {
    id: 'download',
    label: 'Download only',
    tagline: 'Just get the file',
    desc: 'Downloads the full video with optional burned-in subtitles. No clipping, no AI.',
    icon: 'download',
    est: '~3 min for a 45 min video',
  },
];

AC.PROVIDERS = [
  { id: 'openai',     label: 'OpenAI',                    defaultModel: 'gpt-4o-mini',            hasKey: true  },
  { id: 'gemini',     label: 'Google Gemini',             defaultModel: 'gemini-3.6-flash',       hasKey: true  },
  { id: 'deepseek',   label: 'DeepSeek',                  defaultModel: 'deepseek-chat',          hasKey: false },
  { id: 'groq',       label: 'Groq',                      defaultModel: 'llama-3.3-70b-versatile',hasKey: false },
  { id: 'openrouter', label: 'OpenRouter',                defaultModel: 'openai/gpt-4o-mini',     hasKey: false },
  { id: 'xai',        label: 'xAI Grok',                  defaultModel: 'grok-2-latest',          hasKey: false },
  { id: 'mistral',    label: 'Mistral',                   defaultModel: 'mistral-large-latest',   hasKey: false },
  { id: 'custom',     label: 'Custom (OpenAI compatible)',defaultModel: '',                       hasKey: false },
];

AC.ASPECT_RATIOS = [
  { id: '9:16', label: '9:16', sub: 'Vertical',  w: 9,  h: 16, use: 'TikTok · Reels · Shorts' },
  { id: '4:5',  label: '4:5',  sub: 'Portrait',  w: 4,  h: 5,  use: 'Instagram feed' },
  { id: '1:1',  label: '1:1',  sub: 'Square',    w: 1,  h: 1,  use: 'Feed · carousel' },
  { id: '16:9', label: '16:9', sub: 'Landscape', w: 16, h: 9,  use: 'YouTube · keeps full frame' },
];

AC.DEFAULT_CANVAS_CONFIG = {
  enabled: false,
  background_type: 'blur',
  blur_level: 'medium',
  background_color: '#0f172a',
  background_image_path: '',
  enlarge_scale: 1.0,
};

AC.DEFAULT_SUBTITLE_CONFIG = {
  style: 'single_word',
  font_family: 'Impact',
  font_size_scale: 1.0,
  font_weight: 'bold',
  italic: false,
  uppercase: true,
  highlight_color: '#FFE600',
  text_color: '#FFFFFF',
  outline_color: '#000000',
  shadow_color: '#000000',
  outline_width: 3,
  shadow_depth: 4,
  animation_pop: true,
  watermark_text: '',
  watermark_opacity: 0.5,
  // NEW in this revamp — closes PRD §6 backlog
  // "konfigurasi bebas mengatur posisi subtitle (X dan Y axis) tiap clip"
  pos_x: 50,
  pos_y: 78,
};

AC.SUBTITLE_PRESETS = [
  { id: 'classic',   label: 'Classic',   desc: 'Clean line captions',       style: 'standard',    font: 'Arial',      upper: false, pop: false },
  { id: 'podcast',   label: 'Podcast',   desc: 'Word highlight, readable',  style: 'karaoke',     font: 'Montserrat', upper: false, pop: false },
  { id: 'viral_pop', label: 'Viral Pop', desc: 'One word, big, animated',   style: 'single_word', font: 'Impact',     upper: true,  pop: true  },
];

/* --------------------------------------------------------------------------
   Word-level transcript for the Studio (mock, ~14s of speech)
-------------------------------------------------------------------------- */
AC.WORDS = (function () {
  // Deliberately contains four plausible speech-to-text mistakes
  // (buisness / tution / thats / their) so the transcript fixer has real work.
  const raw =
    'the thing nobody tells you about starting a buisness is that the first ' +
    'two years are basically just you paying tution on everything you did not ' +
    'know and honestly thats the whole education right their';
  const out = [];
  let t = 0.4;
  raw.split(' ').forEach((w, i) => {
    const dur = 0.16 + (w.length * 0.035);
    out.push({ word: w, start: +t.toFixed(2), end: +(t + dur).toFixed(2), i });
    t += dur + 0.045;
  });
  return out;
})();

/* --------------------------------------------------------------------------
   Social kit fixture
-------------------------------------------------------------------------- */
AC.SOCIAL_SAMPLE = {
  titles_en: [
    'The first 2 years of business are just tuition',
    'Nobody warns you about THIS part of starting up',
    '"You are paying to learn what you didn\'t know"',
  ],
  description_en:
    'Everyone talks about the wins. Nobody talks about the two years where you are just paying tuition on everything you didn\'t know you didn\'t know. Full episode linked below.',
  hashtags_en: ['#entrepreneurship', '#startup', '#businesslessons', '#founderlife', '#podcastclips'],
  thumbnail_layout:
    'Close-up on the speaker mid-sentence, bold yellow text "2 YEARS OF TUITION" across the lower third, arrow pointing at their face.',
  best_time_to_post_en: 'Tue–Thu, 7–9 PM local time (peak for business content)',
  backsound_en: 'Low-key lo-fi beat, no lyrics — keeps focus on the dialogue',
};

/* --------------------------------------------------------------------------
   Clips
-------------------------------------------------------------------------- */
function clip(i, o) {
  return Object.assign(
    {
      id: 'c' + i,
      index: i,
      title: 'Clip ' + (i + 1),
      description: '',
      start: '00:00',
      end: '00:00',
      duration: 0,
      subs: true,
      score: 0,
      hue: 240,
      social: null,
      rendered_at: 'just now',
      versions: 1,
    },
    o
  );
}

const PODCAST_CLIPS = [
  clip(0, {
    title: 'The 2-year tuition',
    description: 'The first two years of business are just you paying tuition on what you didn\'t know.',
    start: '12:04', end: '12:41', duration: 37, score: 94, hue: 250,
    social: AC.SOCIAL_SAMPLE, versions: 2,
  }),
  clip(1, {
    title: 'Firing your first hire',
    description: 'The hardest conversation he ever had, and why he waited four months too long.',
    start: '28:15', end: '29:02', duration: 47, score: 89, hue: 288,
  }),
  clip(2, {
    title: '"Revenue hides everything"',
    description: 'Why growing fast masked three broken processes for over a year.',
    start: '41:30', end: '42:06', duration: 36, score: 86, hue: 205,
  }),
  clip(3, {
    title: 'The 4am email rule',
    description: 'A small habit that quietly saved the team from burnout.',
    start: '52:48', end: '53:19', duration: 31, score: 81, hue: 162,
  }),
  clip(4, {
    title: 'What he\'d tell his 25-year-old self',
    description: 'Short, blunt, and not what you expect.',
    start: '01:04:11', end: '01:04:52', duration: 41, score: 78, hue: 32,
  }),
];

/* --------------------------------------------------------------------------
   Projects (was: History)
-------------------------------------------------------------------------- */
AC.PROJECTS = [
  {
    id: 'p_9f2a',
    title: 'Founders Talk — Ep. 42',
    url: 'https://youtube.com/watch?v=aQ9-xR2kLmE',
    source_type: 'url',
    source_label: 'YouTube',
    mode: 'ai',
    status: 'DONE',
    created_at: '2026-08-16T09:12:00',
    created_label: 'Today, 09:12',
    duration_seconds: 512,
    quality: '1080p',
    aspect_ratio: '9:16',
    burn_subs: true,
    provider: 'openai',
    model: 'gpt-4o-mini',
    clips: PODCAST_CLIPS,
    failed: 0,
    canvas_config: AC.DEFAULT_CANVAS_CONFIG,
    subtitle_config: AC.DEFAULT_SUBTITLE_CONFIG,
  },
  {
    id: 'p_7c31',
    title: 'Valorant ranked — night session',
    url: 'https://youtube.com/watch?v=Kd83nZqPw1U',
    source_type: 'url',
    source_label: 'YouTube',
    mode: 'ai',
    status: 'RENDERING',
    created_at: '2026-08-16T08:40:00',
    created_label: 'Today, 08:40',
    duration_seconds: 0,
    quality: '1080p',
    aspect_ratio: '9:16',
    burn_subs: true,
    is_gaming: true,
    provider: 'gemini',
    model: 'gemini-3.6-flash',
    clips: [
      clip(0, { title: '1v4 clutch on Ascent', description: 'Full clutch, no comms.', start: '18:22', end: '18:51', duration: 29, score: 96, hue: 350 }),
      clip(1, { title: 'The whiff heard worldwide', description: 'Point blank, 0 damage.', start: '33:07', end: '33:29', duration: 22, score: 88, hue: 12 }),
    ],
    clips_expected: 6,
    failed: 0,
    phase_index: 3,
    phase_detail: 'Rendering clip 3 of 6 · face-tracking crop',
    elapsed: '6m 12s',
    eta: '~4 min left',
    canvas_config: AC.DEFAULT_CANVAS_CONFIG,
    subtitle_config: AC.DEFAULT_SUBTITLE_CONFIG,
  },
  {
    id: 'p_5be8',
    title: 'Design systems deep dive',
    url: 'https://youtube.com/watch?v=Ttp9mQ0xVbA',
    source_type: 'url',
    source_label: 'YouTube',
    mode: 'byo_llm',
    status: 'AWAITING_MANUAL',
    created_at: '2026-08-15T21:05:00',
    created_label: 'Yesterday, 21:05',
    duration_seconds: 0,
    quality: 'best',
    aspect_ratio: '16:9',
    burn_subs: true,
    clips: [],
    failed: 0,
    canvas_config: Object.assign({}, AC.DEFAULT_CANVAS_CONFIG, { enabled: true, background_type: 'blur', blur_level: 'medium', enlarge_scale: 1.2 }),
    subtitle_config: AC.DEFAULT_SUBTITLE_CONFIG,
  },
  {
    id: 'p_2d40',
    title: 'Client testimonial raw',
    url: 'testimonial-raw-final-v3.mp4',
    source_type: 'local',
    source_label: 'Local file',
    mode: 'ai',
    status: 'ERROR',
    created_at: '2026-08-15T16:48:00',
    created_label: 'Yesterday, 16:48',
    duration_seconds: 92,
    quality: '—',
    aspect_ratio: '9:16',
    burn_subs: true,
    clips: [],
    failed: 0,
    failed_phase: 'ANALYZING',
    error_code: 'PROVIDER_401',
    error: 'OpenAI rejected the request: invalid API key.',
    error_hint: 'The key saved in Settings → AI Provider was rejected. Transcription already finished, so fixing the key and retrying will resume from the analysis step — the download and transcript are not repeated.',
    canvas_config: AC.DEFAULT_CANVAS_CONFIG,
    subtitle_config: AC.DEFAULT_SUBTITLE_CONFIG,
  },
  {
    id: 'p_1a07',
    title: 'Podcast Radit — full episode',
    url: 'https://youtube.com/watch?v=Lm02nQaXcRt',
    source_type: 'url',
    source_label: 'YouTube',
    mode: 'download',
    status: 'DONE',
    created_at: '2026-08-14T11:20:00',
    created_label: 'Aug 14, 11:20',
    duration_seconds: 143,
    quality: '1080p',
    aspect_ratio: '16:9',
    burn_subs: false,
    clips: [],
    is_download_only: true,
    file_label: 'podcast-radit-full.mp4 · 1.4 GB',
    failed: 0,
    canvas_config: AC.DEFAULT_CANVAS_CONFIG,
    subtitle_config: AC.DEFAULT_SUBTITLE_CONFIG,
  },
  {
    id: 'p_8e55',
    title: 'Tutorial Figma — auto layout',
    url: 'https://youtube.com/watch?v=Qw81mZpLkXs',
    source_type: 'url',
    source_label: 'YouTube',
    mode: 'ai',
    status: 'CANCELLED',
    created_at: '2026-08-13T19:02:00',
    created_label: 'Aug 13, 19:02',
    duration_seconds: 61,
    quality: '720p',
    aspect_ratio: '9:16',
    burn_subs: true,
    clips: [],
    failed: 0,
    cancelled_at_phase: 'TRANSCRIBING',
    canvas_config: AC.DEFAULT_CANVAS_CONFIG,
    subtitle_config: AC.DEFAULT_SUBTITLE_CONFIG,
  },
];

AC.QUEUE = [
  { id: 'p_7c31', title: 'Valorant ranked — night session', status: 'RENDERING', pct: 72, detail: 'Clip 3 of 6 · face-tracking crop', eta: '~4 min left' },
  { id: 'p_3f19', title: 'Weekly standup recap', status: 'QUEUED', pct: 0, detail: 'Waiting for the renderer', eta: 'Starts after current job' },
];

AC.LOG_LINES = [
  { t: '08:40:02', lvl: 'info', msg: 'Job accepted · workspace ./projects/valorant-ranked-night-session' },
  { t: '08:40:03', lvl: 'info', msg: 'yt-dlp: selected format 137+140 (1080p / m4a)' },
  { t: '08:41:55', lvl: 'ok',   msg: 'Download complete · 1.82 GB in 1m 52s' },
  { t: '08:41:56', lvl: 'info', msg: 'Layout detection: landscape 1920x1080, facecam candidate at (1512, 742)' },
  { t: '08:41:57', lvl: 'info', msg: 'Whisper model "small" loaded on CPU' },
  { t: '08:44:31', lvl: 'ok',   msg: 'Transcription complete · 1,284 segments' },
  { t: '08:44:32', lvl: 'info', msg: 'Gemini gemini-3.6-flash · scoring 1,284 segments' },
  { t: '08:45:10', lvl: 'warn', msg: 'Provider returned 429, retrying in 4s (attempt 1 of 3)' },
  { t: '08:45:19', lvl: 'ok',   msg: '6 highlights selected' },
  { t: '08:45:20', lvl: 'info', msg: 'NVENC available · h264_nvenc' },
  { t: '08:45:41', lvl: 'ok',   msg: 'Clip 1 rendered · 29.0s · 9:16' },
  { t: '08:46:12', lvl: 'ok',   msg: 'Clip 2 rendered · 22.0s · 9:16' },
  { t: '08:46:13', lvl: 'info', msg: 'Clip 3 · face-tracking crop, 812 frames' },
];

/* --------------------------------------------------------------------------
   The prompt handed to the user in BYO-LLM mode
-------------------------------------------------------------------------- */
AC.MANUAL_PROMPT = `You are a short-form video editor. Below is a timestamped transcript.
Pick the 5 most engaging standalone moments (15-60s each).

Return ONLY a JSON array, no prose:
[{"start": 723.4, "end": 761.0, "title": "...", "reason": "..."}]

TRANSCRIPT:
[0.00] Welcome back to another deep dive on design systems...
[14.20] ...and I think the mistake most teams make is starting with components.
[31.80] You don't start with a button. You start with the decisions.
[52.10] Tokens are just decisions someone already made, written down.
[78.40] ...
(1,284 segments truncated for this prototype)`;

AC.MANUAL_RESULT_SAMPLE = `[
  {"start": 31.8,  "end": 68.2,  "title": "You don't start with a button", "reason": "Contrarian hook, clean standalone thought"},
  {"start": 152.4, "end": 191.0, "title": "Tokens are decisions written down", "reason": "Quotable definition, high save rate"},
  {"start": 402.7, "end": 448.1, "title": "The naming argument that lasted 3 weeks", "reason": "Story with a punchline"},
  {"start": 610.2, "end": 652.9, "title": "When to break your own system", "reason": "Practical, addresses common objection"},
  {"start": 890.5, "end": 934.0, "title": "The handoff is the product", "reason": "Strong closing statement"}
]`;

AC.PARSED_HIGHLIGHTS = [
  { start: 31.8,  end: 68.2,  title: "You don't start with a button",           reason: 'Contrarian hook, clean standalone thought', dur: 36 },
  { start: 152.4, end: 191.0, title: 'Tokens are decisions written down',        reason: 'Quotable definition, high save rate',       dur: 39 },
  { start: 402.7, end: 448.1, title: 'The naming argument that lasted 3 weeks',  reason: 'Story with a punchline',                    dur: 45 },
  { start: 610.2, end: 652.9, title: 'When to break your own system',            reason: 'Practical, addresses common objection',     dur: 43 },
  { start: 890.5, end: 934.0, title: 'The handoff is the product',               reason: 'Strong closing statement',                  dur: 43 },
];

AC.getProject = function (id) {
  return AC.PROJECTS.filter(function (p) { return p.id === id; })[0] || AC.PROJECTS[0];
};

/* =============================================================================
   ADDITIONS — mirroring controls that exist in the real app
   SubtitleConfigControls.tsx / CanvasConfigControls.tsx / HelpPage.tsx /
   TranscriptionSection.tsx
============================================================================= */

/* SubtitleConfigControls.tsx FONT_PRESETS — caption shown is label.split(" ")[0] */
AC.FONT_PRESETS = [
  { value: 'Arial',       label: 'Arial (Standard)' },
  { value: 'Montserrat',  label: 'Montserrat (Modern)' },
  { value: 'Impact',      label: 'Impact (Bold Headline)' },
  { value: 'Roboto',      label: 'Roboto (Clean)' },
  { value: 'Oswald',      label: 'Oswald (Condensed)' },
  { value: 'Bebas Neue',  label: 'Bebas Neue (Viral)' },
  { value: 'Courier New', label: 'Courier New (Retro)' },
];

/* SubtitleConfigControls.tsx COLOR_PRESETS (highlight swatches) */
AC.HIGHLIGHT_SWATCHES = [
  { label: 'Yellow Neon',     value: '#FFE600' },
  { label: 'Cyan Aqua',       value: '#00FFFF' },
  { label: 'Lime Green',      value: '#00FF66' },
  { label: 'Hot Pink',        value: '#FF3366' },
  { label: 'Pure White',      value: '#FFFFFF' },
  { label: 'Vibrant Orange',  value: '#FF9900' },
];

AC.FONT_SIZE_STEPS = [0.8, 1.0, 1.2, 1.5];

AC.SUBTITLE_STYLES = [
  { id: 'single_word', icon: 'zap',      title: 'Single Word (Pop)',    desc: 'One word at a time with a pop animation.' },
  { id: 'karaoke',     icon: 'sparkles', title: 'Karaoke (Highlight)',  desc: 'Shows the line and highlights the word being spoken.' },
  { id: 'standard',    icon: 'list',     title: 'Standard',             desc: 'Shows the full line, static.' },
];

/* CanvasConfigControls.tsx COLOR_PRESETS */
AC.CANVAS_COLORS = [
  { label: 'Pitch Black', value: '#000000' },
  { label: 'Dark Slate',  value: '#0F172A' },
  { label: 'Navy Blue',   value: '#1E293B' },
  { label: 'Charcoal',    value: '#334155' },
  { label: 'Pure White',  value: '#FFFFFF' },
];

AC.BLUR_LEVELS = [
  { id: 'light',  label: 'Light' },
  { id: 'medium', label: 'Medium' },
  { id: 'strong', label: 'Strong' },
];

AC.ENLARGE_SCALES = [1.0, 1.2, 1.5, 1.8, 2.0];

/* TranscriptionSection.tsx — list is backend-driven; these mirror the shape */
AC.WHISPER_MODELS = [
  { id: 'tiny',     name: 'Tiny',     disk_size: '75 MB',   vram: '~1 GB',  downloaded: true,  desc: 'Fastest, roughest. Fine for clean single-speaker audio.' },
  { id: 'base',     name: 'Base',     disk_size: '142 MB',  vram: '~1 GB',  downloaded: true,  desc: 'A small step up from Tiny at almost no extra cost.' },
  { id: 'small',    name: 'Small',    disk_size: '466 MB',  vram: '~2 GB',  downloaded: true,  desc: 'Fast and accurate enough for most videos. Recommended.' },
  { id: 'medium',   name: 'Medium',   disk_size: '1.5 GB',  vram: '~5 GB',  downloaded: false, desc: 'Better with technical terms, background noise and accents.' },
  { id: 'large-v3', name: 'Large-v3', disk_size: '2.9 GB',  vram: '~10 GB', downloaded: false, desc: 'Most precise. Noticeably slower on CPU.' },
];
AC.WHISPER_ACTIVE = 'small';

/* HelpPage.tsx — GET /logs/{app|error|ai}. Raw text, coloured client-side. */
AC.LOGS = {
  app: [
    '[2026-08-16 08:40:02] [INFO] Backend started on 127.0.0.1:8000',
    '[2026-08-16 08:40:02] [INFO] FFmpeg 7.1 located at bundled/ffmpeg.exe',
    '[2026-08-16 08:40:02] [INFO] Job p_7c31 accepted · workspace ./projects/valorant-ranked-night-session',
    '[2026-08-16 08:40:03] [INFO] yt-dlp selected format 137+140 (1080p / m4a)',
    '[2026-08-16 08:41:55] [SUCCESS] Download complete · 1.82 GB in 1m 52s',
    '[2026-08-16 08:41:56] [INFO] Layout detection: landscape 1920x1080',
    '[2026-08-16 08:41:56] [INFO] Facecam candidate at (1512, 742) confidence 0.88',
    '[2026-08-16 08:41:57] [INFO] Whisper model "small" loaded on CPU (VAD enabled)',
    '[2026-08-16 08:44:31] [SUCCESS] Transcription complete · 1,284 segments',
    '',
    '[2026-08-16 08:45:20] [INFO] Probing hardware encoder',
    '[2026-08-16 08:45:20] [SUCCESS] NVENC available · using h264_nvenc',
    '[2026-08-16 08:45:41] [SUCCESS] Clip 1 rendered · 29.0s · 9:16 · DONE',
    '[2026-08-16 08:46:12] [SUCCESS] Clip 2 rendered · 22.0s · 9:16 · DONE',
    '[2026-08-16 08:46:13] [INFO] Clip 3 · face-tracking crop, 812 frames',
  ].join('\n'),

  error: [
    '[2026-08-15 16:48:31] [WARNING] Provider returned 429, retrying in 4s (attempt 1 of 3)',
    '[2026-08-15 16:48:39] [WARNING] Provider returned 429, retrying in 8s (attempt 2 of 3)',
    '[2026-08-15 16:48:51] [ERROR] OpenAI rejected the request: invalid API key (401)',
    'Traceback (most recent call last):',
    '  File "backend/ai/provider.py", line 118, in select_highlights',
    '    response = client.chat.completions.create(**payload)',
    '  File "openai/_base_client.py", line 1043, in request',
    '    raise self._make_status_error_from_response(err.response)',
    'openai.AuthenticationError: Error code: 401 - Incorrect API key provided',
    '[2026-08-15 16:48:51] [ERROR] Job p_2d40 failed during ANALYZING',
    '[2026-08-15 16:48:51] [INFO] Transcript preserved — retry will resume from analysis',
    '',
    '[2026-08-14 22:03:10] [WARNING] NVENC init failed, falling back to libx264 (CPU)',
    '[2026-08-14 22:03:10] [INFO] Render will be slower but output is identical',
  ].join('\n'),

  ai: [
    '[2026-08-16 08:44:32] [AI PROMPT] provider=gemini model=gemini-3.6-flash',
    '  You are a short-form video editor. Below is a timestamped transcript.',
    '  Pick the 6 most engaging standalone moments (15-60s each).',
    '  Return ONLY a JSON array.',
    '  --- 1,284 segments, 84,210 chars truncated in log ---',
    '',
    '[2026-08-16 08:45:10] [WARNING] Provider returned 429, retrying in 4s (attempt 1 of 3)',
    '',
    '[2026-08-16 08:45:19] [AI RESPONSE] 6 highlights · 1,842 tokens in / 388 tokens out',
    '  [{"start": 1102.4, "end": 1131.0, "title": "1v4 clutch on Ascent"},',
    '   {"start": 1987.2, "end": 2009.4, "title": "The whiff heard worldwide"}, ...]',
    '[2026-08-16 08:45:19] [SUCCESS] 6 highlights selected',
    '',
    '[2026-08-16 09:12:44] [AI PROMPT] social kit · clip 1 · provider=openai model=gpt-4o-mini',
    '[2026-08-16 09:12:47] [AI RESPONSE] titles=3 hashtags=5 · 512 tokens in / 214 tokens out',
  ].join('\n'),
};

/* =============================================================================
   TRANSCRIPT FIXER
   -----------------------------------------------------------------------------
   ClipEditModal.tsx has TWO ways to correct subtitles, and the first prototype
   pass only kept one:

     'auto'   -> POST /ai/correct-subtitle using the saved API key
     'manual' -> the app WRITES THE PROMPT (instructions + the word-level JSON),
                 you run it in any chat model, and paste the JSON back

   The manual path is the one that serves users with no API key. It also happens
   to be the only path that works today, because the auto path reads the wrong
   localStorage keys (ai_provider vs ac_provider) and almost always reports
   "API Key belum diatur".
============================================================================= */

AC.FIX_MAP = {
  buisness: 'business',
  tution: 'tuition',
  thats: "that's",
  their: 'there',
};

/* Proposed changes, derived from the transcript so indices always line up. */
AC.fixDiffs = function () {
  return AC.WORDS
    .filter(function (w) { return AC.FIX_MAP[w.word]; })
    .map(function (w) {
      return {
        i: w.i,
        start: w.start,
        from: w.word,
        to: AC.FIX_MAP[w.word],
        reason: {
          buisness: 'Common misspelling of "business".',
          tution: 'Whisper heard "tution"; the word is "tuition".',
          thats: 'Missing apostrophe.',
          their: 'Wrong homophone — the sentence needs the place, not the possessive.',
        }[w.word],
      };
    });
};

/* The prompt the app hands to the user — mirrors generatePrompt() in
   ClipEditModal.tsx: fixed English instructions + JSON.stringify(words, null, 2). */
AC.subtitleFixPrompt = function (words) {
  const head =
'You are a subtitle editor. Below is a word-level transcript as JSON.\n' +
'\n' +
'Fix ONLY clear transcription mistakes:\n' +
'  · misspellings and wrong homophones (their/there, your/you\'re)\n' +
'  · missing apostrophes and obvious punctuation\n' +
'  · proper nouns and brand names spelled wrong\n' +
'\n' +
'Rules:\n' +
'  · Do NOT change the number of items, the order, or any start/end value.\n' +
'  · Do NOT rewrite, shorten or paraphrase. One word stays one word.\n' +
'  · Keep the original casing style.\n' +
'  · Return ONLY the JSON array. No prose, no code fence.\n' +
'\n' +
'TRANSCRIPT:\n';
  return head + JSON.stringify(
    words.map(function (w) { return { word: w.word, start: w.start, end: w.end }; }),
    null, 2
  );
};

/* A believable pasted answer, used by the "Use a sample" shortcut. */
AC.subtitleFixSample = function (words) {
  return '```json\n' + JSON.stringify(
    words.map(function (w) {
      return { word: AC.FIX_MAP[w.word] || w.word, start: w.start, end: w.end };
    }), null, 2) + '\n```';
};
