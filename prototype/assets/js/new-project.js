/* =============================================================================
   NEW PROJECT — one door
   -----------------------------------------------------------------------------
   Replaces three sidebar entries (Workspace / Manual AI Editor / Manual
   Downloader) that rendered the same 390-line form and differed only by a
   provider string. Mode is now the first decision, not a menu item.

   Validation is inline and per-field. The current build fires five different
   toasts after submit, and points at Settings without linking to it.
============================================================================= */

const STEPS = [
  { id: 'mode',    label: 'Mode' },
  { id: 'source',  label: 'Source' },
  { id: 'format',  label: 'Format' },
  { id: 'options', label: 'Options' },
  { id: 'review',  label: 'Review' },
];

const STATES = [
  { id: 'mode',    label: '1 · Mode' },
  { id: 'source',  label: '2 · Source' },
  { id: 'format',  label: '3 · Format' },
  { id: 'options', label: '4 · Options' },
  { id: 'review',  label: '5 · Review' },
  { id: 'invalid', label: 'Validation errors' },
];

const raw = AC.qs('state', AC.qs('step', 'mode'));
const invalid = raw === 'invalid';
const step = invalid ? 'source' : raw;

/* Draft the summary rail reads from. In a real build this is one object posted
   to /jobs — the field names below intentionally match that payload. */
const draft = {
  mode: AC.qs('mode', 'ai'),
  input_type: 'url',
  url: invalid ? '' : 'https://youtube.com/watch?v=aQ9-xR2kLmE',
  local_file: '',
  title: invalid ? '' : 'Founders Talk — Ep. 42',
  aspect_ratio: '9:16',
  quality: '1080p',
  burn_subs: true,
  max_clips: 0,
  enable_broll: false,
  is_gaming_video: false,
  whisper_model: 'small',
  provider: 'openai',
  model: 'gpt-4o-mini',
  canvas: Object.assign({}, AC.DEFAULT_CANVAS_CONFIG),
  subtitle: Object.assign({}, AC.DEFAULT_SUBTITLE_CONFIG),
};

const stepIndex = function (id) { return STEPS.map(function (s) { return s.id; }).indexOf(id); };
const go = function (id) { AC.setQs('state', id); };

/* ------------------------------------------------------------------ stepper */
function stepper() {
  const cur = stepIndex(step);
  return (
'<ol class="flex items-center gap-1 mb-7">' +
  STEPS.map(function (s, i) {
    const done = i < cur, now = i === cur;
    return (
      '<li class="flex items-center gap-1 ' + (i ? 'grow' : '') + '">' +
        (i ? '<span class="h-px grow ' + (done ? 'bg-accent' : 'bg-border') + '"></span>' : '') +
        '<a href="new-project.html?state=' + s.id + '" class="flex items-center gap-2 px-2 py-1 rounded-input ' +
          (now ? 'bg-accent-muted' : 'hover:bg-bg-surface') + ' transition-colors">' +
          '<span class="w-5 h-5 rounded-full grid place-items-center t-caption font-semibold shrink-0 ' +
            (done ? 'bg-accent text-white' : now ? 'border-2 border-accent text-accent' : 'border border-border text-text-tertiary') + '">' +
            (done ? AC.icon('check', 'w-3 h-3') : (i + 1)) + '</span>' +
          '<span class="t-label ' + (now ? 'text-accent' : done ? 'text-text-primary' : 'text-text-tertiary') + '">' +
            s.label + '</span>' +
        '</a>' +
      '</li>'
    );
  }).join('') +
'</ol>'
  );
}

