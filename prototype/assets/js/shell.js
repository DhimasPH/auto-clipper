/* =============================================================================
   SHELL — chrome shared by every screen
   -----------------------------------------------------------------------------
   Rendered from JS templates rather than fetched partials on purpose: the
   prototype must open by double-clicking an .html file (file://), where
   fetch/XHR for local partials is blocked by the browser.
============================================================================= */

window.AC = window.AC || {};

/* ---------------------------------------------------------------- icons ---
   Lucide paths, inlined. Same icon language as the real app (lucide-react).
--------------------------------------------------------------------------- */
AC.ICONS = {
  scissors:  '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
  folder:    '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  plus:      '<path d="M5 12h14"/><path d="M12 5v14"/>',
  settings:  '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  help:      '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  clock:     '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  download:  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
  mic:       '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  sparkles:  '<path d="M9.94 14.06 12 20l2.06-5.94L20 12l-5.94-2.06L12 4l-2.06 5.94L4 12z"/><path d="M18 4v4"/><path d="M20 6h-4"/>',
  film:      '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M17 3v18"/><path d="M3 12h18"/><path d="M3 7.5h4"/><path d="M3 16.5h4"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>',
  check:     '<path d="M20 6 9 17l-5-5"/>',
  alert:     '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
  ban:       '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  hand:      '<path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
  x:         '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  chevleft:  '<path d="m15 18-6-6 6-6"/>',
  chevright: '<path d="m9 18 6-6-6-6"/>',
  chevdown:  '<path d="m6 9 6 6 6-6"/>',
  search:    '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  trash:     '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  refresh:   '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  play:      '<path d="m6 3 14 9-14 9Z"/>',
  pause:     '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  pencil:    '<path d="M21.17 6.83 17.17 2.83a2.83 2.83 0 0 0-4 0L3 13v4h4L21.17 2.83"/><path d="M15 5l4 4"/>',
  copy:      '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16V4a2 2 0 0 1 2-2h10"/>',
  link:      '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  upload:    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  terminal:  '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
  eye:       '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  type:      '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
  palette:   '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2a10 10 0 0 0 0 20 2.5 2.5 0 0 0 1.77-4.27 2.5 2.5 0 0 1 1.77-4.27H18a4 4 0 0 0 4-4 10 10 0 0 0-10-8Z"/>',
  layers:    '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m6.08 11-3.5 1.6a1 1 0 0 0 0 1.81l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9a1 1 0 0 0 0-1.83L17.9 11"/>',
  cpu:       '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>',
  key:       '<path d="m15.5 7.5 3 3L22 7l-3-3"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
  moon:      '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun:       '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  external:  '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  move:      '<path d="M5 9l-3 3 3 3"/><path d="M9 5l3-3 3 3"/><path d="M15 19l-3 3-3-3"/><path d="M19 9l3 3-3 3"/><path d="M2 12h20"/><path d="M12 2v20"/>',
  wand:      '<path d="m3 21 9-9"/><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h.01"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/>',
  list:      '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  grid:      '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  folderopen:'<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
  info:      '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  globe:     '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  arrowright:'<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  arrowleft: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  zap:       '<path d="M4 14h7l-2 8 9-12h-7l2-8Z"/>',
  filter:    '<path d="M3 4h18l-7 8v6l-4 2v-8Z"/>',
};

AC.icon = function (name, cls) {
  const p = AC.ICONS[name] || AC.ICONS.info;
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round" class="' + (cls || 'w-4 h-4') +
    '" aria-hidden="true">' + p + '</svg>'
  );
};

/* ----------------------------------------------------------------- theme --- */
AC.getTheme = function () {
  try { return localStorage.getItem('acp_theme') || 'dark'; } catch (e) { return 'dark'; }
};
AC.setTheme = function (t) {
  try { localStorage.setItem('acp_theme', t); } catch (e) {}
  document.documentElement.setAttribute('data-theme', t);
  $('.js-theme-icon').html(AC.icon(t === 'dark' ? 'sun' : 'moon', 'w-4 h-4'));
};
AC.applyThemeEarly = function () {
  let t = 'dark';
  try { t = localStorage.getItem('acp_theme') || 'dark'; } catch (e) {}
  document.documentElement.setAttribute('data-theme', t);
};

