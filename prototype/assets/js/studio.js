/* =============================================================================
   CLIP STUDIO
   -----------------------------------------------------------------------------
   Replaces ClipEditModal — a modal three levels deep whose main affordances
   were a word grid and two JSON textareas, with a copy/paste round-trip through
   an external chat model to fix a typo.

   Caption and canvas controls come from assets/js/controls.js, the same module
   New Project uses, so the two screens cannot drift apart.

   Genuinely interactive here (pure frontend, so it is real):
     · playhead + play/pause + scrub
     · trim in/out handles
     · word-level transcript synced to the playhead, editable
     · the caption box is DRAGGABLE on the preview -> closes the PRD backlog
       "konfigurasi bebas mengatur posisi subtitle (X dan Y axis) tiap clip"
     · every subtitle field feeds the live preview
   Faked: the video itself (poster + fake playhead) and the render.
============================================================================= */

const STATES = [
  { id: 'default',    label: 'Transcript ready' },
  { id: 'nowords',    label: 'No subtitle file' },
  { id: 'fixauto',    label: 'Fixer · automatic' },
  { id: 'fixnokey',   label: 'Fixer · no API key' },
  { id: 'fixmanual',  label: 'Fixer · copy to chat model' },
  { id: 'fixpaste',   label: 'Fixer · paste result' },
  { id: 'fixinvalid', label: 'Fixer · paste rejected' },
  { id: 'fixreview',  label: 'Fixer · review changes' },
];
const state = AC.qs('state', 'default');

const project = AC.getProject(AC.qs('id') || 'p_9f2a');
const theClip = project.clips[parseInt(AC.qs('clip', '0'), 10)] || project.clips[0];
const words = state === 'nowords' ? [] : AC.WORDS;
const FIX_STATES = ['fixauto','fixnokey','fixmanual','fixpaste','fixinvalid','fixreview'];

const DUR = words.length ? Math.ceil(words[words.length - 1].end) + 1 : 37;

/* Config objects, shaped exactly like the real SubtitleConfig / CanvasConfig */
const SUB = Object.assign({}, AC.DEFAULT_SUBTITLE_CONFIG);
const CANVAS = Object.assign({}, AC.DEFAULT_CANVAS_CONFIG);

const S = {
  t: 0,
  playing: false,
  trimIn: 0,
  trimOut: DUR,
  tab: 'transcript',
  changed: {},
  ratio: '9:16',
};

const fmt = function (s) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60), c = Math.floor((s % 1) * 100);
  return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0') + '.' + String(c).padStart(2, '0');
};

/* Exact hit when the playhead is inside a word; otherwise the nearest one, so
   the caption box is never empty (an empty box would be impossible to grab). */
const activeWord = function () {
  if (!words.length) return null;
  let best = words[0], bestD = Infinity;
  for (let i = 0; i < words.length; i++) {
    if (S.t >= words[i].start && S.t <= words[i].end) return words[i];
    const d = Math.min(Math.abs(S.t - words[i].start), Math.abs(S.t - words[i].end));
    if (d < bestD) { bestD = d; best = words[i]; }
  }
  return best;
};

/* ------------------------------------------------------------------ topbar */
function topbar() {
  return (
'<header class="h-14 shrink-0 border-b border-border bg-bg-secondary flex items-center gap-3 px-4">' +
  '<a href="project.html?id=' + project.id + '&state=done" class="btn-ghost btn-sm">' +
    AC.icon('arrowleft', 'w-3.5 h-3.5') + ' Back</a>' +
  '<div class="divider w-px h-6"></div>' +
  '<div class="min-w-0">' +
    '<div class="t-label truncate">' + theClip.title + '</div>' +
    '<div class="t-caption text-text-tertiary truncate">' + project.title + ' · clip ' + (theClip.index + 1) +
      ' of ' + project.clips.length + '</div>' +
  '</div>' +
  '<div class="flex items-center gap-1 ml-2">' +
    '<button class="btn-ghost btn-icon btn-sm js-nav-clip" data-d="-1" title="Previous clip">' +
      AC.icon('chevleft', 'w-4 h-4') + '</button>' +
    '<button class="btn-ghost btn-icon btn-sm js-nav-clip" data-d="1" title="Next clip">' +
      AC.icon('chevright', 'w-4 h-4') + '</button>' +
  '</div>' +
  '<span class="grow"></span>' +
  '<span class="t-caption text-text-tertiary js-dirty hidden">Unsaved changes</span>' +
  '<button class="btn-ghost btn-sm js-reset hidden">' + AC.icon('refresh', 'w-3.5 h-3.5') + ' Reset</button>' +
  '<button class="btn-primary btn-sm js-save">' + AC.icon('film', 'w-3.5 h-3.5') + ' Save & re-render</button>' +
'</header>'
  );
}

