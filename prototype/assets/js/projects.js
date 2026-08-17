/* =============================================================================
   PROJECTS — the hub
   -----------------------------------------------------------------------------
   Was "History". In the current build every meaningful recovery action
   (re-render, AI correct, continue manual, edit clip) already lived only here,
   so this screen was the hub in practice while being presented as an archive.
============================================================================= */

const STATES = [
  { id: 'default', label: 'Has projects' },
  { id: 'empty',   label: 'Empty (first run)' },
  { id: 'loading', label: 'Loading' },
];
const state = AC.qs('state', 'default');

/* --------------------------------------------------------- clip thumbnail --
   No video in this prototype. A deterministic gradient poster stands in, so
   layout, density and truncation can still be judged honestly.
-------------------------------------------------------------------------- */
function poster(clip, cls) {
  return (
'<div class="relative rounded-[9px] overflow-hidden shrink-0 ' + (cls || 'w-[74px]') + ' aspect-[9/16] ' +
     'border border-border bg-bg-primary">' +
  '<div class="absolute inset-0" style="background:linear-gradient(150deg,' +
      'hsl(' + clip.hue + ' 55% 26%),hsl(' + ((clip.hue + 42) % 360) + ' 48% 13%))"></div>' +
  '<div class="absolute inset-0 grid place-items-center text-white/25">' + AC.icon('play', 'w-5 h-5') + '</div>' +
  '<div class="absolute left-1 bottom-1 right-1 flex items-center gap-1">' +
    '<span class="t-caption text-[10px] font-mono text-white/90 bg-black/55 rounded px-1">' +
      clip.duration + 's</span>' +
  '</div>' +
'</div>'
  );
}

function metaRow(p) {
  const bits = [];
  bits.push(AC.icon(p.source_type === 'local' ? 'upload' : 'link', 'w-3.5 h-3.5') + p.source_label);
  bits.push(AC.icon('clock', 'w-3.5 h-3.5') + p.created_label);
  if (p.duration_seconds) bits.push(AC.icon('cpu', 'w-3.5 h-3.5') + AC.fmtDur(p.duration_seconds) + ' of compute');
  if (p.quality && p.quality !== '—') bits.push(p.quality);
  bits.push(p.aspect_ratio);
  return (
    '<div class="flex flex-wrap items-center gap-x-3.5 gap-y-1 t-caption text-text-tertiary">' +
    bits.map(function (b) { return '<span class="inline-flex items-center gap-1.5">' + b + '</span>'; }).join('') +
    '</div>'
  );
}