/* ------------------------------------------------------------ summary rail */
function summary() {
  const mode = AC.MODES.filter(function (m) { return m.id === draft.mode; })[0];
  const rows = [
    ['Mode', mode.label],
    ['Source', draft.input_type === 'url' ? 'YouTube link' : 'Local file'],
    ['Project title', draft.title || '—'],
  ];
  if (draft.mode !== 'download') rows.push(['Clips', draft.max_clips ? draft.max_clips : 'Auto (by length)']);
  rows.push(['Aspect ratio', draft.aspect_ratio]);
  rows.push(['Subtitles', draft.burn_subs ? 'Burned in' : 'Off']);
  if (draft.mode === 'ai') rows.push(['AI provider', 'OpenAI · gpt-4o-mini']);
  rows.push(['Quality', draft.quality]);

  return (
'<aside class="w-[280px] shrink-0 hidden lg:block">' +
  '<div class="card p-4 sticky top-8">' +
    '<div class="t-overline text-text-tertiary mb-3">Summary</div>' +
    '<dl class="space-y-2.5">' +
      rows.map(function (r) {
        return '<div class="flex items-baseline gap-3">' +
          '<dt class="t-caption text-text-tertiary w-[92px] shrink-0">' + r[0] + '</dt>' +
          '<dd class="t-label text-right grow truncate" data-sum="' + r[0] + '">' + r[1] + '</dd></div>';
      }).join('') +
    '</dl>' +
    '<div class="divider my-4"></div>' +
    '<div class="flex items-center gap-2 t-caption text-text-secondary">' +
      '<span class="text-accent">' + AC.icon('clock', 'w-3.5 h-3.5') + '</span>' + mode.est +
    '</div>' +
    '<p class="t-caption text-text-tertiary mt-3 leading-relaxed">' +
      'Everything runs on this machine. Your footage is never uploaded.' +
    '</p>' +
  '</div>' +
'</aside>'
  );
}

function foot(backId, nextId, nextLabel, disabled) {
  return (
'<div class="flex items-center gap-2 mt-7 pt-5 border-t border-border">' +
  (backId
    ? '<a href="new-project.html?state=' + backId + '" class="btn-secondary">' + AC.icon('arrowleft') + ' Back</a>'
    : '<a href="projects.html" class="btn-ghost">Cancel</a>') +
  '<span class="grow"></span>' +
  (disabled
    ? '<button class="btn-primary" disabled>' + nextLabel + '</button>'
    : '<a href="new-project.html?state=' + nextId + '" class="btn-primary">' + nextLabel + ' ' + AC.icon('arrowright') + '</a>') +
'</div>'
  );
}

/* ------------------------------------------------------------------ step 1 */
function stepMode() {
  return (
'<h2 class="t-section mb-1">What do you want to do?</h2>' +
'<p class="t-body text-text-secondary mb-5">This is the only thing that really differs between runs. Everything after it is the same.</p>' +
'<div class="space-y-2.5">' +
  AC.MODES.map(function (m) {
    const sel = m.id === draft.mode;
    return (
'<label class="card p-4 flex gap-3.5 cursor-pointer transition-all ' +
   (sel ? 'border-accent bg-accent-muted' : 'hover:border-border-active') + '">' +
  '<span class="w-[18px] h-[18px] rounded-full border-2 shrink-0 mt-0.5 grid place-items-center ' +
    (sel ? 'border-accent' : 'border-border') + '">' +
    (sel ? '<span class="w-2 h-2 rounded-full bg-accent"></span>' : '') + '</span>' +
  '<span class="grow min-w-0">' +
    '<span class="flex items-center gap-2 mb-1">' +
      '<span class="text-accent">' + AC.icon(m.icon) + '</span>' +
      '<span class="t-card">' + m.label + '</span>' +
      '<span class="badge-neutral">' + m.est + '</span>' +
    '</span>' +
    '<span class="t-body text-text-secondary block">' + m.desc + '</span>' +
    (m.id === 'ai'
      ? '<span class="flex items-center gap-1.5 t-caption text-success mt-2">' +
        AC.icon('check', 'w-3.5 h-3.5') + 'OpenAI key found in Settings</span>'
      : '') +
  '</span>' +
  '<input type="radio" name="mode" class="sr-only js-mode" value="' + m.id + '"' + (sel ? ' checked' : '') + '/>' +
'</label>'
    );
  }).join('') +
'</div>' +
foot(null, 'source', 'Continue')
  );
}

