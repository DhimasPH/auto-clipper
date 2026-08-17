/* =============================================================================
   SETTINGS
   -----------------------------------------------------------------------------
   Same five sections as the current build (Provider, Transcription, Output,
   Appearance, Updates), but each states what it costs you and links back to the
   place it affects.

   Faithful to the real components:
     · Custom (OpenAI compatible) has THREE fields — Base URL, Model Name and an
       API Key that may be left empty for Ollama / local endpoints.
       (ProviderSection.tsx CustomConfigModal)
     · Model list only appears after "Test AI Connection" succeeds.
     · Whisper models are cards with a download state, not a dropdown, and VAD
       is always on with no toggle. (TranscriptionSection.tsx)
============================================================================= */

const SECTIONS = [
  { id: 'provider',      label: 'AI provider',   icon: 'sparkles' },
  { id: 'transcription', label: 'Transcription', icon: 'mic' },
  { id: 'output',        label: 'Output',        icon: 'folder' },
  { id: 'appearance',    label: 'Appearance',    icon: 'palette' },
  { id: 'updates',       label: 'Updates',       icon: 'refresh' },
];
const STATES = SECTIONS.map(function (s) { return { id: s.id, label: s.label }; });
const state = AC.qs('state', 'provider');

function row(title, desc, control) {
  return (
'<div class="flex items-start gap-6 py-4">' +
  '<div class="grow min-w-0">' +
    '<div class="t-label mb-0.5">' + title + '</div>' +
    '<p class="t-caption text-text-secondary">' + desc + '</p>' +
  '</div>' +
  '<div class="shrink-0 w-[260px]">' + control + '</div>' +
'</div>'
  );
}

function toggleRight(on) {
  return '<div class="flex justify-end"><span class="toggle" role="switch" aria-checked="' + (on ? 'true' : 'false') + '"></span></div>';
}

/* ---------------------------------------------------------------- provider */
function secProvider() {
  return (
'<div class="card p-5 mb-4">' +
  '<div class="flex items-start gap-3 mb-4">' +
    '<span class="text-accent shrink-0 mt-0.5">' + AC.icon('key', 'w-5 h-5') + '</span>' +
    '<div><div class="t-card mb-1">Bring your own key</div>' +
    '<p class="t-body text-text-secondary">Keys are stored on this machine only, and are used purely to pick highlights ' +
    'and write social copy. Transcription runs locally and never touches an API.</p></div>' +
  '</div>' +

  '<div class="divider mb-1"></div>' +

  '<div class="divide-y divide-border">' +
    AC.PROVIDERS.filter(function (p) { return p.id !== 'custom'; }).map(function (p) {
      return (
'<div class="flex items-center gap-3 py-3">' +
  '<span class="w-2 h-2 rounded-full shrink-0 ' + (p.hasKey ? 'bg-success' : 'bg-text-tertiary') + '"></span>' +
  '<div class="w-[150px] shrink-0"><div class="t-label">' + p.label + '</div>' +
    '<div class="t-caption text-text-tertiary font-mono">' + (p.defaultModel || '—') + '</div></div>' +
  '<div class="grow"><input class="input h-9 font-mono text-[12px]" type="password" ' +
      'placeholder="' + (p.hasKey ? '' : 'Paste an API key…') + '" ' +
      'value="' + (p.hasKey ? 'sk-proj-0000000000000000' : '') + '"/></div>' +
  (p.hasKey
    ? '<span class="badge-success shrink-0">' + AC.icon('check', 'w-3 h-3') + 'Verified</span>'
    : '<button class="btn-secondary btn-sm shrink-0 js-test-ai">Test</button>') +
'</div>'
      );
    }).join('') +
  '</div>' +

  '<div class="divider my-4"></div>' +

  /* Custom endpoint — THREE fields. The API key was missing before. */
  '<div class="panel p-4">' +
    '<div class="flex items-center gap-2 mb-1">' +
      '<span class="text-text-tertiary">' + AC.icon('cpu', 'w-4 h-4') + '</span>' +
      '<span class="t-label grow">Custom endpoint (OpenAI compatible)</span>' +
      '<span class="badge-neutral">Ollama · LM Studio · self-hosted</span>' +
    '</div>' +
    '<p class="t-caption text-text-secondary mb-3">Point Auto Clipper at any OpenAI-compatible gateway.</p>' +
    '<div class="grid sm:grid-cols-2 gap-3 mb-3">' +
      '<div><label class="t-caption text-text-tertiary">Base URL</label>' +
        '<input class="input h-9 mt-1 font-mono text-[12px]" placeholder="http://localhost:11434/v1"/></div>' +
      '<div><label class="t-caption text-text-tertiary">Model name</label>' +
        '<input class="input h-9 mt-1 font-mono text-[12px]" placeholder="llama3.1:8b"/></div>' +
    '</div>' +
    '<div>' +
      '<label class="t-caption text-text-tertiary">API key</label>' +
      '<div class="relative mt-1">' +
        '<input class="input h-9 font-mono text-[12px] pr-10" type="password" id="customKey" ' +
          'placeholder="Leave empty for Ollama or a local endpoint"/>' +
        '<button class="absolute right-2 top-1/2 -mt-3.5 btn-ghost btn-icon btn-sm js-reveal" data-for="customKey" ' +
          'title="Show key">' + AC.icon('eye', 'w-3.5 h-3.5') + '</button>' +
      '</div>' +
      '<p class="field-hint">Optional. Required only if your gateway enforces authentication.</p>' +
    '</div>' +
    '<button class="btn-secondary btn-sm mt-3 js-test-ai">' + AC.icon('zap', 'w-3.5 h-3.5') + ' Test AI connection</button>' +
  '</div>' +
'</div>' +

'<div class="card p-5 mb-4" id="modelCard">' +
  '<div class="flex items-center gap-2 mb-1">' +
    '<span class="t-card grow">Model</span>' +
    '<button class="btn-ghost btn-sm js-refresh-models">' + AC.icon('refresh', 'w-3.5 h-3.5') + ' Refresh models</button>' +
  '</div>' +
  '<p class="t-caption text-text-secondary mb-3">Fetched from the provider after a successful connection test.</p>' +
  '<div class="select-wrap max-w-[320px]"><select class="select">' +
    '<option selected>gpt-4o-mini</option><option>gpt-4o</option>' +
    '<option>gpt-4.1-mini</option><option>gpt-4.1-nano</option>' +
  '</select></div>' +
'</div>' +

'<div class="card p-5">' +
  '<div class="t-card mb-1">Pexels (for B-roll)</div>' +
  '<p class="t-body text-text-secondary mb-3">Only needed if you switch on Dynamic B-roll in a project. The free tier is enough.</p>' +
  '<div class="flex gap-2">' +
    '<input class="input font-mono text-[12px]" type="password" placeholder="Paste a Pexels API key…"/>' +
    '<button class="btn-secondary shrink-0 js-test-ai">Test</button>' +
    '<button class="btn-ghost shrink-0 js-todo">Get a free key</button>' +
  '</div>' +
'</div>'
  );
}