/* ------------------------------------------------------------- body by state */
function bodyFor(p) {
  // Running
  if (['DOWNLOADING', 'TRANSCRIBING', 'ANALYZING', 'RENDERING', 'QUEUED'].indexOf(p.status) >= 0) {
    const pct = p.status === 'QUEUED' ? 0 : 72;
    return (
'<div class="panel p-3.5 mt-3">' +
  '<div class="flex items-center gap-2 mb-2">' +
    '<span class="t-label">' + (p.phase_detail || 'Waiting for the renderer') + '</span>' +
    '<span class="grow"></span>' +
    '<span class="t-caption text-text-secondary">' + (p.elapsed || '—') + ' elapsed</span>' +
    '<span class="t-caption text-accent">' + (p.eta || '') + '</span>' +
  '</div>' +
  '<div class="track ' + (p.status === 'QUEUED' ? '' : '') + '">' +
    '<div class="track-fill" style="width:' + pct + '%"></div></div>' +
  (p.clips && p.clips.length
    ? '<div class="flex items-center gap-2 mt-3">' +
        p.clips.map(function (c) { return poster(c, 'w-[46px]'); }).join('') +
        '<span class="t-caption text-text-tertiary ml-1">' + p.clips.length + ' of ' +
        (p.clips_expected || '?') + ' rendered so far</span></div>'
    : '') +
'</div>'
    );
  }

  // Error
  if (p.status === 'ERROR') {
    return (
'<div class="panel p-3.5 mt-3 border-error/25 bg-error/5">' +
  '<div class="flex gap-2.5">' +
    '<span class="text-error shrink-0 mt-0.5">' + AC.icon('alert') + '</span>' +
    '<div class="min-w-0">' +
      '<div class="t-label mb-1">Failed during ' +
        (AC.STATUS_META[p.failed_phase] || {}).label + ' · <span class="font-mono t-caption text-text-tertiary">' +
        p.error_code + '</span></div>' +
      '<p class="t-caption text-text-secondary">' + p.error + '</p>' +
    '</div>' +
  '</div>' +
'</div>'
    );
  }

  // Awaiting the user's own LLM
  if (p.status === 'AWAITING_MANUAL') {
    return (
'<div class="panel p-3.5 mt-3 border-warning/25 bg-warning/5">' +
  '<div class="flex gap-2.5 items-center">' +
    '<span class="text-warning shrink-0">' + AC.icon('hand') + '</span>' +
    '<div class="min-w-0 grow">' +
      '<div class="t-label">The prompt is ready for you</div>' +
      '<p class="t-caption text-text-secondary">Transcription finished. Run the prompt in your own chat model, then paste the result back.</p>' +
    '</div>' +
    '<a href="handoff.html?id=' + p.id + '" class="btn-primary btn-sm shrink-0">Continue' + AC.icon('arrowright', 'w-3.5 h-3.5') + '</a>' +
  '</div>' +
'</div>'
    );
  }

  // Cancelled
  if (p.status === 'CANCELLED') {
    return (
'<p class="t-caption text-text-tertiary mt-3">Stopped by you during ' +
  (AC.STATUS_META[p.cancelled_at_phase] || {}).label +
  '. The downloaded source is still on disk, so restarting will not download it again.</p>'
    );
  }

  // Download-only, completed
  if (p.is_download_only) {
    return (
'<div class="panel p-3.5 mt-3 flex items-center gap-3">' +
  '<span class="text-text-secondary">' + AC.icon('film') + '</span>' +
  '<span class="t-label grow truncate">' + p.file_label + '</span>' +
  '<button class="btn-secondary btn-sm js-toast" data-msg="Opens the containing folder">' +
    AC.icon('folderopen', 'w-3.5 h-3.5') + ' Show file</button>' +
'</div>'
    );
  }

  // Completed with clips
  return (
'<div class="mt-3">' +
  '<div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">' +
    p.clips.map(function (c) {
      return (
        '<a href="studio.html?id=' + p.id + '&clip=' + c.index + '" class="group relative shrink-0" title="' + c.title + '">' +
        poster(c) +
        '<span class="absolute inset-0 rounded-[9px] ring-2 ring-accent opacity-0 group-hover:opacity-100 transition-opacity"></span>' +
        '</a>'
      );
    }).join('') +
    '<span class="t-caption text-text-tertiary ml-1.5 shrink-0">' + p.clips.length + ' clips</span>' +
  '</div>' +
'</div>'
  );
}

function actionsFor(p) {
  const a = [];
  a.push('<a href="project.html?id=' + p.id + '&state=' + stateForProject(p) + '" class="btn-secondary btn-sm">Open</a>');

  if (p.status === 'ERROR') {
    a.push('<button class="btn-primary btn-sm js-toast" data-msg="Resuming from the analysis step — download and transcript are reused">' +
      AC.icon('refresh', 'w-3.5 h-3.5') + ' Fix & retry</button>');
  }
  if (p.status === 'DONE' && p.clips.length) {
    a.push('<button class="btn-ghost btn-sm js-todo">' + AC.icon('refresh', 'w-3.5 h-3.5') + ' Re-render</button>');
  }
  if (p.status === 'CANCELLED') {
    a.push('<button class="btn-secondary btn-sm js-toast" data-msg="Restarting from the transcription step">' +
      AC.icon('play', 'w-3.5 h-3.5') + ' Resume</button>');
  }
  a.push('<button class="btn-ghost btn-icon btn-sm js-delete" data-id="' + p.id + '" data-title="' + p.title + '" title="Delete project">' +
    AC.icon('trash', 'w-3.5 h-3.5') + '</button>');
  return a.join('');
}