/* ------------------------------------------------------------------- url --- */
AC.qs = function (key, fallback) {
  const m = new RegExp('[?&]' + key + '=([^&#]*)').exec(window.location.search);
  return m ? decodeURIComponent(m[1]) : (fallback === undefined ? null : fallback);
};
AC.setQs = function (key, val) {
  const u = new URL(window.location.href);
  u.searchParams.set(key, val);
  window.location.href = u.toString();
};

/* --------------------------------------------------------------- sidebar --- */
AC.NAV = [
  { id: 'projects', label: 'Projects', icon: 'folder',   href: 'projects.html' },
  { id: 'new',      label: 'New Project', icon: 'plus',  href: 'new-project.html' },
];
AC.NAV_FOOT = [
  { id: 'settings', label: 'Settings',  icon: 'settings', href: 'settings.html' },
  { id: 'help',     label: 'Help & FAQ', icon: 'help',    href: 'help.html' },
];

AC.sidebarCollapsed = function () {
  try { return localStorage.getItem('acp_nav') === '1'; } catch (e) { return false; }
};
AC.setSidebarCollapsed = function (v) {
  try { localStorage.setItem('acp_nav', v ? '1' : '0'); } catch (e) {}
};

AC.renderSidebar = function (active) {
  const col = AC.sidebarCollapsed();

  const item = function (n) {
    return (
      '<a href="' + n.href + '" class="nav-item" title="' + n.label + '" ' +
      (active === n.id ? 'aria-current="page"' : '') + '>' +
      AC.icon(n.icon, 'w-[18px] h-[18px] shrink-0') +
      '<span class="js-nav-text truncate' + (col ? ' hidden' : '') + '">' + n.label + '</span></a>'
    );
  };

  return (
'<aside id="sidebar-inner" class="' + (col ? 'w-[60px]' : 'w-[228px]') + ' shrink-0 h-screen sticky top-0 ' +
       'bg-bg-secondary border-r border-border flex flex-col transition-[width] duration-200">' +

  '<div class="h-14 px-3 flex items-center gap-2.5 border-b border-border shrink-0">' +
    '<img src="assets/img/logo.png" alt="" class="w-8 h-8 rounded-[7px] shrink-0"/>' +
    '<div class="min-w-0 js-nav-text' + (col ? ' hidden' : '') + '">' +
      '<div class="t-card leading-none text-text-primary">Auto Clipper</div>' +
      '<div class="t-caption text-text-tertiary leading-none mt-1">v1.8.0</div>' +
    '</div>' +
  '</div>' +

  '<nav class="py-3 grow overflow-y-auto no-scrollbar">' +
    '<div class="t-overline text-text-tertiary px-5 mb-2 js-nav-text' + (col ? ' hidden' : '') + '">Workspace</div>' +
    AC.NAV.map(item).join('') +
  '</nav>' +

  '<div class="shrink-0 border-t border-border py-3">' +
    AC.NAV_FOOT.map(item).join('') +
    '<div class="mx-3 mt-3 pt-3 border-t border-border flex items-center gap-1.5">' +
      '<button class="btn-ghost btn-icon btn-sm js-nav-toggle" title="' +
        (col ? 'Expand sidebar' : 'Collapse sidebar') + '" aria-label="Toggle sidebar">' +
        AC.icon(col ? 'chevright' : 'chevleft', 'w-4 h-4') + '</button>' +
      '<button class="btn-ghost btn-icon btn-sm js-theme" title="Toggle theme" aria-label="Toggle theme">' +
        '<span class="js-theme-icon"></span></button>' +
    '</div>' +
  '</div>' +
'</aside>'
  );
};

