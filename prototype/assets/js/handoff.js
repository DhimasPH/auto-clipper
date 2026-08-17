/* =============================================================================
   BYO-LLM HANDOFF
   -----------------------------------------------------------------------------
   Current build: ManualResumeModal — a modal with no close button, a prompt
   block, and a raw JSON textarea validated by JSON.parse() alone. Structural
   mistakes only surface after submit, from the backend.

   Here the round-trip is admitted openly and given three steps, and the parsed
   result is shown as highlights on a timeline before anything is committed.
============================================================================= */

const STATES = [
  { id: 'step1',   label: '1 · Copy the prompt' },
  { id: 'step2',   label: '2 · Paste the result' },
  { id: 'step3',   label: '3 · Review highlights' },
  { id: 'invalid', label: '2 · Paste failed to parse' },
];

const raw = AC.qs('state', 'step1');
const invalid = raw === 'invalid';
const step = invalid ? 'step2' : raw;
const p = AC.getProject(AC.qs('id') || 'p_5be8');

const N = { step1: 1, step2: 2, step3: 3 }[step];
const TOTAL_SRC = 1284; // seconds of source, for the mini timeline

function rail() {
  const items = [
    ['Copy the prompt', 'Auto Clipper wrote it from your transcript'],
    ['Run it in your model', 'ChatGPT, Gemini, Claude — whatever you already pay for'],
    ['Paste the answer back', 'Rendering continues from there'],
  ];
  return (
'<ol class="flex gap-2 mb-7">' +
  items.map(function (it, i) {
    const n = i + 1, done = n < N, now = n === N;
    return (
'<li class="grow card p-3.5 ' + (now ? 'border-accent bg-accent-muted' : '') + '">' +
  '<div class="flex items-center gap-2 mb-1">' +
    '<span class="w-5 h-5 rounded-full grid place-items-center t-caption font-semibold shrink-0 ' +
      (done ? 'bg-accent text-white' : now ? 'border-2 border-accent text-accent' : 'border border-border text-text-tertiary') + '">' +
      (done ? AC.icon('check', 'w-3 h-3') : n) + '</span>' +
    '<span class="t-label ' + (now ? 'text-accent' : done ? '' : 'text-text-tertiary') + '">' + it[0] + '</span>' +
  '</div>' +
  '<p class="t-caption text-text-tertiary">' + it[1] + '</p>' +
'</li>'
    );
  }).join('') +
'</ol>'
  );
}

function step1() {
  return (
'<div class="card p-5 mb-4">' +
  '<div class="flex items-center gap-2 mb-3">' +
    '<span class="text-accent">' + AC.icon('copy') + '</span>' +
    '<span class="t-card grow">Your prompt is ready</span>' +
    '<span class="badge-neutral">' + TOTAL_SRC + ' segments</span>' +
    '<button class="btn-primary btn-sm js-copy">' + AC.icon('copy', 'w-3.5 h-3.5') + ' Copy prompt</button>' +
  '</div>' +
  '<pre class="panel p-3.5 max-h-[300px] overflow-auto font-mono text-[11.5px] leading-relaxed ' +
       'text-text-secondary whitespace-pre-wrap select-all">' + AC.MANUAL_PROMPT + '</pre>' +
'</div>' +

'<div class="card p-5 mb-4">' +
  '<div class="t-label mb-3">Open it in</div>' +
  '<div class="grid sm:grid-cols-3 gap-2">' +
    ['ChatGPT', 'Google Gemini', 'Claude'].map(function (m) {
      return '<button class="btn-secondary js-todo justify-between">' + m +
        '<span class="text-text-tertiary">' + AC.icon('external', 'w-3.5 h-3.5') + '</span></button>';
    }).join('') +
  '</div>' +
  '<p class="field-hint">Opens in your browser with the prompt already on your clipboard.</p>' +
'</div>' +

'<div class="flex items-center gap-2 pt-5 border-t border-border">' +
  '<a href="project.html?id=' + p.id + '&state=awaiting" class="btn-ghost">Back to project</a>' +
  '<span class="grow"></span>' +
  '<a href="handoff.html?id=' + p.id + '&state=step2" class="btn-primary">I have the answer ' + AC.icon('arrowright') + '</a>' +
'</div>'
  );
}

function step2() {
  return (
'<div class="card p-5 mb-4">' +
  '<div class="flex items-center gap-2 mb-3">' +
    '<span class="t-card grow">Paste what the model gave you</span>' +
    '<button class="btn-ghost btn-sm js-sample">Use a sample</button>' +
  '</div>' +
  '<textarea id="json" class="textarea font-mono text-[12px] h-[260px]' + (invalid ? ' input-invalid' : '') + '" ' +
    'placeholder=\'[{"start": 31.8, "end": 68.2, "title": "…"}]\'>' +
    (invalid ? '[\n  {"start": "00:31", "end": "01:08", "title": "You don\'t start with a button"},\n  {"start": 152.4, "title": "Tokens are decisions written down"}\n]' : '') +
  '</textarea>' +

  (invalid
    ? '<div class="mt-3 space-y-2">' +
        '<div class="panel p-3 border-error/30 bg-error/5">' +
          '<div class="flex gap-2.5">' +
            '<span class="text-error shrink-0 mt-0.5">' + AC.icon('alert', 'w-4 h-4') + '</span>' +
            '<div><div class="t-label mb-1.5">2 problems, both fixable</div>' +
              '<ul class="t-caption text-text-secondary space-y-1.5">' +
                '<li><span class="font-mono text-error">line 2</span> — <span class="text-text-primary">start</span> and ' +
                  '<span class="text-text-primary">end</span> must be seconds as numbers, not "00:31". ' +
                  '<button class="link js-fix">Convert them for me</button></li>' +
                '<li><span class="font-mono text-error">line 3</span> — missing <span class="text-text-primary">end</span>. ' +
                  'Every highlight needs a start and an end.</li>' +
              '</ul>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    : '<div class="flex items-center gap-2 mt-3 t-caption text-text-tertiary">' +
        AC.icon('info', 'w-3.5 h-3.5') +
        'Extra prose around the JSON is fine — it gets stripped. Code fences too.</div>') +
'</div>' +

'<div class="flex items-center gap-2 pt-5 border-t border-border">' +
  '<a href="handoff.html?id=' + p.id + '&state=step1" class="btn-secondary">' + AC.icon('arrowleft') + ' Back</a>' +
  '<span class="grow"></span>' +
  (invalid
    ? '<button class="btn-primary" disabled>Preview highlights</button>'
    : '<a href="handoff.html?id=' + p.id + '&state=step3" class="btn-primary js-parse">Preview highlights ' + AC.icon('arrowright') + '</a>') +
'</div>'
  );
}