function stateForProject(p) {
  const map = {
    DONE: p.is_download_only ? 'download' : 'done',
    ERROR: 'error',
    CANCELLED: 'cancelled',
    AWAITING_MANUAL: 'awaiting',
    QUEUED: 'queued',
  };
  return map[p.status] || 'rendering';
}

function card(p) {
  return (
'<article class="card card-hover p-4">' +
  '<div class="flex items-start gap-3">' +
    '<div class="min-w-0 grow">' +
      '<div class="flex flex-wrap items-center gap-2 mb-1.5">' +
        '<a href="project.html?id=' + p.id + '&state=' + stateForProject(p) + '" class="t-card truncate hover:text-accent transition-colors">' +
          p.title + '</a>' +
        AC.statusBadge(p.status) +
        AC.modeBadge(p.mode) +
      '</div>' +
      metaRow(p) +
    '</div>' +
    '<div class="flex items-center gap-1.5 shrink-0">' + actionsFor(p) + '</div>' +
  '</div>' +
  bodyFor(p) +
'</article>'
  );
}

/* ------------------------------------------------------------------ render */
function renderList(list) {
  if (!list.length) {
    $('#list').html(
'<div class="empty-state">' +
  '<span class="text-text-tertiary mb-3">' + AC.icon('search', 'w-7 h-7') + '</span>' +
  '<p class="t-card mb-1">No projects match those filters</p>' +
  '<p class="t-caption text-text-secondary">Try a different status, or clear the search.</p>' +
'</div>');
    return;
  }
  $('#list').html(list.map(card).join(''));
}

function pageDefault() {
  const filters = ['All', 'Running', 'Completed', 'Needs attention'];

  $('#page').html(
    AC.pageHead(
      'Projects',
      'Every job, its clips, and everything you can still do to them.',
      '<a href="new-project.html" class="btn-primary">' + AC.icon('plus') + ' New project</a>' +
      '<button class="btn-secondary js-quickdl">' + AC.icon('download') + ' Download only</button>'
    ) +

    '<div class="flex flex-wrap items-center gap-2 mb-5">' +
      '<div class="relative grow max-w-[300px]">' +
        '<span class="absolute left-3 top-1/2 -mt-2 text-text-tertiary">' + AC.icon('search') + '</span>' +
        '<input class="input input-with-icon" id="q" placeholder="Search projects…" type="search"/>' +
      '</div>' +
      '<div class="segmented" id="filters">' +
        filters.map(function (f, i) {
          return '<span class="segmented-item" data-val="' + f + '" aria-selected="' + (i === 0) + '">' + f + '</span>';
        }).join('') +
      '</div>' +
      '<span class="grow"></span>' +
      '<span class="t-caption text-text-tertiary" id="count"></span>' +
    '</div>' +

    '<div class="space-y-3" id="list"></div>'
  );

  let q = '', f = 'All';
  const apply = function () {
    const list = AC.PROJECTS.filter(function (p) {
      if (q && p.title.toLowerCase().indexOf(q) < 0 && p.url.toLowerCase().indexOf(q) < 0) return false;
      if (f === 'Running') return ['DOWNLOADING', 'TRANSCRIBING', 'ANALYZING', 'RENDERING', 'QUEUED'].indexOf(p.status) >= 0;
      if (f === 'Completed') return p.status === 'DONE';
      if (f === 'Needs attention') return ['ERROR', 'AWAITING_MANUAL', 'CANCELLED'].indexOf(p.status) >= 0;
      return true;
    });
    $('#count').text(list.length + ' of ' + AC.PROJECTS.length + ' projects');
    renderList(list);
  };

  $('#q').on('input', function () { q = $(this).val().toLowerCase(); apply(); });
  $('#filters').on('ac:segment', function (e, val) { f = val; apply(); });
  apply();
}