/* ------------------------------------------------------------------ step 2 */
function stepSource() {
  const urlErr = invalid;
  const titleErr = invalid;
  return (
'<h2 class="t-section mb-1">Where is the video?</h2>' +
'<p class="t-body text-text-secondary mb-5">Paste a link or pick a file from this machine.</p>' +

'<div class="segmented mb-4" id="srctype">' +
  '<span class="segmented-item" data-val="url" aria-selected="true">' + AC.icon('link', 'w-3.5 h-3.5') + ' YouTube link</span>' +
  '<span class="segmented-item" data-val="local">' + AC.icon('upload', 'w-3.5 h-3.5') + ' Local file</span>' +
'</div>' +

'<div class="card p-5 space-y-5">' +

  '<div>' +
    '<label class="field-label" for="url">Video URL</label>' +
    '<div class="relative">' +
      '<span class="absolute left-3 top-1/2 -mt-2 text-text-tertiary">' + AC.icon('link') + '</span>' +
      '<input id="url" class="input input-with-icon' + (urlErr ? ' input-invalid' : '') + '" ' +
        'placeholder="https://youtube.com/watch?v=…" value="' + draft.url + '"/>' +
    '</div>' +
    (urlErr
      ? '<div class="field-error">' + AC.icon('alert', 'w-3.5 h-3.5') + 'Paste a video link to continue.</div>'
      : '<div class="flex items-center gap-2 mt-2">' +
          '<button class="btn-secondary btn-sm js-probe">' + AC.icon('search', 'w-3.5 h-3.5') + ' Check available quality</button>' +
          '<span class="t-caption text-text-tertiary js-probe-out">Optional — confirms what this video actually offers.</span>' +
        '</div>') +
  '</div>' +

  '<div>' +
    '<label class="field-label" for="title">Project title <span class="text-error">*</span></label>' +
    '<div class="relative">' +
      '<span class="absolute left-3 top-1/2 -mt-2 text-text-tertiary">' + AC.icon('folder') + '</span>' +
      '<input id="title" class="input input-with-icon' + (titleErr ? ' input-invalid' : '') + '" ' +
        'placeholder="e.g. Founders Talk Ep. 42" value="' + draft.title + '"/>' +
    '</div>' +
    (titleErr
      ? '<div class="field-error">' + AC.icon('alert', 'w-3.5 h-3.5') + 'Required — this becomes the folder name on disk.</div>'
      : '<p class="field-hint">Becomes the folder name, so this project\'s files never mix with another\'s.</p>') +
  '</div>' +

  '<div>' +
    '<label class="field-label" for="quality">Download quality</label>' +
    '<div class="select-wrap max-w-[240px]">' +
      '<select id="quality" class="select">' +
        ['Best (automatic)', '2160p (4K)', '1440p (2K)', '1080p', '720p', '480p']
          .map(function (q, i) { return '<option' + (i === 3 ? ' selected' : '') + '>' + q + '</option>'; }).join('') +
      '</select>' +
    '</div>' +
    '<p class="field-hint">Higher quality means a longer download and a slower render.</p>' +
  '</div>' +

'</div>' +

(invalid
  ? '<div class="card p-3.5 mt-4 border-error/30 bg-error/5 flex items-center gap-2.5">' +
      '<span class="text-error">' + AC.icon('alert') + '</span>' +
      '<span class="t-label">2 fields need attention before you can continue.</span>' +
    '</div>'
  : '') +

foot('mode', 'format', 'Continue', invalid)
  );
}

/* ------------------------------------------------------------------ step 3 */
function stepFormat() {
  return (
'<h2 class="t-section mb-1">How should the clips look?</h2>' +
'<p class="t-body text-text-secondary mb-5">These are the defaults for every clip. You can override any of them per clip later, in the Studio.</p>' +

'<div class="card p-5 mb-4">' +
  '<div class="field-label mb-3">Aspect ratio</div>' +
  '<div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5" id="ratios">' +
    AC.ASPECT_RATIOS.map(function (r) {
      const sel = r.id === draft.aspect_ratio;
      return (
'<button class="js-ratio rounded-input border p-3 flex flex-col items-center gap-2 transition-all ' +
  (sel ? 'border-accent bg-accent-muted text-accent' : 'border-border text-text-secondary hover:border-border-active') +
  '" data-val="' + r.id + '">' +
  '<span class="h-[30px] grid place-items-center">' + AC.ratioBox(r.w, r.h) + '</span>' +
  '<span class="t-label ' + (sel ? 'text-accent' : 'text-text-primary') + '">' + r.label + '</span>' +
  '<span class="t-caption text-text-tertiary leading-tight text-center">' + r.use + '</span>' +
'</button>'
      );
    }).join('') +
  '</div>' +

  /* The 16:9 decision the current build hides inside CanvasConfigControls:
     keep the landscape frame, or convert it to a 9:16 canvas. */
  '<div class="mt-4" id="canvasPanel"></div>' +
'</div>' +

'<div class="card p-5">' +
  '<label class="flex items-start gap-3 cursor-pointer">' +
    '<span class="toggle mt-0.5" role="switch" aria-checked="true"></span>' +
    '<span>' +
      '<span class="t-label block">Burn subtitles into the video</span>' +
      '<span class="t-caption text-text-secondary">Captions become part of the picture, so they survive re-uploads and platform compression.</span>' +
    '</span>' +
  '</label>' +

  '<div class="divider my-4"></div>' +

  '<div id="subLive"></div>' +

  '<button class="w-full flex items-center gap-2 py-2 mt-4 t-label text-text-secondary hover:text-text-primary transition-colors js-adv">' +
    AC.icon('palette', 'w-4 h-4') +
    '<span class="grow text-left">Caption appearance</span>' +
    '<span class="js-adv-chev">' + AC.icon('chevdown', 'w-4 h-4') + '</span>' +
  '</button>' +
  '<div class="js-adv-body hidden pt-3 border-t border-border mt-1" id="subCtl"></div>' +
'</div>' +

foot('source', 'options', 'Continue')
  );
}