/* ------------------------------------------------------------- top header ---
   Contextual, translucent, and carries the two things that were previously
   buried: where you are (breadcrumbs) and whether the engine is alive.
--------------------------------------------------------------------------- */
AC.renderTopbar = function (crumbs) {
  crumbs = crumbs || [];
  return (
'<header class="sticky top-0 z-30 h-12 px-6 flex items-center gap-2 border-b border-border ' +
       'bg-bg-primary/80 backdrop-blur-md">' +
  '<nav class="flex items-center gap-1.5 min-w-0" aria-label="Breadcrumb">' +
    crumbs.map(function (c, i) {
      const last = i === crumbs.length - 1;
      return (
        (i ? '<span class="text-text-tertiary shrink-0">' + AC.icon('chevright', 'w-3.5 h-3.5') + '</span>' : '') +
        (last || !c.href
          ? '<span class="t-label truncate ' + (last ? '' : 'text-text-secondary') + '">' + c.label + '</span>'
          : '<a href="' + c.href + '" class="t-label text-text-secondary hover:text-text-primary transition-colors truncate">' +
            c.label + '</a>')
      );
    }).join('') +
  '</nav>' +
  '<span class="grow"></span>' +
  '<span class="flex items-center gap-2 t-caption text-text-secondary">' +
    '<span class="dot bg-success"></span>Engine ready</span>' +
'</header>'
  );
};

/* -------------------------------------------------------------- job dock ---
   The missing "something is running" affordance. Persistent across screens.
--------------------------------------------------------------------------- */
AC.dockCollapsed = function () {
  try { return localStorage.getItem('acp_dock') === '1'; } catch (e) { return false; }
};

AC.renderJobDock = function () {
  const q = AC.QUEUE;
  const running = q.filter(function (j) { return j.status !== 'QUEUED'; });
  const collapsed = AC.dockCollapsed();

  const row = function (j) {
    const isQueued = j.status === 'QUEUED';
    return (
'<div class="flex items-center gap-3 px-4 py-2.5 border-t border-border first:border-t-0">' +
  '<span class="dot ' + (isQueued ? 'bg-text-tertiary' : 'bg-info animate-pulse-soft') + '"></span>' +
  '<div class="min-w-0 w-[210px]">' +
    '<div class="t-label truncate">' + j.title + '</div>' +
    '<div class="t-caption text-text-tertiary truncate">' + j.detail + '</div>' +
  '</div>' +
  '<div class="grow min-w-[120px]">' +
    (isQueued
      ? '<div class="track"></div>'
      : '<div class="track"><div class="track-fill" style="width:' + j.pct + '%"></div></div>') +
  '</div>' +
  '<div class="t-caption text-text-secondary w-[168px] text-right shrink-0 truncate">' + j.eta + '</div>' +
  '<a href="project.html?id=' + j.id + '&state=' + (isQueued ? 'queued' : 'rendering') + '" class="btn-ghost btn-sm">Open</a>' +
  '<button class="btn-ghost btn-icon btn-sm js-toast" data-msg="Cancel requested — the renderer stops after the current frame" title="Cancel job">' +
    AC.icon('x') + '</button>' +
'</div>'
    );
  };

  return (
'<div id="jobdock" style="left:' + (AC.sidebarCollapsed() ? '60px' : '228px') + '" ' +
     'class="fixed bottom-0 right-0 z-40 bg-bg-elevated/95 backdrop-blur border-t border-border shadow-dock">' +
  '<button class="w-full h-11 px-4 flex items-center gap-3 hover:bg-bg-surface/50 transition-colors js-dock-toggle">' +
    AC.icon('layers', 'w-4 h-4 text-accent shrink-0') +
    '<span class="t-label">Job queue</span>' +
    '<span class="badge-accent">' + q.length + ' active</span>' +
    (running.length
      ? '<span class="t-caption text-text-secondary hidden md:inline truncate">' +
          running[0].title + ' · ' + running[0].detail + '</span>'
      : '') +
    '<span class="grow"></span>' +
    '<span class="t-caption text-text-tertiary">' + (collapsed ? 'Show' : 'Hide') + '</span>' +
    '<span class="js-dock-chev transition-transform ' + (collapsed ? '' : 'rotate-180') + '">' +
      AC.icon('chevdown', 'w-4 h-4 text-text-tertiary') + '</span>' +
  '</button>' +
  '<div class="js-dock-body ' + (collapsed ? 'hidden' : '') + '">' + q.map(row).join('') + '</div>' +
'</div>'
  );
};

