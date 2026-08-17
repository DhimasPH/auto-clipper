/* =============================================================================
   SHARED CONTROLS — subtitle & canvas
   -----------------------------------------------------------------------------
   Mirrors src/components/ui/SubtitleConfigControls.tsx and
   CanvasConfigControls.tsx so New Project and the Studio drive the same fields
   instead of each screen inventing its own subset (which is how the current
   build ended up with 4 different aspect-ratio pickers).

   Two gaps in the current build are closed here, deliberately:
     · outline_color and shadow_color exist in SubtitleConfig and are applied to
       the live preview, but have NO control anywhere — they can only be changed
       by picking a preset. Controls added.
     · the 16:9 mode switch (Normal Landscape vs Convert to 9:16 Canvas) only
       appeared inside CanvasConfigControls; here it is surfaced right under the
       ratio picker, where the decision is actually made.
============================================================================= */

window.AC = window.AC || {};

/* ------------------------------------------------------------------ helpers */
function seg(items, sel, cls) {
  return items.map(function (it) {
    const on = it.v === sel;
    return '<button class="' + cls + ' rounded-input border px-2 h-9 t-label transition-all ' +
      (on ? 'border-accent bg-accent-muted text-accent' : 'border-border text-text-secondary hover:border-border-active') +
      '" data-v="' + it.v + '">' + it.l + '</button>';
  }).join('');
}

function slider(id, label, val, min, max, step, unit) {
  return (
'<div>' +
  '<div class="flex items-center gap-2 mb-1.5">' +
    '<span class="t-label grow">' + label + '</span>' +
    '<span class="t-caption font-mono text-accent" id="' + id + 'Lbl">' + val + unit + '</span>' +
  '</div>' +
  '<input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val +
    '" class="w-full accent-[var(--accent)]"/>' +
'</div>'
  );
}

function colorField(id, label, val, swatches) {
  return (
'<div>' +
  '<div class="t-label mb-1.5">' + label + '</div>' +
  '<div class="flex items-center gap-2 flex-wrap">' +
    '<input type="color" value="' + val + '" id="' + id + 'Pick" ' +
      'class="w-8 h-8 rounded border border-border bg-transparent cursor-pointer p-0 shrink-0"/>' +
    '<input type="text" value="' + val + '" id="' + id + 'Hex" ' +
      'class="input h-8 w-[92px] font-mono text-[12px] uppercase shrink-0"/>' +
    (swatches
      ? '<span class="w-px h-6 bg-border mx-0.5"></span>' +
        swatches.map(function (s) {
          return '<button class="js-sw-' + id + ' w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ' +
            (s.value.toUpperCase() === val.toUpperCase() ? 'border-accent' : 'border-border') +
            '" style="background:' + s.value + '" data-c="' + s.value + '" title="' + s.label + '"></button>';
        }).join('')
      : '') +
  '</div>' +
'</div>'
  );
}