/* A small live preview so the caption settings mean something before the
   Studio exists for this project. */
function subtitlePreview(c) {
  const txt = c.style === 'single_word' ? 'VIRAL'
    : c.style === 'karaoke' ? 'make your content go <hl>VIRAL</hl> now'
    : 'Make your video content go viral';

  const base = c.style === 'single_word' ? 30 : 16;
  const style =
    'font-family:\'' + c.font_family + '\',Impact,sans-serif;' +
    'font-weight:' + (c.font_weight === 'bold' ? 800 : 400) + ';' +
    'font-style:' + (c.italic ? 'italic' : 'normal') + ';' +
    'text-transform:' + (c.uppercase ? 'uppercase' : 'none') + ';' +
    'font-size:' + (base * c.font_size_scale) + 'px;' +
    'color:' + (c.style === 'single_word' ? c.highlight_color : c.text_color) + ';' +
    '-webkit-text-stroke:' + c.outline_width + 'px ' + c.outline_color + ';' +
    (c.shadow_depth ? 'text-shadow:0 ' + c.shadow_depth + 'px ' + (c.shadow_depth * 2) + 'px ' + c.shadow_color + ';' : '') +
    'transform:scale(' + (c.style === 'single_word' && c.animation_pop ? 1.1 : 1) + ');' +
    'display:inline-block;line-height:1.15;text-align:center;';

  return (
'<div class="relative rounded-input overflow-hidden border border-border min-h-[112px] grid place-items-center px-6 py-7" ' +
     'style="background:linear-gradient(150deg,#1b2030,#0b0d13)">' +
  '<span style="' + style + '">' +
    txt.replace('<hl>', '<span style="color:' + c.highlight_color + '">').replace('</hl>', '</span>') +
  '</span>' +
  (c.watermark_text
    ? '<span class="absolute inset-x-0 bottom-2 text-center text-[10px] text-white" style="opacity:' +
      c.watermark_opacity + ';text-shadow:0 1px 2px #000">' + c.watermark_text + '</span>'
    : '') +
'</div>'
  );
}