/* ------------------------------------------------------------ state bar ---
   Because the prototype is static, every screen state is reachable from here
   instead of by waiting. Dev-facing on purpose.
--------------------------------------------------------------------------- */
AC.renderStateBar = function (states, current) {
  if (!states || !states.length) return '';
  const opts = states
    .map(function (s) {
      return '<option value="' + s.id + '"' + (s.id === current ? ' selected' : '') + '>' + s.label + '</option>';
    })
    .join('');
  // Top-centre: the one strip of every screen that is reliably empty. Bottom
  // corners collide with the job dock, the studio timeline and the side panel.
  return (
'<div id="statebar" class="fixed z-[70] top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-2 h-8 pl-2.5 pr-1 ' +
     'rounded-full bg-bg-elevated/95 backdrop-blur border border-accent/40 shadow-dropdown">' +
  '<span class="t-overline text-accent whitespace-nowrap">Prototype state</span>' +
  '<div class="select-wrap">' +
    '<select class="select !h-6 !py-0 !pl-2 !pr-6 t-caption js-state">' + opts + '</select>' +
  '</div>' +
'</div>'
  );
};

/* ----------------------------------------------------------------- toast --- */
AC.toast = function (msg, kind) {
  const tone =
    kind === 'error' ? 'border-error/40 text-error' :
    kind === 'success' ? 'border-success/40 text-success' :
    'border-border text-text-primary';
  const $t = $(
    '<div class="pointer-events-auto card px-4 py-3 shadow-toast ' + tone +
    ' t-label max-w-[380px] animate-slide-up">' + msg + '</div>'
  );
  $('#toasts').append($t);
  setTimeout(function () {
    $t.css({ transition: 'opacity .25s, transform .25s', opacity: 0, transform: 'translateY(6px)' });
    setTimeout(function () { $t.remove(); }, 260);
  }, 2600);
};

/* ----------------------------------------------------------------- modal --- */
AC.openModal = function (html, widthCls) {
  const $b = $(
    '<div class="modal-backdrop js-modal-backdrop">' +
      '<div class="modal ' + (widthCls || 'max-w-lg') + '">' + html + '</div>' +
    '</div>'
  );
  $('body').append($b).css('overflow', 'hidden');
  $b.on('click', function (e) { if (e.target === this) AC.closeModal(); });
  $(document).on('keydown.modal', function (e) { if (e.key === 'Escape') AC.closeModal(); });
  $b.find('.js-modal-close').on('click', AC.closeModal);
  return $b;
};
AC.closeModal = function () {
  $('.js-modal-backdrop').remove();
  $('body').css('overflow', '');
  $(document).off('keydown.modal');
};
AC.modalHead = function (title, sub) {
  return (
'<div class="modal-head">' +
  '<div class="min-w-0"><h2 class="t-section truncate">' + title + '</h2>' +
    (sub ? '<p class="t-caption text-text-secondary mt-0.5">' + sub + '</p>' : '') +
  '</div>' +
  '<button class="btn-ghost btn-icon btn-sm js-modal-close" aria-label="Close">' + AC.icon('x') + '</button>' +
'</div>'
  );
};

/* ---------------------------------------------------------------- badges --- */
AC.statusBadge = function (status) {
  const m = AC.STATUS_META[status] || AC.STATUS_META.QUEUED;
  const live = ['DOWNLOADING', 'TRANSCRIBING', 'ANALYZING', 'RENDERING'].indexOf(status) >= 0;
  return (
    '<span class="badge-' + m.tone + '">' +
      (live ? '<span class="dot bg-current animate-pulse-soft"></span>' : AC.icon(m.icon, 'w-3 h-3')) +
      m.label +
    '</span>'
  );
};