/* ----------------------------------------------------------------- preview */
function preview() {
  return (
'<div class="grow min-w-0 flex flex-col items-center justify-center p-5 bg-bg-primary overflow-hidden">' +

  '<div class="flex items-center gap-2 mb-3 shrink-0">' +
    '<div class="segmented" id="ratio">' +
      AC.ASPECT_RATIOS.map(function (r) {
        return '<span class="segmented-item" data-val="' + r.id + '" aria-selected="' +
          (r.id === S.ratio) + '">' + r.label + '</span>';
      }).join('') +
    '</div>' +
    '<span class="t-caption text-text-tertiary ml-1">Drag the caption to place it</span>' +
  '</div>' +

  '<div class="studio-preview relative rounded-xl overflow-hidden border border-border shadow-card-hover shrink" ' +
       'id="stage" style="height:min(60vh,540px);aspect-ratio:9/16">' +

    '<div class="absolute inset-0" id="canvasBgLayer"></div>' +
    '<div class="absolute" id="fgLayer" style="inset:0">' +
      '<div class="absolute inset-0" id="bg" style="background:linear-gradient(150deg,hsl(' + theClip.hue +
        ' 55% 26%),hsl(' + ((theClip.hue + 42) % 360) + ' 48% 13%))"></div>' +
      '<div class="absolute inset-0 grid place-items-center text-white/15 pointer-events-none">' +
        AC.icon('play', 'w-12 h-12') + '</div>' +
    '</div>' +

    '<div class="absolute top-2.5 left-2.5 t-caption font-mono text-white/70 bg-black/45 rounded px-1.5 py-0.5 ' +
         'pointer-events-none z-20">no video in prototype</div>' +

    '<div class="cap-box absolute select-none z-30" id="cap" ' +
         'style="left:' + SUB.pos_x + '%;top:' + SUB.pos_y + '%;transform:translate(-50%,-50%)">' +
      '<span id="capText"></span>' +
    '</div>' +

    '<div class="absolute inset-x-0 bottom-3 text-center pointer-events-none z-30" id="wmLayer"></div>' +

    '<div class="absolute inset-x-0 bottom-0 h-1 bg-black/40 z-30">' +
      '<div class="h-full bg-white/70" id="miniProg" style="width:0%"></div></div>' +
  '</div>' +

  '<div class="flex items-center gap-3 mt-3 shrink-0">' +
    '<span class="t-caption font-mono text-text-tertiary" id="tPos">00:00.00</span>' +
    '<button class="btn-secondary btn-icon js-play">' + AC.icon('play') + '</button>' +
    '<span class="t-caption font-mono text-text-tertiary">' + fmt(DUR) + '</span>' +
  '</div>' +

'</div>'
  );
}

/* ---------------------------------------------------------------- timeline */
function timeline() {
  const bars = words.length
    ? words.map(function (w) {
        const h = 18 + ((w.word.length * 7) % 44);
        const wd = Math.max(1.2, (w.end - w.start) / DUR * 100);
        return '<span class="absolute bottom-0 bg-accent/30 rounded-t-sm" style="left:' +
          (w.start / DUR * 100) + '%;width:' + wd + '%;height:' + h + '%"></span>';
      }).join('')
    : '<span class="absolute inset-0 grid place-items-center t-caption text-text-tertiary">no audio analysis available</span>';

  return (
'<div class="shrink-0 border-t border-border bg-bg-secondary px-4 py-3">' +
  '<div class="flex items-center gap-3 mb-2">' +
    '<span class="t-overline text-text-tertiary">Timeline</span>' +
    '<span class="t-caption text-text-tertiary">Source ' + theClip.start + ' → ' + theClip.end + '</span>' +
    '<span class="grow"></span>' +
    '<span class="t-caption">Trim <span class="font-mono text-accent" id="trimLbl">' +
      fmt(0) + ' → ' + fmt(DUR) + '</span> · <span class="font-mono" id="trimDur">' +
      DUR.toFixed(1) + 's</span></span>' +
  '</div>' +
  '<div class="relative h-[54px] rounded-input bg-bg-primary border border-border overflow-hidden cursor-pointer" id="track">' +
    bars +
    '<div class="absolute inset-y-0 bg-black/55 pointer-events-none" id="maskL" style="left:0;width:0%"></div>' +
    '<div class="absolute inset-y-0 bg-black/55 pointer-events-none" id="maskR" style="right:0;width:0%"></div>' +
    '<div class="absolute inset-y-0 w-[7px] -ml-[3px] bg-accent/80 hover:bg-accent cursor-ew-resize z-20 rounded" ' +
         'id="hIn" style="left:0%"></div>' +
    '<div class="absolute inset-y-0 w-[7px] -ml-[3px] bg-accent/80 hover:bg-accent cursor-ew-resize z-20 rounded" ' +
         'id="hOut" style="left:100%"></div>' +
    '<div class="absolute inset-y-0 w-px bg-white z-10 pointer-events-none" id="ph" style="left:0%">' +
      '<span class="absolute -top-0 -ml-[5px] w-[11px] h-[11px] rounded-b bg-white"></span></div>' +
  '</div>' +
  '<div class="flex justify-between mt-1.5">' +
    [0, 0.25, 0.5, 0.75, 1].map(function (f) {
      return '<span class="t-caption font-mono text-text-tertiary">' + fmt(DUR * f) + '</span>';
    }).join('') +
  '</div>' +
'</div>'
  );
}

/* -------------------------------------------------------------- side panel */
function sidePanel() {
  const tab = function (id, label, icon) {
    return '<button class="segmented-item grow js-tab" data-tab="' + id + '" aria-selected="' +
      (S.tab === id) + '">' + AC.icon(icon, 'w-3.5 h-3.5') + ' ' + label + '</button>';
  };
  return (
'<aside class="w-[380px] shrink-0 border-l border-border bg-bg-secondary flex flex-col">' +
  '<div class="p-3 border-b border-border shrink-0">' +
    '<div class="segmented w-full" id="tabs">' +
      tab('transcript', 'Transcript', 'type') +
      tab('captions', 'Captions', 'palette') +
      tab('canvas', 'Canvas', 'layers') +
    '</div>' +
  '</div>' +
  '<div class="grow overflow-y-auto" id="panelBody"></div>' +
'</aside>'
  );
}