/* ----------------------------------------------------------- transcription */
function secTranscription() {
  return (
'<div class="card p-5 mb-4">' +
  '<div class="flex items-start gap-3">' +
    '<span class="text-accent shrink-0 mt-0.5">' + AC.icon('mic', 'w-5 h-5') + '</span>' +
    '<div><div class="t-card mb-1">Speech-to-text runs locally</div>' +
    '<p class="t-body text-text-secondary">faster-whisper transcribes on your own machine — no audio is ever uploaded. ' +
    'Bigger models catch names, accents and technical terms better, but need more RAM and more time.</p></div>' +
  '</div>' +
'</div>' +

'<div class="space-y-2.5 mb-4">' +
  AC.WHISPER_MODELS.map(function (m) {
    const active = m.id === AC.WHISPER_ACTIVE;
    return (
'<div class="card p-4 flex items-center gap-4 ' + (active ? 'border-accent/50' : '') + '">' +
  '<div class="grow min-w-0">' +
    '<div class="flex items-center gap-2 mb-1">' +
      '<span class="t-card">' + m.name + '</span>' +
      (active ? '<span class="badge-accent">' + AC.icon('check', 'w-3 h-3') + 'Active</span>'
        : m.downloaded ? '<span class="badge-success">Ready</span>'
        : '<span class="badge-warning">Not downloaded</span>') +
    '</div>' +
    '<p class="t-caption text-text-secondary mb-1.5">' + m.desc + '</p>' +
    '<div class="flex items-center gap-3 t-caption text-text-tertiary">' +
      '<span class="inline-flex items-center gap-1.5">' + AC.icon('layers', 'w-3.5 h-3.5') + m.disk_size + '</span>' +
      '<span class="inline-flex items-center gap-1.5">' + AC.icon('cpu', 'w-3.5 h-3.5') + m.vram + '</span>' +
    '</div>' +
  '</div>' +
  '<div class="shrink-0">' +
    (!m.downloaded
      ? '<button class="btn-secondary btn-sm js-toast" data-msg="Downloading ' + m.name + ' — this runs in the background">' +
        AC.icon('download', 'w-3.5 h-3.5') + ' Download</button>'
      : active
        ? '<button class="btn-primary btn-sm" disabled>Selected</button>'
        : '<button class="btn-secondary btn-sm js-toast" data-msg="' + m.name + ' is now the active model">Select</button>') +
  '</div>' +
'</div>'
    );
  }).join('') +
'</div>' +

'<div class="card p-4 flex gap-3">' +
  '<span class="text-accent shrink-0 mt-0.5">' + AC.icon('info', 'w-4 h-4') + '</span>' +
  '<p class="t-caption text-text-secondary">' +
    '<span class="text-text-primary">VAD is always on.</span> Voice activity detection trims silent gaps before ' +
    'transcription, which is what stops Whisper repeating itself on long pauses. There is nothing to configure.</p>' +
'</div>'
  );
}