AC.modeBadge = function (mode) {
  const m = AC.MODES.filter(function (x) { return x.id === mode; })[0];
  if (!m) return '';
  return '<span class="badge-neutral">' + AC.icon(m.icon, 'w-3 h-3') + m.label + '</span>';
};

/* ------------------------------------------------------------ page setup --- */
AC.boot = function (opts) {
  opts = opts || {};
  $('#sidebar').html(AC.renderSidebar(opts.nav));
  if (opts.crumbs) $('main').prepend(AC.renderTopbar(opts.crumbs));
  if (opts.dock !== false) $('body').append(AC.renderJobDock());
  if (opts.states) $('body').append(AC.renderStateBar(opts.states, opts.state));
  $('body').append('<div id="toasts" class="fixed z-[90] top-4 right-4 flex flex-col gap-2 pointer-events-none"></div>');

  AC.setTheme(AC.getTheme());

  $(document).on('click', '.js-theme', function () {
    AC.setTheme(AC.getTheme() === 'dark' ? 'light' : 'dark');
  });

  $(document).on('click', '.js-nav-toggle', function () {
    AC.setSidebarCollapsed(!AC.sidebarCollapsed());
    $('#sidebar').html(AC.renderSidebar(opts.nav));
    AC.setTheme(AC.getTheme());
    $('#jobdock').css('left', AC.sidebarCollapsed() ? '60px' : '228px');
  });

  $(document).on('click', '.js-dock-toggle', function () {
    const $body = $('.js-dock-body');
    $body.toggleClass('hidden');
    const hidden = $body.hasClass('hidden');
    $('.js-dock-chev').toggleClass('rotate-180', !hidden);
    try { localStorage.setItem('acp_dock', hidden ? '1' : '0'); } catch (e) {}
  });

  $(document).on('change', '.js-state', function () {
    AC.setQs('state', $(this).val());
  });

  $(document).on('click', '.js-toast', function () {
    AC.toast($(this).data('msg') || 'Prototype — no backend attached', $(this).data('kind'));
  });

  // Anything not wired yet says so honestly instead of failing silently.
  $(document).on('click', '.js-todo', function (e) {
    e.preventDefault();
    AC.toast('Static prototype — this action has no backend behind it');
  });

  // Toggles
  $(document).on('click', '.toggle', function () {
    const on = $(this).attr('aria-checked') === 'true';
    $(this).attr('aria-checked', on ? 'false' : 'true').trigger('ac:toggle', [!on]);
  });

  // Segmented controls
  $(document).on('click', '.segmented-item', function () {
    const $g = $(this).closest('.segmented');
    $g.find('.segmented-item').attr('aria-selected', 'false');
    $(this).attr('aria-selected', 'true');
    $g.trigger('ac:segment', [$(this).data('val')]);
  });
};

/* ------------------------------------------------------------- fragments --- */
AC.pageHead = function (title, sub, right) {
  return (
'<div class="flex items-start justify-between gap-4 mb-6">' +
  '<div class="min-w-0">' +
    '<h1 class="t-page">' + title + '</h1>' +
    (sub ? '<p class="t-body text-text-secondary mt-1">' + sub + '</p>' : '') +
  '</div>' +
  '<div class="flex items-center gap-2 shrink-0">' + (right || '') + '</div>' +
'</div>'
  );
};

/* Aspect ratio preview rectangle */
AC.ratioBox = function (w, h, cls) {
  const max = 26;
  const scale = max / Math.max(w, h);
  return (
    '<span class="' + (cls || 'border-2 border-current rounded-[3px] block') + '" style="width:' +
    (w * scale).toFixed(1) + 'px;height:' + (h * scale).toFixed(1) + 'px"></span>'
  );
};

AC.fmtDur = function (s) {
  const m = Math.floor(s / 60), r = s % 60;
  return m ? m + 'm ' + r + 's' : r + 's';
};