function panelTranscript() {
  if (!words.length) {
    return (
'<div class="p-4">' +
  '<div class="empty-state py-10">' +
    '<span class="text-text-tertiary mb-3">' + AC.icon('mic', 'w-6 h-6') + '</span>' +
    '<p class="t-card mb-1">No subtitle file for this clip</p>' +
    '<p class="t-caption text-text-secondary mb-4">The render finished before subtitles were written, or subtitles were switched off for this run.</p>' +
    '<button class="btn-secondary btn-sm js-toast" data-msg="Re-transcribing this clip…">' +
      AC.icon('refresh', 'w-3.5 h-3.5') + ' Transcribe this clip</button>' +
  '</div>' +
'</div>'
    );
  }
  return (
'<div class="p-3 border-b border-border sticky top-0 bg-bg-secondary z-10">' +
  '<div class="relative mb-2">' +
    '<span class="absolute left-3 top-1/2 -mt-2 text-text-tertiary">' + AC.icon('search') + '</span>' +
    '<input class="input input-with-icon h-9" id="wsearch" placeholder="Find a word…"/>' +
  '</div>' +
  '<div class="flex items-center gap-2">' +
    '<span class="t-caption text-text-tertiary grow">' + words.length + ' words · click to jump</span>' +
    '<button class="btn-secondary btn-sm js-autofix">' + AC.icon('wand', 'w-3.5 h-3.5') + ' Fix mistakes</button>' +
  '</div>' +
'</div>' +
'<div class="p-2" id="wordList">' + words.map(wordRow).join('') + '</div>'
  );
}

function wordRow(w) {
  return (
'<div class="word-row flex items-center gap-2 px-2 py-1 rounded-input hover:bg-bg-surface transition-colors" ' +
     'data-i="' + w.i + '">' +
  '<button class="t-caption font-mono text-text-tertiary w-[46px] shrink-0 text-left hover:text-accent js-seek" ' +
          'data-t="' + w.start + '">' + w.start.toFixed(1) + 's</button>' +
  '<input class="js-word grow bg-transparent border border-transparent rounded px-1.5 py-1 t-body ' +
         'hover:border-border focus:border-accent focus:outline-none focus:bg-bg-primary" ' +
         'value="' + w.word + '" data-orig="' + w.word + '" data-i="' + w.i + '"/>' +
'</div>'
  );
}

/* Position block sits above the shared subtitle controls, because dragging is
   the headline interaction of this screen. */
function positionBlock() {
  return (
'<div class="space-y-3 pb-1">' +
  '<div class="flex items-center gap-2">' +
    '<span class="text-accent">' + AC.icon('move', 'w-4 h-4') + '</span>' +
    '<span class="t-label grow">On-screen position</span>' +
    '<button class="btn-ghost btn-sm js-center">Reset</button>' +
  '</div>' +
  '<p class="t-caption text-text-secondary">Drag the caption on the preview, or nudge it here. Saved per clip.</p>' +
  '<div class="grid grid-cols-2 gap-3">' +
    '<div><label class="t-caption text-text-tertiary">X · <span class="font-mono" id="xLbl">' + SUB.pos_x + '%</span></label>' +
      '<input type="range" min="8" max="92" value="' + SUB.pos_x + '" id="posx" class="w-full accent-[var(--accent)]"/></div>' +
    '<div><label class="t-caption text-text-tertiary">Y · <span class="font-mono" id="yLbl">' + SUB.pos_y + '%</span></label>' +
      '<input type="range" min="8" max="94" value="' + SUB.pos_y + '" id="posy" class="w-full accent-[var(--accent)]"/></div>' +
  '</div>' +
  '<div class="flex gap-1.5">' +
    [['Top', 18], ['Middle', 50], ['Lower third', 78]].map(function (b) {
      return '<button class="btn-secondary btn-sm grow js-ypreset" data-y="' + b[1] + '">' + b[0] + '</button>';
    }).join('') +
  '</div>' +
'</div>'
  );
}

/* ------------------------------------------------------------------ render */
function paintCaption() {
  const w = activeWord();
  const txt = SUB.style === 'single_word'
    ? (w ? w.word : '')
    : (words.length
        ? words.slice(Math.max(0, (w ? w.i : 0) - 3), (w ? w.i : 0) + 2).map(function (x) { return x.word; }).join(' ')
        : 'caption preview');

  const base = SUB.style === 'single_word' ? 30 : 17;
  const size = base * SUB.font_size_scale;
  const pop = SUB.style === 'single_word' && SUB.animation_pop ? 1.1 : 1;

  $('#capText')
    .html(
      SUB.style === 'karaoke' && w
        ? words.slice(Math.max(0, w.i - 3), w.i).map(function (x) { return x.word; }).join(' ') +
          ' <span style="color:' + SUB.highlight_color + '">' + w.word + '</span> ' +
          words.slice(w.i + 1, w.i + 3).map(function (x) { return x.word; }).join(' ')
        : (SUB.uppercase ? txt.toUpperCase() : txt)
    )
    .attr('style',
      'font-family:\'' + SUB.font_family + '\',Impact,sans-serif;' +
      'font-weight:' + (SUB.font_weight === 'bold' ? 800 : 400) + ';' +
      'font-style:' + (SUB.italic ? 'italic' : 'normal') + ';' +
      'text-transform:' + (SUB.uppercase ? 'uppercase' : 'none') + ';' +
      'line-height:1.15;font-size:' + size + 'px;' +
      'color:' + (SUB.style === 'single_word' ? SUB.highlight_color : SUB.text_color) + ';' +
      '-webkit-text-stroke:' + SUB.outline_width + 'px ' + SUB.outline_color + ';' +
      (SUB.shadow_depth
        ? 'text-shadow:0 ' + SUB.shadow_depth + 'px ' + (SUB.shadow_depth * 2) + 'px ' + SUB.shadow_color + ';'
        : 'text-shadow:none;') +
      'transform:scale(' + pop + ');' +
      'display:inline-block;text-align:center;white-space:pre-wrap;' +
      'max-width:' + (SUB.style === 'single_word' ? '92%' : '80%') + ';');

  // watermark
  $('#wmLayer').html(
    SUB.watermark_text
      ? '<span style="font-size:10px;color:#fff;opacity:' + SUB.watermark_opacity +
        ';text-shadow:0 1px 2px #000">' + SUB.watermark_text + '</span>'
      : ''
  );
}

