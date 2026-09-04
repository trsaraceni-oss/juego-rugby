/* app.js - estado de la aplicacion, bucle de animacion y atajos de teclado */
(function () {
  const M = RG.model;
  const G = RG.geom;

  const canvas = document.getElementById('cv');
  const view = RG.field.createView(canvas);
  let ctx = canvas.getContext('2d');

  const app = {
    canvas, view,
    tool: 'select',
    frameIdx: 0,
    time: 0,
    playing: false,
    scrubbing: false,
    speed: 1,
    loop: false,
    selection: null,
    hover: null,
    draft: null,
    spaceDown: false,
    addTeam: 'a',
    options: { onion: true, routes: true, labels: false, grid: false, numbers: true }
  };

  /* ---------- dibujo ---------- */

  let pending = false;
  app.requestDraw = function () {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; app.draw(); });
  };

  function buildScene() {
    if (app.playing || app.scrubbing) {
      const s = M.sampleAt(app.time);
      return { k: s.k, t: s.t, pos: s.pos, ball: s.ball, playing: true, options: app.options, selection: app.selection, hover: app.hover, draft: app.draft };
    }
    const k = app.frameIdx;
    const pos = {};
    for (const p of M.state.players) pos[p.id] = M.pos(k, p.id);
    return { k, t: 1, pos, ball: M.ballStatic(k), playing: false, options: app.options, selection: app.selection, hover: app.hover, draft: app.draft };
  }

  app.draw = function () { RG.render.draw(ctx, view, buildScene()); };

  /* ---------- reproduccion ---------- */

  let rafId = 0, lastTs = 0;

  function tick(ts) {
    if (!app.playing) return;
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0);
    lastTs = ts;
    app.time += dt * app.speed;
    const total = M.totalDuration();
    if (app.time >= total) {
      if (app.loop) { app.time = 0; }
      else {
        app.time = total;
        app.playing = false;
        app.frameIdx = M.frameCount() - 1;
        document.getElementById('btnPlay').textContent = '▶';
        RG.ui.refreshFrames();
        app.draw();
        return;
      }
    }
    const r = M.resolveTime(app.time);
    if (r.k !== app.frameIdx + 1 && r.k !== app.frameIdx) { /* solo informativo */ }
    app.frameIdx = Math.max(0, r.t >= 1 ? r.k : r.k - 1);
    RG.ui.refreshScrub();
    app.draw();
    rafId = requestAnimationFrame(tick);
  }

  app.play = function () {
    if (M.frameCount() < 2) return app.toast('Agregá al menos un frame más para animar');
    if (app.time >= M.totalDuration() - 1e-6) app.time = 0;
    app.playing = true;
    app.selection = null;
    document.getElementById('btnPlay').textContent = '❚❚';
    lastTs = performance.now();
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  };

  app.stop = function () {
    if (!app.playing) return;
    app.playing = false;
    cancelAnimationFrame(rafId);
    document.getElementById('btnPlay').textContent = '▶';
    const r = M.resolveTime(app.time);
    app.frameIdx = r.t > 0.5 ? r.k : Math.max(0, r.k - 1);
    app.time = M.timeOfFrame(app.frameIdx);
    RG.ui.refreshFrames();
    app.draw();
  };

  app.togglePlay = function () { app.playing ? app.stop() : app.play(); };

  /* ---------- encuadre automatico sobre la jugada ---------- */

  /* 'field' = cancha completa; 'lineout' = corredor de line-out visto de costado */
  app.setStage = function (stage) {
    M.state.stage = stage;
    view.swap = stage === 'lineout';
    view.setBounds(stage === 'lineout' ? RG.field.VIEWS.lineout : null);
    app.fitPlay();
    document.querySelectorAll('[data-stage]').forEach((b) => b.classList.toggle('active', b.dataset.stage === stage));
    app.requestDraw();
  };

  app.fitPlay = function () {
    if (M.state.stage === 'lineout') return view.fit(RG.field.VIEWS.lineout);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const push = (q) => {
      if (!q) return;
      x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y);
      x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y);
    };
    for (let i = 0; i < M.frameCount(); i++) {
      const fr = M.frame(i);
      for (const p of M.activePlayers()) push(fr.pos[p.id]);
      for (const id of Object.keys(fr.routes)) for (const q of fr.routes[id].pts) push(q);
      for (const a of fr.ann) a.type === 'arrow' ? a.pts.forEach(push) : push(a);
    }
    if (!isFinite(x0)) return view.fit(RG.field.VIEWS.full);
    const pad = 8;
    view.fit({
      x0: Math.max(-12, x0 - pad), y0: Math.max(-2, y0 - pad),
      x1: Math.min(112, x1 + pad), y1: Math.min(72, y1 + pad)
    });
  };

  /* ---------- modo presentacion ---------- */

  app.togglePresent = function (on) {
    const active = on == null ? !document.body.classList.contains('presenting') : on;
    document.body.classList.toggle('presenting', active);
    setTimeout(() => {
      ctx = view.resize();
      app.fitPlay();
      if (active) { app.setFrame(0); app.loop = true; app.play(); }
      else { app.stop(); app.loop = document.getElementById('optLoop').checked; }
      app.draw();
    }, 60);
  };

  /* ---------- navegacion ---------- */

  app.setFrame = function (i) {
    app.stop();
    app.frameIdx = G.clamp(i, 0, M.frameCount() - 1);
    app.time = M.timeOfFrame(app.frameIdx);
    app.selection = null;
    app.refreshAll();
  };

  app.refreshAll = function () {
    RG.ui.refreshFrames();
    RG.ui.refreshInspector();
    RG.ui.refreshHeader();
    app.requestDraw();
  };
  app.refreshInspector = function () { RG.ui.refreshInspector(); RG.ui.refreshHeader(); app.requestDraw(); };
  app.toast = RG.ui.toast;

  app.undo = function () {
    if (M.undo()) {
      app.frameIdx = G.clamp(app.frameIdx, 0, M.frameCount() - 1);
      app.time = M.timeOfFrame(app.frameIdx);
      app.selection = null;
      app.refreshAll();
    }
  };
  app.redo = function () {
    if (M.redo()) {
      app.frameIdx = G.clamp(app.frameIdx, 0, M.frameCount() - 1);
      app.time = M.timeOfFrame(app.frameIdx);
      app.selection = null;
      app.refreshAll();
    }
  };

  /* ---------- teclado ---------- */

  const TOOL_KEYS = { v: 'select', r: 'run', p: 'pass', k: 'kick', a: 'arrow', c: 'cone', t: 'text', e: 'erase', j: 'add' };

  document.addEventListener('keydown', (ev) => {
    const tag = (ev.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

    if (ev.code === 'Space') { ev.preventDefault(); app.spaceDown = true; app.togglePlay(); return; }
    if (ev.key === 'Escape') { app.togglePresent(false); return; }
    if (ev.key.toLowerCase() === 'f' && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); app.togglePresent(); return; }
    if (ev.key === 'ArrowLeft') { ev.preventDefault(); app.setFrame(app.frameIdx - 1); return; }
    if (ev.key === 'ArrowRight') { ev.preventDefault(); app.setFrame(app.frameIdx + 1); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') { ev.preventDefault(); ev.shiftKey ? app.redo() : app.undo(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'y') { ev.preventDefault(); app.redo(); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); document.getElementById('btnSave').click(); return; }
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;

    const key = ev.key.toLowerCase();
    if (key === 'n') { ev.preventDefault(); document.getElementById('btnAddFrame').click(); return; }
    if (TOOL_KEYS[key]) { RG.ui.setTool(TOOL_KEYS[key]); return; }
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      const sel = app.selection;
      if (!sel) return;
      M.commit();
      if (sel.type === 'ann') M.removeAnnotation(app.frameIdx, sel.id);
      else if (sel.type === 'player' || sel.type === 'route') M.clearRoute(app.frameIdx, sel.id);
      app.selection = null;
      app.refreshAll();
    }
  });

  document.addEventListener('keyup', (ev) => { if (ev.code === 'Space') app.spaceDown = false; });

  /* ---------- arranque ---------- */

  function resize() {
    ctx = view.resize();
    view.applyBounds();
    app.draw();
  }

  M.loadUserFormations();
  RG.ui.init(app);
  RG.input.attach(app);

  RG.demos.load('lineout_backs');
  ctx = view.resize();
  app.setStage(M.state.stage);
  app.refreshAll();

  if (window.ResizeObserver) new ResizeObserver(resize).observe(document.querySelector('.stage'));
  window.addEventListener('resize', resize);

  window.RG.app = app;
})();