/* ------------------------------------------------------------------ step 4 */
function stepOptions() {
  const opt = function (icon, title, desc, on, extra) {
    return (
'<label class="flex items-start gap-3 py-3.5 cursor-pointer">' +
  '<span class="toggle mt-0.5" role="switch" aria-checked="' + (on ? 'true' : 'false') + '"></span>' +
  '<span class="grow">' +
    '<span class="t-label flex items-center gap-2">' +
      '<span class="text-text-tertiary">' + AC.icon(icon, 'w-3.5 h-3.5') + '</span>' + title + '</span>' +
    '<span class="t-caption text-text-secondary block mt-0.5">' + desc + '</span>' +
    (extra || '') +
  '</span>' +
'</label>'
    );
  };

  return (
'<h2 class="t-section mb-1">Anything special about this video?</h2>' +
'<p class="t-body text-text-secondary mb-5">All optional. The defaults are fine for most footage.</p>' +

'<div class="card px-5 divide-y divide-border mb-4">' +
  opt('film', 'Gaming footage', 'Detects a facecam overlay and builds a split-screen layout instead of cropping to the centre of the action.', false) +
  opt('sparkles', 'Dynamic B-roll', 'Inserts stock footage over sections with no strong visual. Needs a Pexels key.', false,
    '<span class="flex items-center gap-1.5 t-caption text-warning mt-2">' + AC.icon('alert', 'w-3.5 h-3.5') +
    'No Pexels key saved · <a href="settings.html?state=provider" class="link">Add one in Settings</a></span>') +
'</div>' +

'<div class="card p-5 mb-4">' +
  '<div class="grid sm:grid-cols-2 gap-5">' +
    '<div>' +
      '<label class="field-label" for="maxclips">How many clips</label>' +
      '<div class="select-wrap">' +
        '<select id="maxclips" class="select">' +
          '<option>Auto — decide from video length</option><option>3</option><option>5</option>' +
          '<option>10</option><option>15</option><option>20</option>' +
        '</select></div>' +
      '<p class="field-hint">Auto usually lands between 4 and 8 for a one-hour video.</p>' +
    '</div>' +
    '<div>' +
      '<label class="field-label" for="whisper">Transcription model</label>' +
      '<div class="select-wrap">' +
        '<select id="whisper" class="select">' +
          '<option>tiny — fastest, roughest</option>' +
          '<option selected>small — balanced</option>' +
          '<option>medium — slower, more accurate</option>' +
          '<option>large-v3 — slowest, best</option>' +
        '</select></div>' +
      '<p class="field-hint">Runs locally. Bigger models need more RAM and more time.</p>' +
    '</div>' +
  '</div>' +
'</div>' +

'<div class="card p-5">' +
  '<div class="flex items-center gap-2 mb-3">' +
    '<span class="text-accent">' + AC.icon('sparkles') + '</span>' +
    '<span class="t-card">AI provider for this run</span>' +
    '<span class="grow"></span>' +
    '<a href="settings.html?state=provider" class="btn-ghost btn-sm">Manage keys</a>' +
  '</div>' +
  '<div class="grid sm:grid-cols-2 gap-3">' +
    '<div><label class="field-label">Provider</label>' +
      '<div class="select-wrap"><select class="select">' +
        AC.PROVIDERS.map(function (p) {
          return '<option' + (p.id === 'openai' ? ' selected' : '') + (p.hasKey ? '' : ' disabled') + '>' +
            p.label + (p.hasKey ? '' : ' — no key saved') + '</option>';
        }).join('') +
      '</select></div></div>' +
    '<div><label class="field-label">Model</label>' +
      '<div class="select-wrap"><select class="select">' +
        '<option selected>gpt-4o-mini</option><option>gpt-4o</option><option>gpt-4.1-mini</option>' +
      '</select></div></div>' +
  '</div>' +
  '<p class="field-hint">Only used to pick the highlights and write the social copy. Transcription never leaves this machine.</p>' +
'</div>' +

foot('format', 'review', 'Continue')
  );
}

/* ------------------------------------------------------------------ step 5 */
function stepReview() {
  const line = function (label, val, href) {
    return (
'<div class="flex items-center gap-3 py-2.5">' +
  '<span class="t-caption text-text-tertiary w-[130px] shrink-0">' + label + '</span>' +
  '<span class="t-label grow truncate">' + val + '</span>' +
  (href ? '<a href="' + href + '" class="btn-ghost btn-sm">Edit</a>' : '') +
'</div>'
    );
  };

  return (
'<h2 class="t-section mb-1">Ready to run</h2>' +
'<p class="t-body text-text-secondary mb-5">You can leave this screen once it starts — the job keeps running and stays visible in the dock at the bottom.</p>' +

'<div class="card px-5 divide-y divide-border mb-4">' +
  line('Mode', 'AI Auto · OpenAI gpt-4o-mini', 'new-project.html?state=mode') +
  line('Source', 'youtube.com/watch?v=aQ9-xR2kLmE', 'new-project.html?state=source') +
  line('Project title', draft.title, 'new-project.html?state=source') +
  line('Format', '9:16 vertical · Viral Pop captions, burned in', 'new-project.html?state=format') +
  line('Clips', 'Auto — decide from video length', 'new-project.html?state=options') +
  line('Transcription', 'small (local)', 'new-project.html?state=options') +
  line('Saved to', 'D:\\AutoClipper\\Founders Talk — Ep. 42', 'settings.html?state=output') +
'</div>' +

'<div class="card p-4 mb-4 border-info/25 bg-info/5 flex gap-3">' +
  '<span class="text-info shrink-0 mt-0.5">' + AC.icon('info') + '</span>' +
  '<div class="t-caption text-text-secondary">' +
    '<span class="text-text-primary font-medium block mb-1">What happens next</span>' +
    'Download → transcribe → find moments → render. Roughly 8 minutes for a 45-minute video on this machine. ' +
    'Sleep is blocked while it runs, and you get a system notification when it finishes.' +
  '</div>' +
'</div>' +

'<div class="flex items-center gap-2 mt-7 pt-5 border-t border-border">' +
  '<a href="new-project.html?state=options" class="btn-secondary">' + AC.icon('arrowleft') + ' Back</a>' +
  '<span class="grow"></span>' +
  '<a href="project.html?id=p_9f2a&state=queued" class="btn-primary btn-lg">' + AC.icon('zap') + ' Start project</a>' +
'</div>'
  );
}