/* ------------------------------------------------------------------ output */
function secOutput() {
  return (
'<div class="card px-5 divide-y divide-border">' +
  row('Where clips are saved',
    'Each project gets its own folder here, so the source video, transcript and clips never mix between projects.',
    '<div class="flex gap-2">' +
      '<input class="input h-9 font-mono text-[12px]" value="D:\\AutoClipper" readonly/>' +
      '<button class="btn-secondary btn-sm shrink-0 js-todo">Browse</button></div>') +
  row('Default download quality',
    'Can be overridden per project. Higher means slower downloads and slower renders.',
    '<div class="select-wrap"><select class="select">' +
      '<option>Best (automatic)</option><option>2160p (4K)</option><option>1440p (2K)</option>' +
      '<option selected>1080p</option><option>720p</option><option>480p</option></select></div>') +
  row('Notify me when a job finishes',
    'A native system notification, so you can leave the app in the background.',
    toggleRight(true)) +
  row('Prevent sleep while rendering',
    'Stops the machine suspending mid-render. Turn off if you want it to sleep regardless.',
    toggleRight(true)) +
'</div>'
  );
}

/* -------------------------------------------------------------- appearance */
function secAppearance() {
  const t = AC.getTheme();
  return (
'<div class="card px-5 divide-y divide-border">' +
  row('Theme', 'Applies everywhere, including the welcome screen.',
    '<div class="segmented w-full" id="themeSeg">' +
      '<span class="segmented-item grow js-set-theme" data-t="dark" aria-selected="' + (t === 'dark') + '">' +
        AC.icon('moon', 'w-3.5 h-3.5') + ' Dark</span>' +
      '<span class="segmented-item grow js-set-theme" data-t="light" aria-selected="' + (t === 'light') + '">' +
        AC.icon('sun', 'w-3.5 h-3.5') + ' Light</span>' +
    '</div>') +
  row('Interface language', 'English and Indonesian. Does not affect subtitles.',
    '<div class="select-wrap"><select class="select">' +
      '<option selected>English</option><option>Bahasa Indonesia</option></select></div>') +
  row('Show the welcome screen at launch',
    'The brand and community links. Turn off to go straight to Projects.',
    toggleRight(true)) +
'</div>'
  );
}

/* ----------------------------------------------------------------- updates */
function secUpdates() {
  return (
'<div class="card p-5 mb-4">' +
  '<div class="flex items-center gap-4">' +
    '<div class="w-11 h-11 rounded-xl bg-accent-muted text-accent grid place-items-center shrink-0">' +
      AC.icon('refresh', 'w-5 h-5') + '</div>' +
    '<div class="grow"><div class="t-card">You are on v1.8.0</div>' +
      '<p class="t-caption text-text-secondary">Checked 12 minutes ago · updates are cryptographically verified before install.</p></div>' +
    '<button class="btn-secondary js-toast" data-msg="Checking for updates…">Check now</button>' +
  '</div>' +
'</div>' +
'<div class="card px-5 divide-y divide-border">' +
  row('Check automatically at launch', 'A background check only — nothing downloads until you say so.',
    toggleRight(true)) +
'</div>'
  );
}

/* --------------------------------------------------------------------- init */
$(function () {
  AC.boot({ nav: 'settings', states: STATES, state: state, crumbs: [
    { label: 'Settings', href: 'settings.html' },
    { label: (SECTIONS.filter(function (x) { return x.id === state; })[0] || SECTIONS[0]).label }] });

  const bodies = {
    provider: secProvider, transcription: secTranscription,
    output: secOutput, appearance: secAppearance, updates: secUpdates,
  };

  $('#page').html(
    AC.pageHead('Settings', 'Everything here is stored on this machine.') +
    '<div class="flex gap-6 items-start">' +
      '<nav class="w-[190px] shrink-0 hidden md:block sticky top-8">' +
        SECTIONS.map(function (s) {
          return '<a href="settings.html?state=' + s.id + '" class="nav-item !mx-0"' +
            (s.id === state ? ' aria-current="page"' : '') + '>' +
            AC.icon(s.icon, 'w-[18px] h-[18px] shrink-0') + '<span>' + s.label + '</span></a>';
        }).join('') +
      '</nav>' +
      '<div class="grow min-w-0" id="body"></div>' +
    '</div>'
  );

  $('#body').html((bodies[state] || secProvider)());

  $(document).on('click', '.js-set-theme', function () { AC.setTheme($(this).data('t')); });

  $(document).on('click', '.js-reveal', function () {
    const $i = $('#' + $(this).data('for'));
    const shown = $i.attr('type') === 'text';
    $i.attr('type', shown ? 'password' : 'text');
    $(this).html(AC.icon(shown ? 'eye' : 'x', 'w-3.5 h-3.5'));
  });

  $(document).on('click', '.js-test-ai', function () {
    const $b = $(this), old = $b.html();
    $b.prop('disabled', true).text('Testing…');
    setTimeout(function () {
      $b.prop('disabled', false).html(AC.icon('check', 'w-3.5 h-3.5') + ' Valid');
      AC.toast('Connection OK — model list refreshed', 'success');
      setTimeout(function () { $b.html(old); }, 2200);
    }, 900);
  });

  $(document).on('click', '.js-refresh-models', function () {
    AC.toast('Fetched 4 models from OpenAI', 'success');
  });
});