/* Canvas mode changes what the preview actually shows: a 16:9 frame centred on
   a 9:16 canvas, rather than a full-bleed crop. */
function paintCanvas() {
  const $bgL = $('#canvasBgLayer'), $fg = $('#fgLayer');
  if (!CANVAS.enabled) {
    $bgL.attr('style', 'position:absolute;inset:0;background:transparent');
    $fg.attr('style', 'position:absolute;inset:0');
    return;
  }
  const grad = 'linear-gradient(150deg,hsl(' + theClip.hue + ' 55% 26%),hsl(' +
    ((theClip.hue + 42) % 360) + ' 48% 13%))';

  let bgCss;
  if (CANVAS.background_type === 'blur') {
    const px = { light: 8, medium: 16, strong: 28 }[CANVAS.blur_level] || 16;
    bgCss = 'background:' + grad + ';filter:blur(' + px + 'px);transform:scale(1.15)';
  } else if (CANVAS.background_type === 'color') {
    bgCss = 'background:' + (CANVAS.background_color || '#000');
  } else {
    bgCss = 'background:repeating-linear-gradient(45deg,#2a2f3a 0 12px,#232833 12px 24px)';
  }
  $bgL.attr('style', 'position:absolute;inset:0;' + bgCss);

  const w = Math.min(100, 100 * CANVAS.enlarge_scale);
  $fg.attr('style',
    'position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);' +
    'width:' + w + '%;aspect-ratio:16/9;overflow:hidden;border-radius:4px');
}

function paint() {
  const pct = S.t / DUR * 100;
  $('#ph').css('left', pct + '%');
  $('#miniProg').css('width', pct + '%');
  $('#tPos').text(fmt(S.t));
  paintCaption();
  const w = activeWord();
  $('.word-row').removeClass('bg-accent-muted');
  if (w) $('.word-row[data-i="' + w.i + '"]').addClass('bg-accent-muted');
}

function paintTrim() {
  $('#hIn').css('left', S.trimIn / DUR * 100 + '%');
  $('#hOut').css('left', S.trimOut / DUR * 100 + '%');
  $('#maskL').css('width', S.trimIn / DUR * 100 + '%');
  $('#maskR').css('width', (DUR - S.trimOut) / DUR * 100 + '%');
  $('#trimLbl').text(fmt(S.trimIn) + ' → ' + fmt(S.trimOut));
  $('#trimDur').text((S.trimOut - S.trimIn).toFixed(1) + 's');
}

function markDirty() { $('.js-dirty, .js-reset').removeClass('hidden'); }

function renderPanel() {
  const $b = $('#panelBody');
  if (S.tab === 'captions') {
    $b.html('<div class="p-4">' + positionBlock() + '<div class="divider my-4"></div>' +
            '<div id="subCtl"></div></div>');
    $('#subCtl').data('compact', true).html(AC.subtitleControls(SUB, { compact: true }));
    AC.bindSubtitleControls('#subCtl', SUB, function () { paintCaption(); markDirty(); });
  } else if (S.tab === 'canvas') {
    $b.html('<div class="p-4"><div id="canvasCtl"></div></div>');
    AC.mountCanvasControls('#canvasCtl', CANVAS, function () {
      paintCanvas();
      if (CANVAS.enabled && SUB.pos_y < 70) {
        SUB.pos_y = 78;
        $('#cap').css('top', '78%');
      }
      markDirty();
    }, true);
  } else {
    $b.html(panelTranscript());
  }
  paint();
}