function pageEmpty() {
  $('#page').html(
    AC.pageHead('Projects', 'Every job, its clips, and everything you can still do to them.') +
'<div class="empty-state py-20">' +
  '<img src="assets/img/character-cutout.png" alt="" class="w-28 mb-4 opacity-80"/>' +
  '<p class="t-section mb-1.5">Nothing here yet</p>' +
  '<p class="t-body text-text-secondary max-w-[420px] mb-6">' +
    'Start with a YouTube link or a file from your drive. Auto Clipper keeps each job in its own ' +
    'folder, so the source video, the transcript and the clips never mix between projects.</p>' +
  '<div class="flex gap-2">' +
    '<a href="new-project.html" class="btn-primary btn-lg">' + AC.icon('plus') + ' Create your first project</a>' +
    '<a href="help.html" class="btn-secondary btn-lg">How it works</a>' +
  '</div>' +
'</div>'
  );
}

function pageLoading() {
  $('#page').html(
    AC.pageHead('Projects', 'Every job, its clips, and everything you can still do to them.') +
    '<div class="space-y-3">' +
      [0, 1, 2].map(function () {
        return (
'<div class="card p-4">' +
  '<div class="flex items-center gap-3 mb-3">' +
    '<div class="skel h-4 w-[220px]"></div><div class="skel h-[22px] w-20 rounded-full"></div>' +
    '<span class="grow"></span><div class="skel h-8 w-16 rounded-button"></div>' +
  '</div>' +
  '<div class="skel h-3 w-[340px] mb-3"></div>' +
  '<div class="flex gap-2">' + [0,1,2,3].map(function(){
    return '<div class="skel w-[74px] aspect-[9/16] rounded-[9px]"></div>'; }).join('') + '</div>' +
'</div>'
        );
      }).join('') +
    '</div>'
  );
}

/* --------------------------------------------------------------------- init */
$(function () {
  AC.boot({ nav: 'projects', states: STATES, state: state, crumbs: [{ label: 'Projects' }] });

  if (state === 'empty') pageEmpty();
  else if (state === 'loading') pageLoading();
  else pageDefault();

  /* Destructive delete gets a real dialog with a named target — the current
     build uses window.confirm() with a generic string and no undo. */
  $(document).on('click', '.js-delete', function () {
    const title = $(this).data('title');
    AC.openModal(
      AC.modalHead('Delete this project?', 'This cannot be undone.') +
      '<div class="modal-body">' +
        '<p class="t-body text-text-secondary mb-4">You are about to delete ' +
          '<span class="text-text-primary font-medium">' + title + '</span>, including:</p>' +
        '<ul class="t-body text-text-secondary space-y-1.5 list-disc pl-5">' +
          '<li>the downloaded source video</li>' +
          '<li>the transcript and subtitle files</li>' +
          '<li>every rendered clip in this project</li>' +
        '</ul>' +
        '<label class="flex items-center gap-2.5 mt-5 panel p-3 cursor-pointer">' +
          '<span class="toggle" aria-checked="false" role="switch"></span>' +
          '<span class="t-label">Keep the rendered clips, delete everything else</span>' +
        '</label>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn-ghost js-modal-close">Cancel</button>' +
        '<button class="btn-danger js-confirm-del">' + AC.icon('trash', 'w-3.5 h-3.5') + ' Delete project</button>' +
      '</div>',
      'max-w-[460px]'
    );
  });

  $(document).on('click', '.js-confirm-del', function () {
    AC.closeModal();
    AC.toast('Project deleted', 'success');
  });

  $(document).on('click', '.js-quickdl', function () {
    window.location.href = 'new-project.html?mode=download&step=source';
  });
});
