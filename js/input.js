/* input.js - punteros sobre el canvas: seleccion, arrastre, dibujo de rutas y anotaciones */
window.RG = window.RG || {};

RG.input = (function () {
  const G = RG.geom;
  const M = RG.model;

  let app = null, cv = null, v = null;
  const pointers = new Map();
  let drag = null;          /* gesto en curso */
  let pinch = null;
  let passFrom = null;      /* origen pendiente para la herramienta de pase */

  function worldFromEvent(e) {
    const r = cv.getBoundingClientRect();
    return v.toWorld({ x: e.clientX - r.left, y: e.clientY - r.top });
  }

  function screenFromEvent(e) {
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /* ---------- hit testing (en metros) ---------- */

  function hitPlayer(w) {
    const tol = RG.render.playerRadius(v) / v.scale;
    let best = null, bestD = Infinity;
    for (const p of M.activePlayers()) {
      const d = G.dist(w, M.pos(app.frameIdx, p.id));
      if (d < tol && d < bestD) { best = p; bestD = d; }
    }
    return best;
  }

  function hitBall(w) {
    const fr = M.frame(app.frameIdx);
    if (fr.ball.carrier) return false;
    return G.dist(w, M.ballStatic(app.frameIdx)) < Math.max(1.2, 10 / v.scale);
  }

  function hitAnnotation(w) {
    const fr = M.frame(app.frameIdx);
    const tol = Math.max(1.2, 12 / v.scale);
    for (let i = fr.ann.length - 1; i >= 0; i--) {
      const a = fr.ann[i];
      if (a.type === 'arrow') { if (G.distToPath(w, a.pts) < tol) return a; }
      else if (G.dist(w, a) < tol * 1.4) return a;
    }
    return null;
  }

  function hitRoute(w) {
    const fr = M.frame(app.frameIdx);
    const tol = Math.max(0.9, 9 / v.scale);
    for (const p of M.activePlayers()) {
      const r = fr.routes[p.id];
      if (r && G.distToPath(w, r.pts) < tol) return { playerId: p.id, route: r };
    }
    return null;
  }

  /* el frame 0 guarda solo la posicion inicial: cualquier movimiento crea el siguiente */
  function frameForMovement() {
    if (app.frameIdx === 0) {
      const i = M.addFrame(0);
      app.setFrame(i);
      app.toast('Frame 2 creado: el frame 1 es la posición inicial');
    }
    return app.frameIdx;
  }

  /* ---------- gestos ---------- */

  function onDown(e) {
    if (e.button === 2) return;
    cv.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, screenFromEvent(e));
    if (pointers.size === 2) { startPinch(); return; }

    const w = worldFromEvent(e);
    const sc = screenFromEvent(e);
    app.stop();

    if (e.button === 1 || e.altKey || app.spaceDown) { drag = { type: 'pan', last: sc }; return; }

    switch (app.tool) {
      case 'select': return downSelect(w, sc);
      case 'run': return downRoute(w, 'run');
      case 'pass': return downPass(w);
      case 'kick': return downKick(w);
      case 'arrow': return downArrow(w);
      case 'cone': return downCone(w);
      case 'text': return downText(w);
      case 'erase': return downErase(w);
    }
  }

  function downSelect(w, sc) {
    const p = hitPlayer(w);
    if (p) {
      M.commit();
      const at = M.pos(app.frameIdx, p.id);
      app.selection = { type: 'player', id: p.id };
      drag = { type: 'player', id: p.id, dx: at.x - w.x, dy: at.y - w.y, moved: false };
      app.refreshInspector();
      return;
    }
    if (hitBall(w)) {
      M.commit();
      app.selection = { type: 'ball' };
      drag = { type: 'ball' };
      app.refreshInspector();
      return;
    }
    const a = hitAnnotation(w);
    if (a) {
      M.commit();
      app.selection = { type: 'ann', id: a.id };
      drag = { type: 'ann', id: a.id, ref: a, ox: w.x, oy: w.y };
      app.refreshInspector();
      return;
    }
    const r = hitRoute(w);
    if (r) {
      app.selection = { type: 'route', id: r.playerId };
      app.refreshInspector();
      drag = { type: 'pan', last: sc };
      return;
    }
    app.selection = null;
    app.refreshInspector();
    drag = { type: 'pan', last: sc };
  }

  function downRoute(w, kind) {
    const p = hitPlayer(w);
    if (!p) { app.toast('Empezá el trazo sobre un jugador'); return; }
    M.commit();
    frameForMovement();
    const start = M.pos(app.frameIdx - 1, p.id);
    drag = { type: 'route', id: p.id, kind, pts: [{ x: start.x, y: start.y }] };
    app.selection = { type: 'player', id: p.id };
    app.draft = { pts: drag.pts, kind, color: M.state.colors[p.team] };
  }

  function downPass(w) {
    const p = hitPlayer(w);
    if (!p) { app.toast('Tocá al jugador que recibe'); return; }
    const fr0 = M.frame(app.frameIdx);
    if (!passFrom && !fr0.ball.carrier) { app.toast('Primero asigná la pelota a un jugador (herramienta Mover + doble click)'); return; }
    M.commit();
    const k = frameForMovement();
    M.setCarrier(k, p.id);
    app.selection = { type: 'player', id: p.id };
    app.toast('Pase a #' + p.num);
    app.refreshAll();
  }

  function downKick(w) {
    const fr = M.frame(app.frameIdx);
    const carrier = fr.ball.carrier;
    const from = M.ballStatic(app.frameIdx);
    if (!carrier) { app.toast('La patada sale del jugador que tiene la pelota'); }
    M.commit();
    drag = { type: 'kick', from: { x: from.x, y: from.y } };
    app.draft = { pts: [from, w], kind: 'kick', color: '#ffd166' };
  }

  function downArrow(w) {
    M.commit();
    drag = { type: 'arrow', pts: [{ x: w.x, y: w.y }] };
    app.draft = { pts: drag.pts, kind: 'run', color: '#ffd166' };
  }

  function downCone(w) {
    M.commit();
    const a = M.addAnnotation(app.frameIdx, { type: 'cone', x: w.x, y: w.y, color: '#ffb020' });
    app.selection = { type: 'ann', id: a.id };
    app.refreshAll();
  }

  function downText(w) {
    const txt = window.prompt('Texto de la anotación:', '');
    if (!txt) return;
    M.commit();
    const a = M.addAnnotation(app.frameIdx, { type: 'text', x: w.x, y: w.y, text: txt, size: 2.2, color: '#ffffff' });
    app.selection = { type: 'ann', id: a.id };
    app.refreshAll();
  }

  function downErase(w) {
    const a = hitAnnotation(w);
    if (a) { M.commit(); M.removeAnnotation(app.frameIdx, a.id); app.selection = null; app.refreshAll(); return; }
    const r = hitRoute(w);
    if (r) { M.commit(); M.clearRoute(app.frameIdx, r.playerId); app.refreshAll(); return; }
    const p = hitPlayer(w);
    if (p) {
      M.commit();
      M.clearRoute(app.frameIdx, p.id);
      const fr = M.frame(app.frameIdx);
      if (fr.ball.carrier === p.id) M.setCarrier(app.frameIdx, null);
      app.refreshAll();
      return;
    }
    const fr = M.frame(app.frameIdx);
    if (fr.ballRoute) { M.commit(); fr.ballRoute = null; app.refreshAll(); }
  }

  function onMove(e) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, screenFromEvent(e));
    if (pinch && pointers.size >= 2) { updatePinch(); return; }

    const w = worldFromEvent(e);
    if (!drag) {
      const p = hitPlayer(w);
      const newHover = p ? { type: 'player', id: p.id } : null;
      const changed = JSON.stringify(newHover) !== JSON.stringify(app.hover);
      app.hover = newHover;
      cv.style.cursor = p ? (app.tool === 'select' ? 'grab' : 'crosshair')
        : (app.tool === 'select' ? 'default' : 'crosshair');
      if (changed) app.requestDraw();
      return;
    }

    if (drag.type === 'pan') {
      const sc = screenFromEvent(e);
      v.panPixels(sc.x - drag.last.x, sc.y - drag.last.y);
      drag.last = sc;
      app.requestDraw();
      return;
    }

    if (drag.type === 'player') {
      M.setPos(app.frameIdx, drag.id, { x: w.x + drag.dx, y: w.y + drag.dy }, true);
      drag.moved = true;
      cv.style.cursor = 'grabbing';
      app.requestDraw();
      return;
    }

    if (drag.type === 'ball') {
      const fr = M.frame(app.frameIdx);
      fr.ball.carrier = null; fr.ball.x = w.x; fr.ball.y = w.y;
      app.requestDraw();
      return;
    }

    if (drag.type === 'ann') {
      const a = drag.ref;
      if (a.type === 'arrow') {
        const dx = w.x - drag.ox, dy = w.y - drag.oy;
        for (const p of a.pts) { p.x += dx; p.y += dy; }
        drag.ox = w.x; drag.oy = w.y;
      } else { a.x = w.x; a.y = w.y; }
      app.requestDraw();
      return;
    }

    if (drag.type === 'route' || drag.type === 'arrow') {
      const last = drag.pts[drag.pts.length - 1];
      if (G.dist(last, w) > 0.35) drag.pts.push({ x: w.x, y: w.y });
      app.requestDraw();
      return;
    }

    if (drag.type === 'kick') {
      app.draft.pts = G.arcPath(drag.from, w, -G.dist(drag.from, w) * 0.16, 18);
      app.requestDraw();
      return;
    }
  }

  function onUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!drag) return;
    const w = worldFromEvent(e);

    if (drag.type === 'route') {
      const pts = G.smooth(G.simplify(drag.pts, 0.35), 6);
      if (G.pathLength(pts) < 1.2) {
        M.undo();
        app.toast('Trazo muy corto');
      } else {
        M.setRoute(app.frameIdx, drag.id, pts, drag.kind);
      }
      app.draft = null;
      app.refreshAll();
    } else if (drag.type === 'arrow') {
      const pts = G.smooth(G.simplify(drag.pts, 0.35), 6);
      if (G.pathLength(pts) < 1.2) M.undo();
      else {
        const a = M.addAnnotation(app.frameIdx, { type: 'arrow', pts, color: '#ffd166' });
        app.selection = { type: 'ann', id: a.id };
      }
      app.draft = null;
      app.refreshAll();
    } else if (drag.type === 'kick') {
      const from = drag.from;
      if (G.dist(from, w) < 2) { M.undo(); app.draft = null; app.refreshAll(); }
      else {
        const k = frameForMovement();
        const fr = M.frame(k);
        fr.ball.carrier = null;
        fr.ball.x = w.x; fr.ball.y = w.y;
        fr.ballRoute = { pts: G.arcPath(from, w, -G.dist(from, w) * 0.16, 18), kind: 'kick' };
        app.draft = null;
        app.toast('Patada cargada en el frame ' + (k + 1));
        app.refreshAll();
      }
    } else if (drag.type === 'player' && drag.moved) {
      app.refreshAll();
    } else if (drag.type === 'ball' || drag.type === 'ann') {
      app.refreshAll();
    }

    drag = null;
    cv.style.cursor = app.tool === 'select' ? 'default' : 'crosshair';
  }

  function onDouble(e) {
    const w = worldFromEvent(e);
    const p = hitPlayer(w);
    if (!p) return;
    M.commit();
    const fr = M.frame(app.frameIdx);
    M.setCarrier(app.frameIdx, fr.ball.carrier === p.id ? null : p.id);
    app.toast(fr.ball.carrier ? 'Pelota para #' + p.num : 'Pelota suelta');
    app.refreshAll();
  }

  function onWheel(e) {
    e.preventDefault();
    v.zoomAt(screenFromEvent(e), e.deltaY < 0 ? 1.12 : 1 / 1.12);
    app.requestDraw();
  }

  function startPinch() {
    const pts = [...pointers.values()];
    pinch = { d: G.dist(pts[0], pts[1]), mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } };
    drag = null;
  }

  function updatePinch() {
    const pts = [...pointers.values()];
    const d = G.dist(pts[0], pts[1]);
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    if (pinch.d > 0) v.zoomAt(mid, d / pinch.d);
    v.panPixels(mid.x - pinch.mid.x, mid.y - pinch.mid.y);
    pinch = { d, mid };
    app.requestDraw();
  }

  function attach(_app) {
    app = _app; cv = app.canvas; v = app.view;
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('dblclick', onDouble);
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  return { attach, hitPlayer };
})();
