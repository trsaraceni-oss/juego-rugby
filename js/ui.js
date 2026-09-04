/* ui.js - conexion entre el DOM (paneles, timeline, inspector) y el modelo */
window.RG = window.RG || {};

RG.ui = (function () {
  const M = RG.model;
  const G = RG.geom;
  let app = null;
  const $ = (id) => document.getElementById(id);

  /* ---------- avisos ---------- */

  let toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 1900);
  }

  /* El visor de artifacts corre la página en un iframe sandbox: alert, confirm
     y prompt del navegador se ignoran en silencio. Estos los reemplazan. */
  function dialog(opts) {
    return new Promise((resolve) => {
      const back = document.createElement('div');
      back.className = 'modal-back';
      const field = opts.kind === 'text'
        ? '<input type="text" id="mdIn" value="' + escapeAttr(opts.value || '') + '" spellcheck="false">'
        : opts.kind === 'copy'
          ? '<textarea id="mdIn" readonly>' + escapeAttr(opts.value || '') + '</textarea>'
          : '';
      back.innerHTML =
        '<div class="modal" role="dialog" aria-modal="true">' +
        '<p>' + escapeAttr(opts.message) + '</p>' + field +
        '<div class="modal-actions">' +
        (opts.kind === 'copy' ? '' : '<button class="btn" id="mdNo">' + (opts.cancel || 'Cancelar') + '</button>') +
        '<button class="btn primary" id="mdYes">' + (opts.ok || 'Aceptar') + '</button>' +
        '</div></div>';
      document.body.appendChild(back);
      const input = back.querySelector('#mdIn');
      const close = (val) => { document.removeEventListener('keydown', onKey, true); back.remove(); resolve(val); };
      const accept = () => close(opts.kind === 'text' ? (input.value || null) : true);
      function onKey(ev) {
        ev.stopPropagation();
        if (ev.key === 'Escape') { ev.preventDefault(); close(opts.kind === 'text' ? null : false); }
        if (ev.key === 'Enter' && opts.kind !== 'copy') { ev.preventDefault(); accept(); }
      }
      document.addEventListener('keydown', onKey, true);
      back.querySelector('#mdYes').addEventListener('click', accept);
      const no = back.querySelector('#mdNo');
      if (no) no.addEventListener('click', () => close(opts.kind === 'text' ? null : false));
      back.addEventListener('mousedown', (ev) => { if (ev.target === back) close(opts.kind === 'text' ? null : false); });
      if (input) { input.focus(); input.select(); }
    });
  }

  const askConfirm = (message, ok) => dialog({ message, ok: ok || 'Sí, seguir' });
  const askText = (message, value) => dialog({ kind: 'text', message, value, ok: 'Agregar' });
  const showCopy = (message, value) => dialog({ kind: 'copy', message, value, ok: 'Listo' });

  const HINTS = {
    select: 'Arrastrá jugadores. Doble click le da la pelota. Arrastrá el fondo para mover la vista.',
    run: 'Dibujá desde un jugador el recorrido que hace en este frame.',
    pass: 'Tocá al jugador que recibe el pase en este frame.',
    kick: 'Arrastrá desde el portador hasta donde cae la pelota.',
    arrow: 'Arrastrá para dibujar una flecha de referencia.',
    cone: 'Click para poner un cono o marcador.',
    text: 'Click para escribir una nota sobre la cancha.',
    add: 'Click en la cancha para sumar un jugador al equipo elegido abajo a la izquierda.',
    erase: 'Click sobre una ruta, flecha, cono o jugador para borrar su marca.'
  };

  /* ---------- timeline ---------- */

  function refreshFrames() {
    const list = $('frameList');
    list.innerHTML = '';
    M.state.frames.forEach((f, i) => {
      const el = document.createElement('div');
      el.className = 'frame-chip' + (i === app.frameIdx ? ' active' : '');
      el.innerHTML = '<b>' + (i + 1) + '</b><small>' + (i === 0 ? 'inicio' : f.dur.toFixed(1) + ' s') + '</small>';
      el.title = f.note || (i === 0 ? 'Posición inicial' : 'Frame ' + (i + 1));
      el.addEventListener('click', () => app.setFrame(i));
      list.appendChild(el);
    });
    const cur = M.frame(app.frameIdx);
    $('frameDur').value = cur.dur;
    $('frameDur').disabled = app.frameIdx === 0;
    $('frameDurOut').textContent = app.frameIdx === 0 ? '—' : cur.dur.toFixed(1) + ' s';
    $('frameNote').value = cur.note || '';
    const total = M.totalDuration();
    $('scrub').max = Math.max(1, Math.round(total * 1000));
    $('scrub').value = Math.round(M.timeOfFrame(app.frameIdx) * 1000);
    $('btnDelFrame').disabled = M.state.frames.length <= 1;
  }

  function refreshScrub() {
    $('scrub').value = Math.round(app.time * 1000);
  }

  /* ---------- inspector ---------- */

  function row(label, inner) {
    return '<div class="insp-row"><label>' + label + '</label>' + inner + '</div>';
  }

  function refreshInspector() {
    const box = $('inspector-body');
    const sel = app.selection;
    if (!sel) {
      box.className = 'insp-empty';
      box.innerHTML = 'Nada seleccionado.<br><small>Click en un jugador, una ruta o una anotación.</small>';
      return;
    }
    box.className = '';
    const fr = M.frame(app.frameIdx);

    if (sel.type === 'player') {
      const p = M.player(sel.id);
      if (!p) { app.selection = null; return refreshInspector(); }
      const route = fr.routes[p.id];
      const isCarrier = fr.ball.carrier === p.id;
      box.innerHTML =
        '<div class="insp-title"><span class="dot" style="background:' + M.state.colors[p.team] + '"></span>' +
        (p.team === 'a' ? 'Propio' : 'Rival') + ' #' + p.num + '</div>' +
        row('Número', '<input type="number" id="ipNum" min="1" max="99" value="' + p.num + '">') +
        row('Puesto', '<input type="text" id="ipLabel" value="' + escapeAttr(p.label) + '">') +
        row('Pelota', '<button class="btn sm" id="ipBall">' + (isCarrier ? 'Soltar' : 'Dársela') + '</button>') +
        row('', '<button class="btn sm danger" id="ipDelPlayer">Quitar de la cancha</button>') +
        (route
          ? row('Ruta', '<select id="ipKind"><option value="run">Carrera</option><option value="pass">Pase</option><option value="kick">Patada</option><option value="block">Bloqueo</option></select>') +
            row('', '<button class="btn sm danger" id="ipDelRoute">Borrar ruta</button>')
          : '<div class="insp-empty"><small>Sin ruta en este frame. Usá la herramienta Carrera o arrastralo.</small></div>');

      $('ipNum').addEventListener('change', (e) => {
        M.commit(); p.num = G.clamp(parseInt(e.target.value, 10) || 1, 1, 99);
        p.label = M.POSITION_NAMES[p.num] || p.label; app.refreshAll();
      });
      $('ipLabel').addEventListener('change', (e) => { M.commit(); p.label = e.target.value; app.refreshAll(); });
      $('ipBall').addEventListener('click', () => {
        M.commit(); M.setCarrier(app.frameIdx, isCarrier ? null : p.id); app.refreshAll();
      });
      $('ipDelPlayer').addEventListener('click', () => {
        M.commit(); M.removePlayer(p.id); app.selection = null; app.refreshAll();
        toast('#' + p.num + ' sacado de la cancha');
      });
      if (route) {
        $('ipKind').value = route.kind;
        $('ipKind').addEventListener('change', (e) => { M.commit(); route.kind = e.target.value; app.refreshAll(); });
        $('ipDelRoute').addEventListener('click', () => { M.commit(); M.clearRoute(app.frameIdx, p.id); app.refreshAll(); });
      }
      return;
    }

    if (sel.type === 'route') {
      const p = M.player(sel.id);
      box.innerHTML = '<div class="insp-title">Ruta de #' + (p ? p.num : '?') + '</div>' +
        row('', '<button class="btn sm danger" id="ipDelRoute">Borrar ruta</button>');
      $('ipDelRoute').addEventListener('click', () => { M.commit(); M.clearRoute(app.frameIdx, sel.id); app.selection = null; app.refreshAll(); });
      return;
    }

    if (sel.type === 'ball') {
      box.innerHTML = '<div class="insp-title">Pelota</div>' +
        '<div class="insp-empty"><small>Arrastrala para reposicionarla, o doble click en un jugador para dársela.</small></div>';
      return;
    }

    if (sel.type === 'ann') {
      const a = fr.ann.find((x) => x.id === sel.id);
      if (!a) { app.selection = null; return refreshInspector(); }
      const names = { arrow: 'Flecha', cone: 'Cono', text: 'Texto' };
      box.innerHTML = '<div class="insp-title">' + (names[a.type] || a.type) + '</div>' +
        (a.type === 'text' ? row('Texto', '<input type="text" id="ipText" value="' + escapeAttr(a.text) + '">') : '') +
        row('Color', '<input type="color" id="ipColor" value="' + (a.color || '#ffd166') + '">') +
        row('', '<button class="btn sm danger" id="ipDelAnn">Borrar</button>');
      if (a.type === 'text') $('ipText').addEventListener('change', (e) => { M.commit(); a.text = e.target.value; app.refreshAll(); });
      $('ipColor').addEventListener('input', (e) => { a.color = e.target.value; app.requestDraw(); });
      $('ipDelAnn').addEventListener('click', () => { M.commit(); M.removeAnnotation(app.frameIdx, a.id); app.selection = null; app.refreshAll(); });
    }
  }

  function escapeAttr(s) { return String(s == null ? '' : s).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  /* ---------- guardado ---------- */

  function refreshSaved() {
    const sel = $('savedPlays');
    const plays = M.listPlays();
    sel.innerHTML = plays.length
      ? plays.map((p) => '<option value="' + p.id + '">' + escapeAttr(p.name) + '</option>').join('')
      : '<option value="">(sin jugadas guardadas)</option>';
    if (plays.some((p) => p.id === M.state.id)) sel.value = M.state.id;
  }

  /* En claude.ai la descarga directa está bloqueada: si existe la capability
     de descargas del visor se usa esa, y si no, el link de siempre. */
  let dlNs = null, dlAsked = false;
  async function downloader() {
    if (dlAsked) return dlNs;
    dlAsked = true;
    try {
      dlNs = (window.claude && typeof window.claude.use === 'function') ? await window.claude.use('downloads') : null;
    } catch (e) { dlNs = null; }
    return dlNs;
  }

  async function saveFile(name, mime, data) {
    const ns = await downloader();
    if (ns) {
      try { await ns.save({ filename: name, data: data }); return true; }
      catch (e) { return !!(e && e.code === 'declined'); }
    }
    try {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
      return true;
    } catch (e) { return false; }
  }

  function slug(s) { return String(s || 'jugada').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'jugada'; }

  /* ---------- opciones ---------- */

  function syncOptions() {
    app.options.onion = $('optOnion').checked;
    app.options.routes = $('optRoutes').checked;
    app.options.labels = $('optLabels').checked;
    app.options.grid = $('optGrid').checked;
    app.options.numbers = $('optNumbers').checked;
    app.requestDraw();
  }

  function setTool(tool) {
    app.tool = tool;
    document.querySelectorAll('.tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
    $('hint').textContent = HINTS[tool] || '';
    app.canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
  }

  /* ---------- init ---------- */

  function init(_app) {
    app = _app;

    const presets = $('presetSelect');
    presets.innerHTML =
      '<optgroup label="Jugadas de ejemplo">' +
      RG.demos.list().map((d) => '<option value="d:' + d.key + '">' + d.name + '</option>').join('') +
      '</optgroup><optgroup label="Formaciones completas">' +
      M.formationList().filter((f) => !M.FORMATIONS[f.key].only)
        .map((f) => '<option value="f:' + f.key + '">' + f.name + '</option>').join('') +
      '</optgroup><optgroup label="Una unidad sola">' +
      M.formationList().filter((f) => M.FORMATIONS[f.key].only)
        .map((f) => '<option value="f:' + f.key + '">' + f.name + '</option>').join('') +
      '</optgroup>';

    document.querySelectorAll('.tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
    document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
      if (M.state.stage !== 'field') app.setStage('field');
      app.view.fit(RG.field.VIEWS[b.dataset.view]);
      app.requestDraw();
    }));

    document.querySelectorAll('[data-stage]').forEach((b) => b.addEventListener('click', () => app.setStage(b.dataset.stage)));

    ['optOnion', 'optRoutes', 'optLabels', 'optGrid', 'optNumbers'].forEach((id) => $(id).addEventListener('change', syncOptions));

    $('playName').addEventListener('change', (e) => { M.state.name = e.target.value.trim() || 'Jugada sin nombre'; });

    $('btnPreset').addEventListener('click', async () => {
      const val = presets.value || '';
      const kind = val.slice(0, 2), key = val.slice(2);
      if (M.state.frames.length > 1 && !(await askConfirm('Esto reemplaza la jugada que tenés armada. ¿Seguir?', 'Reemplazar'))) return;
      if (kind === 'd:') {
        RG.demos.load(key);
        app.frameIdx = 0; app.time = 0; app.selection = null;
        app.setStage('field');
        app.refreshAll();
        toast('Jugada de ejemplo cargada: apretá play');
        return;
      }
      M.commit();
      M.state.frames = [M.blankFrame()];
      M.state.id = RG.geom.uid();
      M.state.name = 'Jugada sin nombre';
      app.frameIdx = 0; app.time = 0;
      M.applyFormation(key, 0, $('optWithB').checked);
      if (key === 'unit_lineout') app.setStage('lineout');
      else if (M.state.stage !== 'field') app.setStage('field');
      app.selection = null;
      app.fitPlay();
      app.refreshAll();
      toast('Formación aplicada');
    });

    $('squadSize').addEventListener('change', (e) => {
      M.commit();
      M.rebuildSquad(parseInt(e.target.value, 10), null);
      const val = presets.value || '';
      M.applyFormation(val.slice(0, 2) === 'f:' ? val.slice(2) : 'attack', app.frameIdx, $('optWithB').checked);
      app.selection = null;
      app.refreshAll();
    });

    $('colorA').addEventListener('input', (e) => { M.state.colors.a = e.target.value; app.requestDraw(); });
    $('colorB').addEventListener('input', (e) => { M.state.colors.b = e.target.value; app.requestDraw(); });
    $('optWithB').addEventListener('change', (e) => {
      const on = e.target.checked;
      M.commit();
      M.state.showB = on;
      if (!on) {
        for (const p of M.state.players.filter((x) => x.team === 'b')) M.removePlayer(p.id);
        toast('Rival sacado de la cancha');
      } else if (!M.state.players.some((p) => p.team === 'b')) {
        M.applyFormation(M.state.lastFormation || 'attack', app.frameIdx, true);
        toast('Rival agregado según la formación');
      }
      app.selection = null;
      app.refreshAll();
    });

    document.querySelectorAll('.team-toggle .btn').forEach((btn) => btn.addEventListener('click', () => {
      app.addTeam = btn.dataset.team;
      document.querySelectorAll('.team-toggle .btn').forEach((b) => b.classList.toggle('active', b === btn));
      if (app.addTeam === 'b' && !$('optWithB').checked) { $('optWithB').checked = true; $('optWithB').dispatchEvent(new Event('change')); }
    }));

    $('btnUndo').addEventListener('click', () => app.undo());
    $('btnRedo').addEventListener('click', () => app.redo());

    /* transporte */
    $('btnPlay').addEventListener('click', () => app.togglePlay());
    $('btnFirst').addEventListener('click', () => app.setFrame(0));
    $('btnLast').addEventListener('click', () => app.setFrame(M.frameCount() - 1));
    $('btnPrev').addEventListener('click', () => app.setFrame(app.frameIdx - 1));
    $('btnNext').addEventListener('click', () => app.setFrame(app.frameIdx + 1));
    $('speed').addEventListener('change', (e) => { app.speed = parseFloat(e.target.value); });
    $('optLoop').addEventListener('change', (e) => { app.loop = e.target.checked; });

    $('scrub').addEventListener('input', (e) => {
      app.stop();
      app.time = parseInt(e.target.value, 10) / 1000;
      const r = M.resolveTime(app.time);
      app.frameIdx = r.t > 0.98 ? r.k : Math.max(0, r.k - 1);
      app.scrubbing = true;
      app.requestDraw();
      refreshFrames();
      app.scrubbing = false;
    });

    $('btnAddFrame').addEventListener('click', () => {
      M.commit();
      app.setFrame(M.addFrame(app.frameIdx));
      toast('Frame ' + (app.frameIdx + 1) + ' agregado');
    });
    $('btnDupFrame').addEventListener('click', () => { M.commit(); app.setFrame(M.duplicateFrame(app.frameIdx)); });
    $('btnDelFrame').addEventListener('click', () => { M.commit(); app.setFrame(M.deleteFrame(app.frameIdx)); });

    $('frameDur').addEventListener('input', (e) => {
      const f = M.frame(app.frameIdx);
      f.dur = parseFloat(e.target.value);
      $('frameDurOut').textContent = f.dur.toFixed(1) + ' s';
      refreshFrames();
    });
    $('frameNote').addEventListener('change', (e) => { M.frame(app.frameIdx).note = e.target.value; refreshFrames(); });

    /* zoom */
    $('btnZoomIn').addEventListener('click', () => { app.view.zoomAt({ x: app.view.w / 2, y: app.view.h / 2 }, 1.2); app.requestDraw(); });
    $('btnZoomOut').addEventListener('click', () => { app.view.zoomAt({ x: app.view.w / 2, y: app.view.h / 2 }, 1 / 1.2); app.requestDraw(); });
    $('btnZoomFit').addEventListener('click', () => { app.fitPlay(); app.requestDraw(); });

    /* guardado */
    $('btnSave').addEventListener('click', () => {
      M.state.name = $('playName').value.trim() || 'Jugada sin nombre';
      if (M.savePlay()) { refreshSaved(); toast('Jugada guardada'); }
      else toast('No se pudo guardar en este navegador');
    });
    $('btnLoad').addEventListener('click', () => {
      const id = $('savedPlays').value;
      if (!id) return toast('No hay jugadas guardadas');
      if (M.loadPlay(id)) { app.frameIdx = 0; app.time = 0; app.selection = null; app.setStage(M.state.stage); app.refreshAll(); toast('Jugada abierta'); }
    });
    $('btnDeletePlay').addEventListener('click', async () => {
      const id = $('savedPlays').value;
      if (!id) return;
      const name = $('savedPlays').selectedOptions[0].textContent;
      if (!(await askConfirm('¿Borrar la jugada guardada "' + name + '"?', 'Borrar'))) return;
      M.deletePlay(id); refreshSaved(); toast('Jugada borrada');
    });

    $('btnExport').addEventListener('click', async () => {
      M.state.name = $('playName').value.trim() || 'Jugada sin nombre';
      const json = JSON.stringify(M.serialize(), null, 2);
      const ok = await saveFile(slug(M.state.name) + '.json', 'application/json', json);
      if (!ok) showCopy('No se pudo bajar el archivo. Copiá el contenido de la jugada:', json);
    });
    $('btnImport').addEventListener('click', () => $('fileInput').click());
    $('fileInput').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          M.load(JSON.parse(rd.result));
          app.frameIdx = 0; app.time = 0; app.selection = null;
          app.setStage(M.state.stage);
          app.refreshAll(); toast('Jugada importada');
        } catch (err) { toast('Archivo inválido: ' + err.message); }
      };
      rd.readAsText(file);
      e.target.value = '';
    });
    $('btnPng').addEventListener('click', () => {
      app.canvas.toBlob(async (blob) => {
        if (!blob) return toast('No se pudo generar la imagen');
        const name = slug(M.state.name) + '-frame' + (app.frameIdx + 1) + '.png';
        if (!(await saveFile(name, 'image/png', blob))) toast('El navegador rechazó la descarga');
      });
    });

    $('btnPresent').addEventListener('click', () => app.togglePresent());

    setTool('select');
    syncOptions();
    refreshSaved();
  }

  function refreshHeader() {
    $('playName').value = M.state.name;
    $('squadSize').value = String(M.state.squad);
    $('colorA').value = M.state.colors.a;
    $('colorB').value = M.state.colors.b;
    $('optWithB').checked = M.state.showB;
    $('btnUndo').disabled = !M.history.undo.length;
    $('btnRedo').disabled = !M.history.redo.length;
  }

  return { init, toast, askConfirm, askText, showCopy, refreshFrames, refreshInspector, refreshSaved, refreshHeader, refreshScrub, setTool };
})();