function step3() {
  const bar = function (h, i) {
    return (
'<div class="absolute h-full rounded" style="left:' + (h.start / TOTAL_SRC * 100) + '%;width:' +
  Math.max(0.8, (h.end - h.start) / TOTAL_SRC * 100) + '%;background:hsl(' + (232 + i * 26) + ' 60% 55%)"></div>'
    );
  };

  return (
'<div class="card p-4 mb-4 border-success/25 bg-success/5 flex items-center gap-3">' +
  '<span class="text-success">' + AC.icon('check', 'w-5 h-5') + '</span>' +
  '<div class="grow"><span class="t-label">5 highlights parsed cleanly</span>' +
  '<span class="t-caption text-text-secondary block">Total 3m 26s of clips from a 21m 24s source</span></div>' +
'</div>' +

'<div class="card p-5 mb-4">' +
  '<div class="t-label mb-2.5">Where they sit in the source</div>' +
  '<div class="relative h-8 rounded-input bg-bg-primary border border-border overflow-hidden mb-1.5">' +
    AC.PARSED_HIGHLIGHTS.map(bar).join('') +
  '</div>' +
  '<div class="flex justify-between t-caption font-mono text-text-tertiary">' +
    '<span>00:00</span><span>10:42</span><span>21:24</span></div>' +
'</div>' +

'<div class="card divide-y divide-border mb-4">' +
  AC.PARSED_HIGHLIGHTS.map(function (h, i) {
    return (
'<div class="p-4 flex items-start gap-3">' +
  '<span class="w-6 h-6 rounded-full grid place-items-center t-caption font-semibold shrink-0 ' +
    'bg-bg-surface text-text-secondary mt-0.5">' + (i + 1) + '</span>' +
  '<div class="grow min-w-0">' +
    '<div class="t-label mb-0.5">' + h.title + '</div>' +
    '<p class="t-caption text-text-secondary mb-1.5">' + h.reason + '</p>' +
    '<div class="flex items-center gap-2 t-caption font-mono text-text-tertiary">' +
      Math.floor(h.start / 60) + ':' + String(Math.floor(h.start % 60)).padStart(2, '0') + ' → ' +
      Math.floor(h.end / 60) + ':' + String(Math.floor(h.end % 60)).padStart(2, '0') +
      '<span class="badge-neutral !h-[18px] !text-[10px]">' + h.dur + 's</span></div>' +
  '</div>' +
  '<button class="btn-ghost btn-icon btn-sm js-todo" title="Drop this one">' + AC.icon('x', 'w-3.5 h-3.5') + '</button>' +
'</div>'
    );
  }).join('') +
'</div>' +

'<div class="flex items-center gap-2 pt-5 border-t border-border">' +
  '<a href="handoff.html?id=' + p.id + '&state=step2" class="btn-secondary">' + AC.icon('arrowleft') + ' Back</a>' +
  '<span class="grow"></span>' +
  '<span class="t-caption text-text-tertiary mr-2">Renders 5 clips · about 4 minutes</span>' +
  '<a href="project.html?id=' + p.id + '&state=rendering" class="btn-primary btn-lg">' +
    AC.icon('zap') + ' Render these 5 clips</a>' +
'</div>'
  );
}

$(function () {
  AC.boot({ nav: 'projects', states: STATES, state: raw, crumbs: [
    { label: 'Projects', href: 'projects.html' },
    { label: p.title, href: 'project.html?id=' + p.id + '&state=awaiting' },
    { label: 'LLM handoff' }] });

  $('#page').html(
'<a href="project.html?id=' + p.id + '&state=awaiting" class="btn-ghost btn-sm -ml-3 mb-3">' +
  AC.icon('arrowleft', 'w-3.5 h-3.5') + ' ' + p.title + '</a>' +
    AC.pageHead('Bring your own LLM',
      'Auto Clipper does the transcript and the render. You supply the judgement — using a model you already pay for.') +
    rail() +
    '<div id="body"></div>'
  );

  $('#body').html(step === 'step3' ? step3() : step === 'step2' ? step2() : step1());

  $(document).on('click', '.js-copy', function () {
    const $b = $(this);
    $b.html(AC.icon('check', 'w-3.5 h-3.5') + ' Copied');
    AC.toast('Prompt copied to clipboard', 'success');
    setTimeout(function () { $b.html(AC.icon('copy', 'w-3.5 h-3.5') + ' Copy prompt'); }, 2000);
  });

  $(document).on('click', '.js-sample', function () {
    $('#json').val(AC.MANUAL_RESULT_SAMPLE);
    AC.toast('Sample response pasted');
  });

  $(document).on('click', '.js-fix', function () {
    window.location.href = 'handoff.html?id=' + p.id + '&state=step2';
  });
});