/* =============================================================================
   SUBTITLE CONTROLS
   opts: { cfg, compact }  — compact drops the built-in preview (the Studio has
   a live one on the video stage already).
============================================================================= */
AC.subtitleControls = function (cfg, opts) {
  opts = opts || {};
  const c = cfg;

  const presets =
'<div>' +
  '<div class="t-label mb-2">Quick presets</div>' +
  '<div class="grid grid-cols-3 gap-2">' +
    AC.SUBTITLE_PRESETS.map(function (p) {
      const on = p.style === c.style;
      return '<button class="js-sub-preset rounded-input border p-2.5 text-left transition-all ' +
        (on ? 'border-accent bg-accent-muted' : 'border-border hover:border-border-active') +
        '" data-p="' + p.id + '">' +
        '<span class="t-label block">' + p.label + '</span>' +
        '<span class="t-caption text-text-tertiary">' + p.desc + '</span></button>';
    }).join('') +
  '</div>' +
'</div>';

  const styleCards =
'<div>' +
  '<div class="t-label mb-2">Caption mode</div>' +
  '<div class="space-y-1.5">' +
    AC.SUBTITLE_STYLES.map(function (s) {
      const on = s.id === c.style;
      return '<button class="js-sub-style w-full rounded-input border p-2.5 flex items-start gap-2.5 text-left transition-all ' +
        (on ? 'border-accent bg-accent-muted' : 'border-border hover:border-border-active') +
        '" data-v="' + s.id + '">' +
        '<span class="' + (on ? 'text-accent' : 'text-text-tertiary') + ' shrink-0 mt-0.5">' + AC.icon(s.icon) + '</span>' +
        '<span class="grow min-w-0"><span class="t-label block">' + s.title + '</span>' +
        '<span class="t-caption text-text-tertiary">' + s.desc + '</span></span>' +
        (on ? '<span class="text-accent shrink-0">' + AC.icon('check', 'w-4 h-4') + '</span>' : '') +
        '</button>';
    }).join('') +
  '</div>' +
'</div>';

  const fonts =
'<div>' +
  '<div class="t-label mb-2">Font family</div>' +
  '<div class="grid grid-cols-3 gap-1.5">' +
    AC.FONT_PRESETS.map(function (f) {
      const on = f.value === c.font_family;
      return '<button class="js-sub-font rounded-input border px-2 h-9 t-label truncate transition-all ' +
        (on ? 'border-accent bg-accent-muted text-accent' : 'border-border text-text-secondary hover:border-border-active') +
        '" style="font-family:\'' + f.value + '\',sans-serif" data-v="' + f.value + '" title="' + f.label + '">' +
        f.label.split(' ')[0] + '</button>';
    }).join('') +
  '</div>' +
'</div>';

  const sizeWeight =
'<div class="grid grid-cols-2 gap-4">' +
  '<div>' +
    '<div class="flex items-center gap-2 mb-1.5">' +
      '<span class="t-label grow">Font size</span>' +
      '<span class="t-caption font-mono text-accent" id="subSizeLbl">' + c.font_size_scale + '×</span>' +
    '</div>' +
    '<div class="grid grid-cols-4 gap-1" id="subSize">' +
      seg(AC.FONT_SIZE_STEPS.map(function (s) { return { v: s, l: s + '×' }; }), c.font_size_scale, 'js-sub-size') +
    '</div>' +
  '</div>' +
  '<div>' +
    '<div class="t-label mb-1.5">Font weight</div>' +
    '<div class="grid grid-cols-2 gap-1" id="subWeight">' +
      seg([{ v: 'normal', l: 'Normal' }, { v: 'bold', l: 'Bold' }], c.font_weight, 'js-sub-weight') +
    '</div>' +
  '</div>' +
'</div>';

  const effects =
'<div class="space-y-4">' +
  '<div class="t-overline text-text-tertiary">Visual effects</div>' +
  slider('subOutline', 'Outline width', c.outline_width, 0, 5, 1, 'px') +
  slider('subShadow', 'Shadow depth', c.shadow_depth, 0, 10, 1, 'px') +
  '<div class="grid grid-cols-3 gap-1.5">' +
    [
      { k: 'animation_pop', l: 'Pop animation', i: 'zap',  on: c.animation_pop },
      { k: 'uppercase',     l: 'UPPERCASE',     i: 'type', on: c.uppercase },
      { k: 'italic',        l: 'Italic',        i: 'type', on: c.italic },
    ].map(function (t) {
      return '<button class="js-sub-flag rounded-input border p-2 flex flex-col items-center gap-1 transition-all ' +
        (t.on ? 'border-accent bg-accent-muted text-accent' : 'border-border text-text-secondary hover:border-border-active') +
        '" data-k="' + t.k + '" aria-pressed="' + t.on + '">' +
        AC.icon(t.i, 'w-3.5 h-3.5') + '<span class="t-caption">' + t.l + '</span></button>';
    }).join('') +
  '</div>' +
'</div>';

  /* outline_color and shadow_color have no UI in the current build — added. */
  const colors =
'<div class="space-y-3.5">' +
  '<div class="t-overline text-text-tertiary">Colours</div>' +
  colorField('subText', 'Text colour', c.text_color, null) +
  colorField('subHi', 'Highlight colour', c.highlight_color, AC.HIGHLIGHT_SWATCHES) +
  '<div class="grid grid-cols-2 gap-3">' +
    colorField('subOut', 'Outline', c.outline_color, null) +
    colorField('subSha', 'Shadow', c.shadow_color, null) +
  '</div>' +
  '<p class="t-caption text-text-tertiary">Outline and shadow colours had no control in the current build — they could only ' +
  'change by picking a preset.</p>' +
'</div>';

  const watermark =
'<div class="space-y-3">' +
  '<div class="flex items-center gap-2">' +
    '<span class="text-text-tertiary">' + AC.icon('layers', 'w-3.5 h-3.5') + '</span>' +
    '<span class="t-overline text-text-tertiary grow">Watermark (source credit)</span>' +
  '</div>' +
  '<div>' +
    '<label class="t-caption text-text-tertiary">Text</label>' +
    '<input type="text" id="subWmText" class="input h-9 mt-1" value="' + (c.watermark_text || '') +
      '" placeholder="e.g. sc: youtube/raditya dika"/>' +
  '</div>' +
  slider('subWmOp', 'Opacity', Math.round((c.watermark_opacity || 0.5) * 100), 10, 100, 5, '%') +
  '<p class="t-caption text-text-tertiary">Rendered bottom-centre. Leave the text empty to turn it off.</p>' +
'</div>';

  return (
    (opts.compact ? '' : '<div id="subPreviewWrap"></div>') +
    '<div class="space-y-5">' +
      presets +
      '<div class="divider"></div>' +
      styleCards +
      '<div class="divider"></div>' +
      fonts +
      sizeWeight +
      '<div class="divider"></div>' +
      effects +
      '<div class="divider"></div>' +
      colors +
      '<div class="divider"></div>' +
      watermark +
    '</div>'
  );
};

