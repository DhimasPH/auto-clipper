/* =============================================================================
   PROJECT DETAIL
   -----------------------------------------------------------------------------
   The screen the current build does not have. Today a running job shows only a
   disabled button labelled "Memproses...", the progress string the backend
   sends is never rendered, and a failure leaves no reachable way back.
============================================================================= */

const STATES = [
  { id: 'rendering', label: 'Running · rendering' },
  { id: 'queued',    label: 'Running · queued' },
  { id: 'done',      label: 'Completed' },
  { id: 'error',     label: 'Failed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'awaiting',  label: 'Awaiting your LLM' },
  { id: 'download',  label: 'Download only · done' },
];

const state = AC.qs('state', 'rendering');

/* Which fixture backs each state */
const PROJ_FOR_STATE = {
  rendering: 'p_7c31', queued: 'p_7c31', done: 'p_9f2a', error: 'p_2d40',
  cancelled: 'p_8e55', awaiting: 'p_5be8', download: 'p_1a07',
};
const p = AC.getProject(AC.qs('id') || PROJ_FOR_STATE[state]);

/* Where each state sits on the phase rail */
const PHASE_POS = {
  queued:    { at: -1, status: 'QUEUED' },
  rendering: { at: 3,  status: 'RENDERING' },
  done:      { at: 4,  status: 'DONE' },
  download:  { at: 4,  status: 'DONE' },
  error:     { at: 2,  status: 'ERROR' },
  cancelled: { at: 1,  status: 'CANCELLED' },
  awaiting:  { at: 2,  status: 'AWAITING_MANUAL' },
};
const pos = PHASE_POS[state];

/* -------------------------------------------------------------- phase rail */
function phaseRail() {
  const phases = state === 'download'
    ? [AC.PHASES[0], AC.PHASES[1]]
    : AC.PHASES;

  return phases.map(function (ph, i) {
    let mark, ring, tone, detail = ph.desc;

    if (state === 'awaiting' && i === 2) {
      mark = AC.icon('hand', 'w-3 h-3'); ring = 'border-warning text-warning'; tone = 'text-warning';
      detail = 'Waiting for you to run the prompt in your own model';
    } else if (state === 'error' && i === pos.at) {
      mark = AC.icon('x', 'w-3 h-3'); ring = 'border-error text-error'; tone = 'text-error';
      detail = p.error;
    } else if (state === 'cancelled' && i === pos.at) {
      mark = AC.icon('ban', 'w-3 h-3'); ring = 'border-text-tertiary text-text-tertiary'; tone = 'text-text-tertiary';
      detail = 'Stopped here';
    } else if (i < pos.at) {
      mark = AC.icon('check', 'w-3 h-3'); ring = 'border-success text-success'; tone = 'text-text-primary';
      detail = ['1m 52s · 1.82 GB', '2m 34s · 1,284 segments', '38s · 6 highlights found', ''][i] || ph.desc;
    } else if (i === pos.at && ['rendering'].indexOf(state) >= 0) {
      mark = '<span class="w-2 h-2 rounded-full bg-accent animate-pulse-soft"></span>';
      ring = 'border-accent text-accent'; tone = 'text-accent';
      detail = p.phase_detail;
    } else {
      mark = ''; ring = 'border-border text-text-tertiary'; tone = 'text-text-tertiary';
    }

    return (
'<div class="phase">' +
  '<span class="phase-dot ' + ring + '">' + mark + '</span>' +
  '<div class="min-w-0 grow -mt-0.5">' +
    '<div class="flex items-center gap-2">' +
      '<span class="t-label ' + tone + '">' + ph.label + '</span>' +
      (i === pos.at && state === 'rendering'
        ? '<span class="t-caption text-text-tertiary">' + p.elapsed + ' elapsed · ' + p.eta + '</span>' : '') +
    '</div>' +
    '<p class="t-caption text-text-secondary mt-0.5">' + detail + '</p>' +
    (i === pos.at && state === 'rendering'
      ? '<div class="track mt-2 max-w-[420px]"><div class="track-fill" style="width:72%"></div></div>' : '') +
  '</div>' +
'</div>'
    );
  }).join('');
}

/* ------------------------------------------------------------------- clips */
function clipCard(c) {
  return (
'<article class="card overflow-hidden card-hover group">' +
  '<a href="studio.html?id=' + p.id + '&clip=' + c.index + '" class="block relative aspect-[9/16]">' +
    '<span class="absolute inset-0" style="background:linear-gradient(150deg,hsl(' + c.hue + ' 55% 26%),hsl(' +
      ((c.hue + 42) % 360) + ' 48% 13%))"></span>' +
    '<span class="absolute inset-0 grid place-items-center text-white/25">' + AC.icon('play', 'w-9 h-9') + '</span>' +
    '<span class="absolute inset-x-0 bottom-0 h-2/5" style="background:linear-gradient(transparent,rgba(0,0,0,.75))"></span>' +
    '<span class="absolute left-2.5 bottom-2.5 right-2.5">' +
      '<span class="block text-[13px] font-bold text-white uppercase leading-tight" ' +
        'style="text-shadow:0 1px 3px #000">' + c.title + '</span>' +
    '</span>' +
    '<span class="absolute top-2.5 left-2.5 badge-neutral !bg-black/55 !border-white/15 !text-white">' +
      AC.icon('sparkles', 'w-3 h-3') + c.score + '</span>' +
    '<span class="absolute top-2.5 right-2.5 t-caption font-mono text-white/90 bg-black/55 rounded px-1.5 py-0.5">' +
      c.duration + 's</span>' +
    '<span class="absolute inset-0 bg-accent/0 group-hover:bg-accent/10 transition-colors"></span>' +
  '</a>' +

  '<div class="p-3">' +
    '<div class="flex items-center gap-1.5 t-caption text-text-tertiary mb-2 font-mono">' +
      c.start + ' → ' + c.end +
      (c.versions > 1 ? '<span class="badge-neutral ml-auto !h-[18px] !text-[10px]">v' + c.versions + '</span>' : '') +
    '</div>' +
    '<p class="t-caption text-text-secondary line-clamp-2 mb-3 h-[32px] overflow-hidden">' + c.description + '</p>' +
    '<div class="flex items-center gap-1">' +
      '<a href="studio.html?id=' + p.id + '&clip=' + c.index + '" class="btn-secondary btn-sm grow">' +
        AC.icon('pencil', 'w-3.5 h-3.5') + ' Edit</a>' +
      '<button class="btn-ghost btn-icon btn-sm js-social" data-i="' + c.index + '" title="Social kit">' +
        AC.icon('sparkles', 'w-3.5 h-3.5') + '</button>' +
      '<button class="btn-ghost btn-icon btn-sm js-toast" data-msg="Save clip as…" title="Download">' +
        AC.icon('download', 'w-3.5 h-3.5') + '</button>' +
      '<button class="btn-ghost btn-icon btn-sm js-toast" data-msg="Opens the project folder" title="Show in folder">' +
        AC.icon('folderopen', 'w-3.5 h-3.5') + '</button>' +
    '</div>' +
  '</div>' +
'</article>'
  );
}

/* --------------------------------------------------------------------- log */
function logPanel() {
  return (
'<div class="card overflow-hidden">' +
  '<button class="w-full px-4 h-11 flex items-center gap-2 hover:bg-bg-surface/50 transition-colors js-log-toggle">' +
    AC.icon('terminal', 'w-4 h-4 text-text-tertiary') +
    '<span class="t-label">Activity log</span>' +
    '<span class="t-caption text-text-tertiary">' + AC.LOG_LINES.length + ' entries</span>' +
    '<span class="grow"></span>' +
    '<span class="js-log-chev">' + AC.icon('chevdown', 'w-4 h-4 text-text-tertiary') + '</span>' +
  '</button>' +
  '<div class="js-log-body hidden border-t border-border max-h-[260px] overflow-y-auto bg-bg-primary">' +
    AC.LOG_LINES.map(function (l) {
      const c = l.lvl === 'ok' ? 'text-success' : l.lvl === 'warn' ? 'text-warning' : 'text-text-tertiary';
      return '<div class="flex gap-3 px-4 py-1.5 font-mono text-[11.5px] leading-relaxed hover:bg-bg-surface/40">' +
        '<span class="text-text-tertiary shrink-0">' + l.t + '</span>' +
        '<span class="' + c + ' shrink-0 w-8">' + l.lvl + '</span>' +
        '<span class="text-text-secondary">' + l.msg + '</span></div>';
    }).join('') +
  '</div>' +
'</div>'
  );
}

/* ------------------------------------------------------------ detail panel */
function detailPanel() {
  const rows = [
    ['Source', p.source_label],
    ['Link', p.url.length > 34 ? p.url.slice(0, 34) + '…' : p.url],
    ['Started', p.created_label],
    ['Aspect ratio', p.aspect_ratio],
    ['Subtitles', p.burn_subs ? 'Burned in · Viral Pop' : 'Off'],
    ['Quality', p.quality],
  ];
  if (p.provider) rows.push(['AI provider', p.provider + ' · ' + p.model]);

  return (
'<div class="card p-4">' +
  '<div class="t-overline text-text-tertiary mb-3">Settings used</div>' +
  '<dl class="space-y-2.5">' +
    rows.map(function (r) {
      return '<div class="flex items-baseline gap-3">' +
        '<dt class="t-caption text-text-tertiary w-[86px] shrink-0">' + r[0] + '</dt>' +
        '<dd class="t-caption text-right grow truncate">' + r[1] + '</dd></div>';
    }).join('') +
  '</dl>' +
  '<div class="divider my-3.5"></div>' +
  '<button class="btn-secondary btn-sm w-full js-toast" data-msg="Opens the project workspace folder">' +
    AC.icon('folderopen', 'w-3.5 h-3.5') + ' Open project folder</button>' +
'</div>'
  );
}

/* --------------------------------------------------------- state-specific  */
function banner() {
  if (state === 'error') {
    return (
'<div class="card p-5 border-error/30 bg-error/5 mb-5">' +
  '<div class="flex gap-3.5">' +
    '<span class="text-error shrink-0 mt-0.5">' + AC.icon('alert', 'w-5 h-5') + '</span>' +
    '<div class="min-w-0 grow">' +
      '<div class="t-card mb-1">Stopped while finding moments</div>' +
      '<p class="t-body text-text-secondary mb-3">' + p.error + '</p>' +
      '<div class="panel p-3.5 mb-4">' +
        '<div class="t-overline text-text-tertiary mb-1.5">What this means for your work</div>' +
        '<p class="t-caption text-text-secondary">' + p.error_hint + '</p>' +
      '</div>' +
      '<div class="flex flex-wrap gap-2">' +
        '<a href="settings.html?state=provider" class="btn-primary btn-sm">' + AC.icon('key', 'w-3.5 h-3.5') + ' Fix the API key</a>' +
        '<button class="btn-secondary btn-sm js-toast" data-msg="Resuming from the analysis step">' +
          AC.icon('refresh', 'w-3.5 h-3.5') + ' Retry from here</button>' +
        '<button class="btn-ghost btn-sm js-log-jump">' + AC.icon('terminal', 'w-3.5 h-3.5') + ' See the log</button>' +
      '</div>' +
    '</div>' +
    '<span class="badge-error shrink-0 font-mono">' + p.error_code + '</span>' +
  '</div>' +
'</div>'
    );
  }

  if (state === 'awaiting') {
    return (
'<div class="card p-5 border-warning/30 bg-warning/5 mb-5">' +
  '<div class="flex gap-3.5 items-center">' +
    '<span class="text-warning shrink-0">' + AC.icon('hand', 'w-5 h-5') + '</span>' +
    '<div class="min-w-0 grow">' +
      '<div class="t-card mb-1">Your turn</div>' +
      '<p class="t-body text-text-secondary">The transcript is ready and the prompt is written. ' +
      'Run it in whichever model you like, paste the answer back, and rendering continues from there.</p>' +
    '</div>' +
    '<a href="handoff.html?id=' + p.id + '" class="btn-primary shrink-0">Open handoff' + AC.icon('arrowright', 'w-3.5 h-3.5') + '</a>' +
  '</div>' +
'</div>'
    );
  }

  if (state === 'cancelled') {
    return (
'<div class="card p-5 mb-5">' +
  '<div class="flex gap-3.5 items-center">' +
    '<span class="text-text-tertiary shrink-0">' + AC.icon('ban', 'w-5 h-5') + '</span>' +
    '<div class="min-w-0 grow">' +
      '<div class="t-card mb-1">You stopped this job</div>' +
      '<p class="t-body text-text-secondary">The source video and everything transcribed so far are still on disk. ' +
      'Resuming picks up from transcription rather than downloading again.</p>' +
    '</div>' +
    '<button class="btn-primary shrink-0 js-toast" data-msg="Resuming from transcription">' +
      AC.icon('play', 'w-3.5 h-3.5') + ' Resume</button>' +
  '</div>' +
'</div>'
    );
  }

  if (state === 'done') {
    return (
'<div class="card p-4 mb-5 border-success/25 bg-success/5 flex items-center gap-3">' +
  '<span class="text-success">' + AC.icon('check', 'w-5 h-5') + '</span>' +
  '<div class="grow">' +
    '<span class="t-label">' + p.clips.length + ' clips rendered</span>' +
    '<span class="t-caption text-text-secondary block">Finished in ' + AC.fmtDur(p.duration_seconds) +
    ' · all clips are 9:16 with captions burned in</span>' +
  '</div>' +
  '<button class="btn-secondary btn-sm js-toast" data-msg="Saving all clips…">' +
    AC.icon('download', 'w-3.5 h-3.5') + ' Download all</button>' +
  '<button class="btn-ghost btn-sm js-todo">' + AC.icon('refresh', 'w-3.5 h-3.5') + ' Re-render all</button>' +
'</div>'
    );
  }

  if (state === 'download') {
    return (
'<div class="card p-5 mb-5 flex items-center gap-4">' +
  '<div class="w-[92px] aspect-video rounded-input border border-border shrink-0 grid place-items-center bg-bg-primary text-text-tertiary">' +
    AC.icon('film', 'w-6 h-6') + '</div>' +
  '<div class="grow min-w-0">' +
    '<div class="t-card mb-0.5">' + p.file_label + '</div>' +
    '<p class="t-caption text-text-secondary">Full video, no clipping. Subtitles were not burned in for this run.</p>' +
  '</div>' +
  '<button class="btn-secondary btn-sm js-toast" data-msg="Opens the containing folder">' +
    AC.icon('folderopen', 'w-3.5 h-3.5') + ' Show file</button>' +
  '<a href="new-project.html?state=mode" class="btn-primary btn-sm">' + AC.icon('scissors', 'w-3.5 h-3.5') + ' Clip this now</a>' +
'</div>'
    );
  }
  return '';
}

function headerActions() {
  const a = [];
  if (['rendering', 'queued'].indexOf(state) >= 0) {
    a.push('<button class="btn-danger js-cancel">' + AC.icon('x') + ' Cancel job</button>');
  }
  if (state === 'done') {
    a.push('<button class="btn-secondary js-todo">' + AC.icon('refresh') + ' Re-render</button>');
  }
  a.push('<button class="btn-ghost btn-icon js-todo" title="Delete project">' + AC.icon('trash') + '</button>');
  return a.join('');
}

/* --------------------------------------------------------------------- init */
$(function () {
  AC.boot({ nav: 'projects', states: STATES, state: state, crumbs: [
    { label: 'Projects', href: 'projects.html' }, { label: p.title }] });

  const running = ['rendering', 'queued'].indexOf(state) >= 0;
  const showRail = ['done', 'download'].indexOf(state) < 0;

  $('#page').html(
'<a href="projects.html" class="btn-ghost btn-sm -ml-3 mb-3">' + AC.icon('arrowleft', 'w-3.5 h-3.5') + ' All projects</a>' +

'<div class="flex items-start justify-between gap-4 mb-6">' +
  '<div class="min-w-0">' +
    '<div class="flex flex-wrap items-center gap-2 mb-1.5">' +
      '<h1 class="t-page truncate">' + p.title + '</h1>' +
      AC.statusBadge(state === 'queued' ? 'QUEUED' : pos.status) +
      AC.modeBadge(p.mode) +
    '</div>' +
    '<p class="t-caption text-text-tertiary font-mono">' + p.url + '</p>' +
  '</div>' +
  '<div class="flex items-center gap-2 shrink-0">' + headerActions() + '</div>' +
'</div>' +

banner() +

'<div class="flex gap-6 items-start">' +
  '<div class="grow min-w-0 space-y-5">' +
    (showRail
      ? '<div class="card p-5">' +
          '<div class="flex items-center gap-2 mb-4">' +
            '<span class="t-card">Progress</span>' +
            (running ? '<span class="badge-info"><span class="dot bg-current animate-pulse-soft"></span>Live</span>' : '') +
          '</div>' + phaseRail() + '</div>'
      : '') +

    (['done'].indexOf(state) >= 0
      ? '<div>' +
          '<div class="flex items-center gap-2 mb-3">' +
            '<h2 class="t-section">Clips</h2>' +
            '<span class="badge-neutral">' + p.clips.length + '</span>' +
            '<span class="grow"></span>' +
            '<span class="t-caption text-text-tertiary">Sorted by AI score</span>' +
          '</div>' +
          '<div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">' +
            p.clips.map(clipCard).join('') + '</div>' +
        '</div>'
      : '') +

    (state === 'rendering' && p.clips.length
      ? '<div>' +
          '<div class="flex items-center gap-2 mb-3">' +
            '<h2 class="t-section">Clips so far</h2>' +
            '<span class="badge-neutral">' + p.clips.length + ' of ' + p.clips_expected + '</span>' +
          '</div>' +
          '<div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">' +
            p.clips.map(clipCard).join('') +
            '<div class="card border-dashed grid place-items-center aspect-[9/16] text-text-tertiary">' +
              '<div class="text-center px-3">' +
                '<div class="mx-auto mb-2 w-8 h-8 grid place-items-center">' + AC.icon('film', 'w-5 h-5') + '</div>' +
                '<p class="t-caption">Clip 3 rendering…</p>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>'
      : '') +

    '<div id="logmount">' + logPanel() + '</div>' +
  '</div>' +

  '<aside class="w-[280px] shrink-0 hidden lg:block sticky top-8 space-y-4">' +
    detailPanel() +
  '</aside>' +
'</div>'
  );

  $(document).on('click', '.js-log-toggle', function () {
    $('.js-log-body').toggleClass('hidden');
    $('.js-log-chev').toggleClass('rotate-180');
  });

  $(document).on('click', '.js-log-jump', function () {
    $('.js-log-body').removeClass('hidden');
    $('.js-log-chev').addClass('rotate-180');
    document.getElementById('logmount').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  /* Cancel confirms, and is honest about what survives. */
  $(document).on('click', '.js-cancel', function () {
    AC.openModal(
      AC.modalHead('Stop this job?', 'Nothing already finished is thrown away.') +
      '<div class="modal-body">' +
        '<p class="t-body text-text-secondary mb-4">The renderer finishes the frame it is on, then stops. You keep:</p>' +
        '<ul class="space-y-2 mb-4">' +
          ['The downloaded source video', 'The full transcript', '2 clips already rendered'].map(function (x) {
            return '<li class="flex items-center gap-2 t-body">' +
              '<span class="text-success">' + AC.icon('check', 'w-4 h-4') + '</span>' + x + '</li>';
          }).join('') +
        '</ul>' +
        '<p class="t-caption text-text-secondary">Resuming later starts from the rendering step — nothing is downloaded or transcribed twice.</p>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn-ghost js-modal-close">Keep running</button>' +
        '<button class="btn-danger js-confirm-cancel">Stop job</button>' +
      '</div>',
      'max-w-[440px]'
    );
  });
  $(document).on('click', '.js-confirm-cancel', function () {
    AC.closeModal();
    window.location.href = 'project.html?id=' + p.id + '&state=cancelled';
  });

  /* Social kit — a panel, not a nested modal on top of a card */
  $(document).on('click', '.js-social', function () {
    const c = p.clips[$(this).data('i')] || p.clips[0];
    const s = AC.SOCIAL_SAMPLE;
    const sec = function (icon, title, body) {
      return '<div class="mb-4"><div class="flex items-center gap-2 mb-1.5">' +
        '<span class="text-text-tertiary">' + AC.icon(icon, 'w-3.5 h-3.5') + '</span>' +
        '<span class="t-overline text-text-tertiary">' + title + '</span></div>' + body + '</div>';
    };

    AC.openModal(
      AC.modalHead('Social kit · ' + c.title, 'Generated alongside the clip. Everything is editable.') +
      '<div class="modal-body">' +
        sec('type', 'Title options',
          '<div class="space-y-1.5">' + s.titles_en.map(function (t) {
            return '<div class="panel px-3 py-2.5 flex items-center gap-2 group">' +
              '<span class="t-body grow">' + t + '</span>' +
              '<button class="btn-ghost btn-icon btn-sm js-toast opacity-0 group-hover:opacity-100 transition-opacity" ' +
              'data-msg="Copied">' + AC.icon('copy', 'w-3.5 h-3.5') + '</button></div>';
          }).join('') + '</div>') +
        sec('list', 'Description', '<p class="panel px-3 py-2.5 t-body text-text-secondary">' + s.description_en + '</p>') +
        sec('zap', 'Hashtags', '<div class="flex flex-wrap gap-1.5">' +
          s.hashtags_en.map(function (h) { return '<span class="badge-accent">' + h + '</span>'; }).join('') + '</div>') +
        sec('eye', 'Thumbnail idea', '<p class="panel px-3 py-2.5 t-body text-text-secondary">' + s.thumbnail_layout + '</p>') +
        '<div class="grid sm:grid-cols-2 gap-3">' +
          '<div class="panel px-3 py-2.5"><div class="t-overline text-text-tertiary mb-1">Best time to post</div>' +
            '<div class="t-caption">' + s.best_time_to_post_en + '</div></div>' +
          '<div class="panel px-3 py-2.5"><div class="t-overline text-text-tertiary mb-1">Backsound</div>' +
            '<div class="t-caption">' + s.backsound_en + '</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn-ghost js-todo">' + AC.icon('refresh', 'w-3.5 h-3.5') + ' Regenerate</button>' +
        '<span class="grow"></span>' +
        '<button class="btn-secondary js-modal-close">Close</button>' +
        '<button class="btn-primary js-toast" data-msg="Copied the full kit">' + AC.icon('copy', 'w-3.5 h-3.5') + ' Copy all</button>' +
      '</div>',
      'max-w-[560px]'
    );
  });
});