/* --------------------------------------------------------------------- init */
$(function () {
  AC.boot({ nav: 'projects', dock: false, states: STATES, state: state });

  $('#page').html(
    topbar() +
    '<div class="grow min-h-0 flex">' +
      '<div class="grow min-w-0 flex flex-col">' + preview() + timeline() + '</div>' +
      sidePanel() +
    '</div>'
  );

  renderPanel();
  paintTrim();
  paintCanvas();
  paint();

  /* ---------------- playback (local UI only, not a backend simulation) */
  let timer = null;
  $(document).on('click', '.js-play', function () {
    S.playing = !S.playing;
    $(this).html(AC.icon(S.playing ? 'pause' : 'play'));
    if (S.playing) {
      timer = setInterval(function () {
        S.t += 0.05;
        if (S.t >= S.trimOut) S.t = S.trimIn;
        paint();
      }, 50);
    } else clearInterval(timer);
  });

  /* ---------------- scrub */
  $(document).on('click', '#track', function (e) {
    if ($(e.target).is('#hIn,#hOut')) return;
    const r = this.getBoundingClientRect();
    S.t = Math.max(0, Math.min(DUR, (e.clientX - r.left) / r.width * DUR));
    paint();
  });

  /* ---------------- trim handles */
  let dragH = null;
  $(document).on('mousedown', '#hIn,#hOut', function (e) { dragH = this.id; e.preventDefault(); });

  /* ---------------- THE draggable caption box */
  let dragCap = false, offX = 0, offY = 0;
  $(document).on('mousedown', '#cap', function (e) {
    dragCap = true;
    $(this).addClass('dragging');
    const c = this.getBoundingClientRect();
    offX = e.clientX - (c.left + c.width / 2);
    offY = e.clientY - (c.top + c.height / 2);
    e.preventDefault();
  });

  $(document).on('mousemove', function (e) {
    if (dragH) {
      const r = document.getElementById('track').getBoundingClientRect();
      const t = Math.max(0, Math.min(DUR, (e.clientX - r.left) / r.width * DUR));
      if (dragH === 'hIn') S.trimIn = Math.min(t, S.trimOut - 1);
      else S.trimOut = Math.max(t, S.trimIn + 1);
      paintTrim(); markDirty();
      return;
    }
    if (!dragCap) return;
    const r = document.getElementById('stage').getBoundingClientRect();
    SUB.pos_x = Math.round(Math.max(8, Math.min(92, (e.clientX - offX - r.left) / r.width * 100)));
    SUB.pos_y = Math.round(Math.max(8, Math.min(94, (e.clientY - offY - r.top) / r.height * 100)));
    $('#cap').css({ left: SUB.pos_x + '%', top: SUB.pos_y + '%' });
    $('#posx').val(SUB.pos_x); $('#xLbl').text(SUB.pos_x + '%');
    $('#posy').val(SUB.pos_y); $('#yLbl').text(SUB.pos_y + '%');
    markDirty();
  });

  $(document).on('mouseup', function () {
    if (dragCap) { dragCap = false; $('#cap').removeClass('dragging'); }
    dragH = null;
  });

  /* ---------------- panel: tabs + position */
  $(document).on('click', '.js-tab', function () { S.tab = $(this).data('tab'); renderPanel(); });

  $(document).on('input', '#posx', function () {
    SUB.pos_x = +this.value; $('#xLbl').text(SUB.pos_x + '%'); $('#cap').css('left', SUB.pos_x + '%'); markDirty();
  });
  $(document).on('input', '#posy', function () {
    SUB.pos_y = +this.value; $('#yLbl').text(SUB.pos_y + '%'); $('#cap').css('top', SUB.pos_y + '%'); markDirty();
  });
  $(document).on('click', '.js-ypreset', function () {
    SUB.pos_y = +$(this).data('y'); $('#posy').val(SUB.pos_y); $('#yLbl').text(SUB.pos_y + '%');
    $('#cap').css('top', SUB.pos_y + '%'); markDirty();
  });
  $(document).on('click', '.js-center', function () {
    SUB.pos_x = 50; SUB.pos_y = 78;
    $('#cap').css({ left: '50%', top: '78%' });
    $('#posx').val(50); $('#posy').val(78); $('#xLbl').text('50%'); $('#yLbl').text('78%');
  });

  /* ---------------- transcript */
  $(document).on('click', '.js-seek', function () { S.t = +$(this).data('t'); paint(); });

  $(document).on('input', '.js-word', function () {
    const changed = $(this).val() !== $(this).data('orig');
    $(this).toggleClass('!border-warning bg-warning/5', changed);
    S.changed[$(this).data('i')] = changed;
    markDirty();
  });

  $(document).on('input', '#wsearch', function () {
    const q = $(this).val().toLowerCase();
    $('.word-row').each(function () {
      const v = $(this).find('.js-word').val().toLowerCase();
      $(this).toggleClass('hidden', !!q && v.indexOf(q) < 0);
    });
  });

  $(document).on('click', '.js-autofix', function () { openFix({}); });

  /* ---------------- ratio + save */
  $(document).on('ac:segment', '#ratio', function (e, val) {
    S.ratio = val;
    const r = AC.ASPECT_RATIOS.filter(function (x) { return x.id === val; })[0];
    $('#stage').css('aspect-ratio', r.w + '/' + r.h);
    if (val !== '16:9' && CANVAS.enabled) {
      CANVAS.enabled = false;
      if (S.tab === 'canvas') renderPanel();
      paintCanvas();
    }
    markDirty();
  });

  $(document).on('click', '.js-save', function () {
    const n = Object.keys(S.changed).filter(function (k) { return S.changed[k]; }).length;
    const rows = [
      ['Trim', fmt(S.trimIn) + ' → ' + fmt(S.trimOut) + ' (' + (S.trimOut - S.trimIn).toFixed(1) + 's)'],
      ['Aspect ratio', S.ratio + (CANVAS.enabled ? ' → 9:16 canvas' : '')],
      ['Caption style', SUB.style.replace('_', ' ') + ' · ' + SUB.font_family + ' · ' + SUB.font_size_scale + '×'],
      ['Caption position', SUB.pos_x + '% × ' + SUB.pos_y + '%'],
      ['Watermark', SUB.watermark_text ? SUB.watermark_text + ' @ ' + Math.round(SUB.watermark_opacity * 100) + '%' : 'off'],
      ['Transcript edits', n ? n + ' word' + (n > 1 ? 's' : '') + ' changed' : 'none'],
    ];
    AC.openModal(
      AC.modalHead('Re-render this clip?', 'Only this clip is re-rendered — the other ' + (project.clips.length - 1) + ' are untouched.') +
      '<div class="modal-body">' +
        '<div class="space-y-1 mb-4">' +
          rows.map(function (r) {
            return '<div class="flex items-baseline gap-3 py-1">' +
              '<span class="t-caption text-text-tertiary w-[120px] shrink-0">' + r[0] + '</span>' +
              '<span class="t-label">' + r[1] + '</span></div>';
          }).join('') +
        '</div>' +
        '<div class="panel p-3 flex gap-2.5">' +
          '<span class="text-text-tertiary shrink-0">' + AC.icon('clock', 'w-4 h-4') + '</span>' +
          '<span class="t-caption text-text-secondary">About 40 seconds. The previous version is kept, so you can compare or roll back.</span>' +
        '</div>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button class="btn-ghost js-modal-close">Keep editing</button>' +
        '<button class="btn-primary js-confirm-render">' + AC.icon('film', 'w-3.5 h-3.5') + ' Re-render clip</button>' +
      '</div>',
      'max-w-[480px]'
    );
  });
  $(document).on('click', '.js-confirm-render', function () {
    AC.closeModal();
    window.location.href = 'project.html?id=' + project.id + '&state=rendering';
  });

  $(document).on('click', '.js-nav-clip', function () {
    const d = +$(this).data('d');
    const n = Math.max(0, Math.min(project.clips.length - 1, theClip.index + d));
    window.location.href = 'studio.html?id=' + project.id + '&clip=' + n;
  });

  $(document).on('click', '.js-reset', function () { window.location.reload(); });

  $(document).on('keydown', function (e) {
    if ($(e.target).is('input,textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); $('.js-play').click(); }
    if (e.key === 'ArrowRight') { S.t = Math.min(DUR, S.t + 0.5); paint(); }
    if (e.key === 'ArrowLeft') { S.t = Math.max(0, S.t - 0.5); paint(); }
  });
});

/* =============================================================================
   TRANSCRIPT FIXER — two paths, one review step
   -----------------------------------------------------------------------------
   Restores the half of ClipEditModal's "AI Auto Correction" the first prototype
   pass dropped: the app writes the prompt, you run it in whatever chat model you
   already use, and paste the answer back. That is the path for people who have
   no API key — and today it is the only path that reliably works, because the
   automatic one reads the wrong localStorage keys.

   Both paths converge on the same review step. Nothing is written to the
   transcript until you accept it there.
============================================================================= */

const FIX = { mode: 'auto', step: 1, paste: '', invalid: false, running: false, skipped: {}, nokey: false };

function fixDiffList() {
  const diffs = AC.fixDiffs();
  if (!diffs.length) {
    return '<div class="empty-state py-10">' +
      '<span class="text-success mb-2">' + AC.icon('check', 'w-6 h-6') + '</span>' +
      '<p class="t-card mb-1">Nothing to fix</p>' +
      '<p class="t-caption text-text-secondary">The model found no transcription mistakes in this clip.</p></div>';
  }
  const kept = diffs.filter(function (d) { return !FIX.skipped[d.i]; }).length;

  return (
'<div class="flex items-center gap-2 mb-3">' +
  '<span class="t-label grow">' + diffs.length + ' proposed change' + (diffs.length > 1 ? 's' : '') + '</span>' +
  '<span class="t-caption text-text-tertiary">' + kept + ' selected · ' +
    (words.length - diffs.length) + ' words untouched</span>' +
'</div>' +
'<div class="space-y-2">' +
  diffs.map(function (d) {
    const off = !!FIX.skipped[d.i];
    return (
'<div class="panel p-3 flex items-start gap-3 ' + (off ? 'opacity-45' : '') + '">' +
  '<button class="js-fix-skip w-[18px] h-[18px] rounded border-2 shrink-0 mt-0.5 grid place-items-center transition-all ' +
    (off ? 'border-border' : 'border-accent bg-accent text-white') + '" data-i="' + d.i + '" ' +
    'aria-pressed="' + (!off) + '" title="' + (off ? 'Include this change' : 'Skip this change') + '">' +
    (off ? '' : AC.icon('check', 'w-3 h-3')) + '</button>' +
  '<div class="grow min-w-0">' +
    '<div class="flex items-center gap-2 mb-1 flex-wrap">' +
      '<span class="t-body font-mono line-through text-error/80">' + d.from + '</span>' +
      '<span class="text-text-tertiary">' + AC.icon('arrowright', 'w-3.5 h-3.5') + '</span>' +
      '<span class="t-body font-mono text-success">' + d.to + '</span>' +
      '<span class="badge-neutral !h-[18px] !text-[10px] font-mono">' + d.start.toFixed(1) + 's</span>' +
    '</div>' +
    '<p class="t-caption text-text-secondary">' + d.reason + '</p>' +
  '</div>' +
  '<button class="btn-ghost btn-icon btn-sm js-fix-seek" data-t="' + d.start + '" title="Jump to this word">' +
    AC.icon('play', 'w-3.5 h-3.5') + '</button>' +
'</div>'
    );
  }).join('') +
'</div>'
  );
}

function fixModeSwitch() {
  return (
'<div class="segmented w-full mb-4">' +
  '<span class="segmented-item grow js-fix-mode" data-m="auto" aria-selected="' + (FIX.mode === 'auto') + '">' +
    AC.icon('zap', 'w-3.5 h-3.5') + ' Use my API key</span>' +
  '<span class="segmented-item grow js-fix-mode" data-m="manual" aria-selected="' + (FIX.mode === 'manual') + '">' +
    AC.icon('copy', 'w-3.5 h-3.5') + ' Copy to a chat model</span>' +
'</div>'
  );
}

function fixBody() {
  /* ---- shared review step ---- */
  if (FIX.step === 'review') {
    return (
'<div class="modal-body">' +
  '<div class="card p-3 mb-4 border-info/25 bg-info/5 flex items-center gap-2.5">' +
    '<span class="text-info shrink-0">' + AC.icon('info', 'w-4 h-4') + '</span>' +
    '<span class="t-caption text-text-secondary">' +
      (FIX.mode === 'auto' ? 'From OpenAI gpt-4o-mini.' : 'Parsed from what you pasted.') +
      ' Timings were not touched — only the words. Untick anything you disagree with.</span>' +
  '</div>' +
  fixDiffList() +
'</div>' +
'<div class="modal-foot">' +
  '<button class="btn-ghost js-fix-back">' + AC.icon('arrowleft', 'w-3.5 h-3.5') + ' Back</button>' +
  '<span class="grow"></span>' +
  '<button class="btn-ghost js-modal-close">Cancel</button>' +
  '<button class="btn-primary js-fix-apply">' + AC.icon('check', 'w-3.5 h-3.5') + ' Apply selected</button>' +
'</div>'
    );
  }

  /* ---- automatic ---- */
  if (FIX.mode === 'auto') {
    const body = FIX.nokey
      ? '<div class="card p-4 border-warning/30 bg-warning/5">' +
          '<div class="flex gap-3">' +
            '<span class="text-warning shrink-0 mt-0.5">' + AC.icon('key', 'w-4 h-4') + '</span>' +
            '<div><div class="t-label mb-1">No API key saved</div>' +
            '<p class="t-caption text-text-secondary mb-3">This path calls a provider directly, so it needs a key. ' +
            'You do not have to add one — the other tab lets Auto Clipper write the prompt so you can run it in a chat ' +
            'model you already use.</p>' +
            '<div class="flex gap-2">' +
              '<button class="btn-secondary btn-sm js-fix-mode" data-m="manual">' + AC.icon('copy', 'w-3.5 h-3.5') +
                ' Use a chat model instead</button>' +
              '<a href="settings.html?state=provider" class="btn-ghost btn-sm">Add a key</a>' +
            '</div></div>' +
          '</div>' +
        '</div>'
      : '<div class="card p-4">' +
          '<div class="flex items-center gap-2 mb-3">' +
            '<span class="text-success">' + AC.icon('check', 'w-4 h-4') + '</span>' +
            '<span class="t-label grow">OpenAI key found</span>' +
            '<span class="badge-neutral font-mono">gpt-4o-mini</span>' +
          '</div>' +
          '<p class="t-caption text-text-secondary mb-4">The word list is sent as text — no audio, no video. ' +
            'Roughly ' + words.length + ' words, so this costs a fraction of a cent.</p>' +
          (FIX.running
            ? '<div class="track track-indeterminate mb-2"></div>' +
              '<p class="t-caption text-text-secondary">Checking ' + words.length + ' words…</p>'
            : '<button class="btn-primary js-fix-run">' + AC.icon('wand', 'w-3.5 h-3.5') + ' Find mistakes</button>') +
        '</div>';

    return (
'<div class="modal-body">' + fixModeSwitch() + body + '</div>' +
'<div class="modal-foot">' +
  '<span class="grow"></span>' +
  '<button class="btn-secondary js-modal-close">Close</button>' +
'</div>'
    );
  }

  /* ---- manual: step 1, copy the prompt ---- */
  if (FIX.step === 1) {
    return (
'<div class="modal-body">' + fixModeSwitch() +
  '<div class="card p-4 mb-3">' +
    '<div class="flex items-center gap-2 mb-2.5">' +
      '<span class="w-5 h-5 rounded-full bg-accent text-white grid place-items-center t-caption font-semibold shrink-0">1</span>' +
      '<span class="t-label grow">Copy the prompt Auto Clipper wrote</span>' +
      '<span class="badge-neutral">' + words.length + ' words</span>' +
      '<button class="btn-primary btn-sm js-fix-copy">' + AC.icon('copy', 'w-3.5 h-3.5') + ' Copy</button>' +
    '</div>' +
    '<pre class="panel p-3 max-h-[210px] overflow-auto font-mono text-[11px] leading-relaxed ' +
      'text-text-secondary whitespace-pre-wrap select-all">' +
      AC.subtitleFixPrompt(words).replace(/</g, '&lt;') + '</pre>' +
  '</div>' +
  '<div class="card p-4">' +
    '<div class="flex items-center gap-2 mb-2.5">' +
      '<span class="w-5 h-5 rounded-full border-2 border-accent text-accent grid place-items-center t-caption font-semibold shrink-0">2</span>' +
      '<span class="t-label grow">Run it anywhere</span>' +
    '</div>' +
    '<div class="grid grid-cols-3 gap-2">' +
      ['ChatGPT', 'Gemini', 'Claude'].map(function (m) {
        return '<button class="btn-secondary btn-sm js-todo justify-between">' + m +
          '<span class="text-text-tertiary">' + AC.icon('external', 'w-3.5 h-3.5') + '</span></button>';
      }).join('') +
    '</div>' +
    '<p class="field-hint">Opens in your browser with the prompt already on your clipboard. ' +
      'The free tier of any of these is enough.</p>' +
  '</div>' +
'</div>' +
'<div class="modal-foot">' +
  '<button class="btn-ghost js-modal-close">Cancel</button>' +
  '<span class="grow"></span>' +
  '<button class="btn-primary js-fix-next">I have the answer ' + AC.icon('arrowright', 'w-3.5 h-3.5') + '</button>' +
'</div>'
    );
  }

  /* ---- manual: step 2, paste it back ---- */
  return (
'<div class="modal-body">' + fixModeSwitch() +
  '<div class="card p-4">' +
    '<div class="flex items-center gap-2 mb-2.5">' +
      '<span class="w-5 h-5 rounded-full bg-accent text-white grid place-items-center t-caption font-semibold shrink-0">3</span>' +
      '<span class="t-label grow">Paste what the model gave you</span>' +
      '<button class="btn-ghost btn-sm js-fix-sample">Use a sample</button>' +
    '</div>' +
    '<textarea id="fixPaste" class="textarea font-mono text-[11.5px] h-[200px]' +
      (FIX.invalid ? ' input-invalid' : '') + '" ' +
      'placeholder=\'[{"word": "business", "start": 3.3, "end": 3.6}, …]\'>' + FIX.paste + '</textarea>' +
    (FIX.invalid
      ? '<div class="panel p-3 mt-3 border-error/30 bg-error/5">' +
          '<div class="flex gap-2.5">' +
            '<span class="text-error shrink-0 mt-0.5">' + AC.icon('alert', 'w-4 h-4') + '</span>' +
            '<div><div class="t-label mb-1.5">That is not usable yet</div>' +
              '<ul class="t-caption text-text-secondary space-y-1">' +
                '<li>· It must be a JSON array of <span class="text-text-primary">' + words.length +
                  '</span> items — one per word, same order.</li>' +
                '<li>· Every item needs <span class="text-text-primary">word</span>, ' +
                  '<span class="text-text-primary">start</span> and <span class="text-text-primary">end</span>.</li>' +
                '<li>· Code fences and any text around the JSON are fine — those get stripped.</li>' +
              '</ul>' +
              '<button class="link t-caption mt-2 js-fix-sample">Show me a valid example</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      : '<div class="flex items-center gap-2 mt-3 t-caption text-text-tertiary">' +
          AC.icon('info', 'w-3.5 h-3.5') +
          'Nothing is written to the transcript yet — you review every change first.</div>') +
  '</div>' +
'</div>' +
'<div class="modal-foot">' +
  '<button class="btn-secondary js-fix-back">' + AC.icon('arrowleft', 'w-3.5 h-3.5') + ' Back</button>' +
  '<span class="grow"></span>' +
  '<button class="btn-primary js-fix-validate">Review changes ' + AC.icon('arrowright', 'w-3.5 h-3.5') + '</button>' +
'</div>'
  );
}

function fixHead() {
  return AC.modalHead(
    'Fix transcript mistakes',
    FIX.step === 'review'
      ? 'Review before anything changes'
      : 'Two ways to do it. Neither rewrites your words — only misspellings get touched.'
  );
}

function repaintFix() { $('.js-modal-backdrop .modal').html(fixHead() + fixBody()); }

function openFix(opts) {
  opts = opts || {};
  FIX.mode = opts.mode || 'auto';
  FIX.step = opts.step || 1;
  FIX.invalid = !!opts.invalid;
  FIX.nokey = !!opts.nokey;
  FIX.running = false;
  FIX.paste = opts.paste || '';
  FIX.skipped = {};
  AC.openModal(fixHead() + fixBody(), 'max-w-[640px]');
}

$(function () {
  $(document).on('click', '.js-fix-mode', function () {
    FIX.mode = $(this).data('m');
    FIX.step = 1;
    FIX.invalid = false;
    repaintFix();
  });

  $(document).on('click', '.js-fix-run', function () {
    FIX.running = true; repaintFix();
    setTimeout(function () { FIX.running = false; FIX.step = 'review'; repaintFix(); }, 1100);
  });

  $(document).on('click', '.js-fix-copy', function () {
    const $b = $(this);
    $b.html(AC.icon('check', 'w-3.5 h-3.5') + ' Copied');
    AC.toast('Prompt copied — paste it into any chat model', 'success');
    setTimeout(function () { $b.html(AC.icon('copy', 'w-3.5 h-3.5') + ' Copy'); }, 2000);
  });

  $(document).on('click', '.js-fix-next', function () { FIX.step = 2; repaintFix(); });

  $(document).on('input', '#fixPaste', function () { FIX.paste = this.value; });

  $(document).on('click', '.js-fix-sample', function () {
    FIX.paste = AC.subtitleFixSample(words);
    FIX.invalid = false;
    FIX.step = 2;
    repaintFix();
  });

  $(document).on('click', '.js-fix-validate', function () {
    const raw = (FIX.paste || '').replace(/```(json)?/g, '').trim();
    let ok = false;
    try { const a = JSON.parse(raw); ok = Array.isArray(a) && a.length === words.length && typeof a[0].word === 'string'; }
    catch (e) { ok = false; }
    if (!ok) { FIX.invalid = true; repaintFix(); return; }
    FIX.invalid = false; FIX.step = 'review'; repaintFix();
  });

  $(document).on('click', '.js-fix-back', function () {
    if (FIX.step === 'review') FIX.step = FIX.mode === 'auto' ? 1 : 2;
    else FIX.step = 1;
    repaintFix();
  });

  $(document).on('click', '.js-fix-skip', function () {
    const i = $(this).data('i');
    FIX.skipped[i] = !FIX.skipped[i];
    repaintFix();
  });

  $(document).on('click', '.js-fix-seek', function () {
    S.t = +$(this).data('t'); paint();
  });

  $(document).on('click', '.js-fix-apply', function () {
    const diffs = AC.fixDiffs().filter(function (d) { return !FIX.skipped[d.i]; });
    diffs.forEach(function (d) {
      $('.js-word[data-i="' + d.i + '"]').val(d.to).addClass('!border-warning bg-warning/5');
      S.changed[d.i] = true;
    });
    AC.closeModal();
    markDirty();
    AC.toast(diffs.length
      ? diffs.length + ' word' + (diffs.length > 1 ? 's' : '') + ' corrected — re-render to bake it in'
      : 'No changes applied', diffs.length ? 'success' : undefined);
  });

  /* The state switcher can drop you straight into any step. */
  if (FIX_STATES.indexOf(state) >= 0) {
    const map = {
      fixauto:    { mode: 'auto' },
      fixnokey:   { mode: 'auto', nokey: true },
      fixmanual:  { mode: 'manual', step: 1 },
      fixpaste:   { mode: 'manual', step: 2 },
      fixinvalid: { mode: 'manual', step: 2, invalid: true,
                    paste: '[\n  {"word": "business", "start": "00:03"},\n  {"word": "tuition"}\n]' },
      fixreview:  { mode: 'auto', step: 'review' },
    };
    setTimeout(function () { openFix(map[state]); }, 120);
  }
});