/* --------------------------------------------------------------------- init */
$(function () {
  AC.boot({ nav: 'new', states: STATES, state: raw, crumbs: [
    { label: 'Projects', href: 'projects.html' }, { label: 'New project' }] });

  const bodies = {
    mode: stepMode, source: stepSource, format: stepFormat,
    options: stepOptions, review: stepReview,
  };

  $('#page').html(
    AC.pageHead('New project', 'Five short steps. Nothing here is permanent — every choice can be changed per clip afterwards.') +
    stepper() +
    '<div class="flex gap-6 items-start">' +
      '<div class="grow min-w-0" id="stepbody"></div>' +
      summary() +
    '</div>'
  );

  $('#stepbody').html((bodies[step] || stepMode)());

  $(document).on('click', '.js-mode', function () {
    window.location.href = 'new-project.html?state=mode&mode=' + $(this).val();
  });

  $(document).on('click', '.js-probe', function () {
    const $o = $('.js-probe-out');
    $o.text('Checking…');
    setTimeout(function () {
      $o.html('<span class="text-success">Available: 1080p · 720p · 480p</span>');
    }, 700);
  });

  /* ------- format step wiring ------- */
  if (step === 'format') {
    const refreshPreview = function () { $('#subLive').html(subtitlePreview(draft.subtitle)); };

    $('#subCtl').data('compact', true).html(AC.subtitleControls(draft.subtitle, { compact: true }));
    AC.bindSubtitleControls('#subCtl', draft.subtitle, refreshPreview);
    refreshPreview();

    const renderCanvasPanel = function () {
      if (draft.aspect_ratio === '16:9') {
        AC.mountCanvasControls('#canvasPanel', draft.canvas, null);
      } else {
        draft.canvas.enabled = false;
        $('#canvasPanel').html(
          '<div class="panel p-3.5 flex gap-2.5">' +
            '<span class="text-text-tertiary shrink-0 mt-0.5">' + AC.icon('info', 'w-4 h-4') + '</span>' +
            '<p class="t-caption text-text-secondary">Landscape sources are cropped to ' + draft.aspect_ratio +
            ' with face tracking. Choose <span class="text-text-primary">16:9</span> to keep the full frame instead — ' +
            'either as-is, or centred on a vertical canvas with a background.</p>' +
          '</div>'
        );
      }
    };
    renderCanvasPanel();

    $(document).on('click', '.js-ratio', function () {
      draft.aspect_ratio = $(this).data('val');
      $('.js-ratio').removeClass('border-accent bg-accent-muted text-accent')
        .addClass('border-border text-text-secondary');
      $(this).addClass('border-accent bg-accent-muted text-accent')
        .removeClass('border-border text-text-secondary');
      renderCanvasPanel();
      syncSummary();
    });

    /* Keep the summary rail honest as choices change. */
    const syncSummary = function () {
      $('[data-sum="Aspect ratio"]').text(
        draft.aspect_ratio + (draft.aspect_ratio === '16:9' && draft.canvas.enabled ? ' → 9:16 canvas' : ''));
    };
    $(document).on('click', '.js-canvas-mode', function () { setTimeout(syncSummary, 0); });

    $(document).on('click', '.js-adv', function () {
      $('.js-adv-body').toggleClass('hidden');
      $('.js-adv-chev').toggleClass('rotate-180');
    });
  }
});