/* Applies a preset the same way SubtitleConfigControls does: a partial merge,
   so watermark settings survive. */
AC.applySubtitlePreset = function (cfg, id) {
  const P = {
    classic:   { style: 'standard',    font_family: 'Arial',      font_weight: 'normal', uppercase: false, outline_width: 2, shadow_depth: 1, animation_pop: false },
    podcast:   { style: 'karaoke',     font_family: 'Montserrat', font_weight: 'bold',   uppercase: false, outline_width: 2, shadow_depth: 2, animation_pop: false },
    viral_pop: { style: 'single_word', font_family: 'Impact',     font_weight: 'bold',   uppercase: true,  outline_width: 3, shadow_depth: 5, animation_pop: true },
  }[id];
  const common = { text_color: '#FFFFFF', highlight_color: '#FFE600', outline_color: '#000000', shadow_color: '#000000' };
  return Object.assign(cfg, common, P);
};

/* Wires every subtitle control to `cfg`. `onChange` fires after each edit. */
AC.bindSubtitleControls = function (root, cfg, onChange) {
  const $r = $(root);
  const fire = function () { if (onChange) onChange(cfg); };
  const pick = function (sel, val, activeCls) {
    $r.find(sel).removeClass('border-accent bg-accent-muted text-accent')
      .addClass('border-border text-text-secondary');
    $r.find(sel + '[data-v="' + val + '"]').addClass(activeCls || 'border-accent bg-accent-muted text-accent')
      .removeClass('border-border text-text-secondary');
  };

  $r.on('click', '.js-sub-preset', function () {
    AC.applySubtitlePreset(cfg, $(this).data('p'));
    fire(); AC.rerenderSubtitleControls(root, cfg, onChange);
  });
  $r.on('click', '.js-sub-style', function () {
    cfg.style = $(this).data('v'); fire(); AC.rerenderSubtitleControls(root, cfg, onChange);
  });
  $r.on('click', '.js-sub-font', function () {
    cfg.font_family = $(this).data('v'); pick('.js-sub-font', cfg.font_family); fire();
  });
  $r.on('click', '.js-sub-size', function () {
    cfg.font_size_scale = parseFloat($(this).data('v'));
    pick('.js-sub-size', cfg.font_size_scale);
    $r.find('#subSizeLbl').text(cfg.font_size_scale + '×'); fire();
  });
  $r.on('click', '.js-sub-weight', function () {
    cfg.font_weight = $(this).data('v'); pick('.js-sub-weight', cfg.font_weight); fire();
  });
  $r.on('click', '.js-sub-flag', function () {
    const k = $(this).data('k');
    cfg[k] = !cfg[k];
    $(this).attr('aria-pressed', cfg[k])
      .toggleClass('border-accent bg-accent-muted text-accent', cfg[k])
      .toggleClass('border-border text-text-secondary', !cfg[k]);
    fire();
  });

  $r.on('input', '#subOutline', function () { cfg.outline_width = +this.value; $r.find('#subOutlineLbl').text(this.value + 'px'); fire(); });
  $r.on('input', '#subShadow',  function () { cfg.shadow_depth  = +this.value; $r.find('#subShadowLbl').text(this.value + 'px'); fire(); });
  $r.on('input', '#subWmOp',    function () { cfg.watermark_opacity = this.value / 100; $r.find('#subWmOpLbl').text(this.value + '%'); fire(); });
  $r.on('input', '#subWmText',  function () { cfg.watermark_text = this.value; fire(); });

  [['subText', 'text_color'], ['subHi', 'highlight_color'], ['subOut', 'outline_color'], ['subSha', 'shadow_color']]
    .forEach(function (pair) {
      const id = pair[0], key = pair[1];
      $r.on('input', '#' + id + 'Pick', function () {
        cfg[key] = this.value.toUpperCase(); $r.find('#' + id + 'Hex').val(cfg[key]); fire();
      });
      $r.on('input', '#' + id + 'Hex', function () {
        cfg[key] = this.value.toUpperCase();
        if (/^#[0-9A-F]{6}$/.test(cfg[key])) $r.find('#' + id + 'Pick').val(cfg[key]);
        fire();
      });
      $r.on('click', '.js-sw-' + id, function () {
        cfg[key] = $(this).data('c');
        $r.find('#' + id + 'Pick').val(cfg[key]);
        $r.find('#' + id + 'Hex').val(cfg[key]);
        $r.find('.js-sw-' + id).removeClass('border-accent').addClass('border-border');
        $(this).addClass('border-accent').removeClass('border-border');
        fire();
      });
    });
};

AC.rerenderSubtitleControls = function (root, cfg, onChange) {
  const $r = $(root);
  const compact = $r.data('compact') === true;
  $r.off().html(AC.subtitleControls(cfg, { compact: compact }));
  AC.bindSubtitleControls(root, cfg, onChange);
  if (onChange) onChange(cfg);
};

/* =============================================================================
   CANVAS CONTROLS
   The mode switch is the important part: two cards, exactly as
   CanvasConfigControls.tsx renders them when showModeSwitch is true.
============================================================================= */
AC.canvasModeSwitch = function (cfg, stack) {
  const card = function (on, icon, title, desc, val) {
    return (
'<button class="js-canvas-mode rounded-card border p-3.5 text-left flex gap-3 transition-all ' +
  (on ? 'border-accent bg-accent-muted ring-1 ring-accent/30' : 'border-border hover:border-border-active') +
  '" data-v="' + val + '">' +
  '<span class="' + (on ? 'text-accent' : 'text-text-tertiary') + ' shrink-0 mt-0.5">' + AC.icon(icon, 'w-[18px] h-[18px]') + '</span>' +
  '<span class="grow min-w-0">' +
    '<span class="t-label block mb-0.5">' + title + '</span>' +
    '<span class="t-caption text-text-secondary">' + desc + '</span>' +
  '</span>' +
  (on ? '<span class="text-accent shrink-0">' + AC.icon('check', 'w-4 h-4') + '</span>' : '') +
'</button>'
    );
  };

  return (
'<div>' +
  '<div class="t-label mb-2">Landscape output format</div>' +
  '<div class="grid ' + (stack ? 'grid-cols-1' : 'sm:grid-cols-2') + ' gap-2.5">' +
    card(!cfg.enabled, 'film', 'Normal Landscape (16:9)',
      'Stays a pure 16:9 horizontal video, no added background.', 'off') +
    card(cfg.enabled, 'layers', 'Convert to 9:16 Vertical (Canvas)',
      'Keeps the whole landscape frame centred on a vertical canvas with an aesthetic background.', 'on') +
  '</div>' +
'</div>'
  );
};

AC.canvasControls = function (cfg) {
  if (!cfg.enabled) {
    return (
'<div class="panel p-3.5 flex gap-2.5">' +
  '<span class="text-text-tertiary shrink-0 mt-0.5">' + AC.icon('info', 'w-4 h-4') + '</span>' +
  '<p class="t-caption text-text-secondary">Output stays 16:9. Switch to <span class="text-text-primary">Convert to 9:16 Vertical</span> ' +
  'above to choose a background.</p>' +
'</div>'
    );
  }

  const bg = cfg.background_type;

  return (
'<div class="panel p-4 space-y-4">' +

  '<div>' +
    '<div class="t-label mb-2">Background style</div>' +
    '<div class="grid grid-cols-3 gap-1.5" id="canvasBg">' +
      seg([{ v: 'blur', l: 'Blurred' }, { v: 'color', l: 'Solid colour' }, { v: 'image', l: 'Image' }], bg, 'js-canvas-bg') +
    '</div>' +
  '</div>' +

  (bg === 'blur'
    ? '<div><div class="t-label mb-2">Blur strength</div>' +
        '<div class="grid grid-cols-3 gap-1.5" id="canvasBlur">' +
          seg(AC.BLUR_LEVELS.map(function (b) { return { v: b.id, l: b.label }; }), cfg.blur_level, 'js-canvas-blur') +
        '</div></div>'
    : '') +

  (bg === 'color'
    ? '<div><div class="t-label mb-2">Background colour</div>' +
        '<div class="flex items-center gap-2 flex-wrap">' +
          AC.CANVAS_COLORS.map(function (s) {
            return '<button class="js-canvas-color w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ' +
              (s.value.toUpperCase() === (cfg.background_color || '').toUpperCase() ? 'border-accent' : 'border-border') +
              '" style="background:' + s.value + '" data-c="' + s.value + '" title="' + s.label + '"></button>';
          }).join('') +
          '<span class="w-px h-6 bg-border mx-0.5"></span>' +
          '<input type="color" id="canvasHexPick" value="' + (cfg.background_color || '#000000') +
            '" class="w-8 h-8 rounded border border-border bg-transparent cursor-pointer p-0"/>' +
          '<input type="text" id="canvasHex" value="' + (cfg.background_color || '#000000') +
            '" class="input h-8 w-[92px] font-mono text-[12px] uppercase" placeholder="#000000"/>' +
        '</div></div>'
    : '') +

  (bg === 'image'
    ? '<div><div class="t-label mb-2">Background image</div>' +
        '<p class="t-caption text-text-secondary mb-2.5">Uses an image or poster from this computer as the backdrop.</p>' +
        (cfg.background_image_path
          ? '<div class="flex items-center gap-2">' +
              '<span class="panel px-2.5 py-1.5 t-caption font-mono truncate grow">' +
                cfg.background_image_path.split(/[\\/]/).pop() + '</span>' +
              '<button class="btn-secondary btn-sm js-canvas-img">Change</button>' +
              '<button class="btn-ghost btn-icon btn-sm text-error js-canvas-img-clear">' + AC.icon('trash', 'w-3.5 h-3.5') + '</button>' +
            '</div>'
          : '<div class="flex items-center gap-2">' +
              '<button class="btn-secondary btn-sm js-canvas-img">' + AC.icon('upload', 'w-3.5 h-3.5') + ' Choose an image</button>' +
              '<span class="t-caption text-text-tertiary italic">No image selected</span>' +
            '</div>') +
        '<p class="field-hint">PNG, JPG or WebP.</p>' +
      '</div>'
    : '') +

  '<div>' +
    '<div class="flex items-center gap-2 mb-2">' +
      '<span class="t-label grow">Enlarge main video</span>' +
      '<span class="t-caption font-mono text-accent">' +
        (cfg.enlarge_scale === 1 ? '1.0× (normal)' : cfg.enlarge_scale + '×') + '</span>' +
    '</div>' +
    '<div class="grid grid-cols-5 gap-1.5" id="canvasScale">' +
      seg(AC.ENLARGE_SCALES.map(function (s) { return { v: s, l: (s === 1 ? '1.0×' : s + '×') }; }), cfg.enlarge_scale, 'js-canvas-scale') +
    '</div>' +
    '<p class="field-hint">Fills more of the vertical canvas and shrinks the visible background.</p>' +
  '</div>' +

  '<div class="flex gap-2.5 pt-1">' +
    '<span class="text-accent shrink-0 mt-0.5">' + AC.icon('info', 'w-3.5 h-3.5') + '</span>' +
    '<p class="t-caption text-text-secondary">Captions are placed in the empty space below the video automatically. ' +
    'You can still drag them anywhere in the Studio.</p>' +
  '</div>' +

'</div>'
  );
};

AC.bindCanvasControls = function (root, cfg, onChange, stack) {
  const $r = $(root);
  const redraw = function () {
    $r.off().html(AC.canvasModeSwitch(cfg, stack) + '<div class="mt-3">' + AC.canvasControls(cfg) + '</div>');
    AC.bindCanvasControls(root, cfg, onChange, stack);
    if (onChange) onChange(cfg);
  };

  $r.on('click', '.js-canvas-mode', function () { cfg.enabled = $(this).data('v') === 'on'; redraw(); });
  $r.on('click', '.js-canvas-bg',   function () { cfg.background_type = $(this).data('v'); redraw(); });
  $r.on('click', '.js-canvas-blur', function () { cfg.blur_level = $(this).data('v'); redraw(); });
  $r.on('click', '.js-canvas-scale',function () { cfg.enlarge_scale = parseFloat($(this).data('v')); redraw(); });
  $r.on('click', '.js-canvas-color',function () { cfg.background_color = $(this).data('c'); redraw(); });
  $r.on('input', '#canvasHexPick',  function () { cfg.background_color = this.value.toUpperCase(); $r.find('#canvasHex').val(cfg.background_color); if (onChange) onChange(cfg); });
  $r.on('input', '#canvasHex',      function () { cfg.background_color = this.value.toUpperCase(); if (onChange) onChange(cfg); });
  $r.on('click', '.js-canvas-img',  function () { cfg.background_image_path = 'C:\\Users\\dhima\\Pictures\\studio-backdrop.jpg'; redraw(); AC.toast('File picker opens here in the real app'); });
  $r.on('click', '.js-canvas-img-clear', function () { cfg.background_image_path = ''; redraw(); });
};

AC.mountCanvasControls = function (root, cfg, onChange, stack) {
  $(root).html(AC.canvasModeSwitch(cfg, stack) + '<div class="mt-3">' + AC.canvasControls(cfg) + '</div>');
  AC.bindCanvasControls(root, cfg, onChange, stack);
};
