/* render.js - dibujo de jugadores, rutas, pelota y anotaciones sobre la cancha */
window.RG = window.RG || {};

RG.render = (function () {
  const G = RG.geom;
  const M = RG.model;

  const KIND_STYLE = {
    run: { dash: [], width: 0.34, head: true },
    pass: { dash: [1.1, 0.9], width: 0.28, head: true },
    kick: { dash: [2.2, 0.8, 0.4, 0.8], width: 0.28, head: true },
    block: { dash: [], width: 0.34, head: false }
  };

  function playerRadius(v) { return G.clamp(0.72 * v.scale, 9, 34); }

  function strokePath(ctx, v, pts, color, kind, alpha, progress) {
    if (!pts || pts.length < 2) return;
    const st = KIND_STYLE[kind] || KIND_STYLE.run;
    let draw = pts;
    if (typeof progress === 'number' && progress < 1) {
      draw = clipPath(pts, G.clamp(progress, 0, 1));
      if (draw.length < 2) return;
    }
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.6, st.width * v.scale);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash(st.dash.map((d) => d * v.scale));
    ctx.beginPath();
    const p0 = v.toScreen(draw[0]);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < draw.length; i++) { const p = v.toScreen(draw[i]); ctx.lineTo(p.x, p.y); }
    ctx.stroke();
    ctx.setLineDash([]);
    if (st.head) arrowHead(ctx, v, draw, color);
    ctx.restore();
  }

  function clipPath(pts, f) {
    const total = G.pathLength(pts);
    if (total <= 0) return pts.slice(0, 1);
    const target = total * f;
    const out = [pts[0]];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const seg = G.dist(pts[i - 1], pts[i]);
      if (acc + seg >= target) {
        const t = seg <= 1e-6 ? 0 : (target - acc) / seg;
        out.push(G.lerpPoint(pts[i - 1], pts[i], t));
        return out;
      }
      acc += seg;
      out.push(pts[i]);
    }
    return out;
  }

  function arrowHead(ctx, v, pts, color) {
    const tip = v.toScreen(pts[pts.length - 1]);
    const ang = G.endAngle(pts);
    const size = Math.max(7, 1.0 * v.scale);
    ctx.save();
    ctx.translate(tip.x, tip.y);
    ctx.rotate(ang);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(size * 0.9, 0);
    ctx.lineTo(-size * 0.55, size * 0.55);
    ctx.lineTo(-size * 0.25, 0);
    ctx.lineTo(-size * 0.55, -size * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(ctx, v, p, at, opts) {
    const s = v.toScreen(at);
    const r = playerRadius(v);
    const color = M.state.colors[p.team];
    const o = opts || {};

    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;

    if (o.selected) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + Math.max(4, r * 0.42), 0, Math.PI * 2);
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    if (o.hover && !o.selected) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + Math.max(3, r * 0.3), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,.45)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(s.x, s.y + r * 0.16, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = Math.max(1.2, r * 0.13);
    ctx.strokeStyle = o.carrier ? '#ffd166' : 'rgba(255,255,255,.9)';
    ctx.stroke();

    if (o.numbers !== false && r >= 9) {
      ctx.fillStyle = '#fff';
      ctx.font = '600 ' + Math.round(r * 1.12) + 'px ui-sans-serif,system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,.55)';
      ctx.shadowBlur = 2;
      ctx.fillText(String(p.num), s.x, s.y + 0.5);
      ctx.shadowBlur = 0;
    }

    if (o.labels && r >= 8) {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.font = Math.round(Math.max(9, r * 0.72)) + 'px ui-sans-serif,system-ui,sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.shadowColor = 'rgba(0,0,0,.8)';
      ctx.shadowBlur = 3;
      ctx.fillText(p.label, s.x, s.y + r + 3);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function drawBall(ctx, v, at) {
    const s = v.toScreen(at);
    const rx = G.clamp(0.78 * v.scale, 6, 24), ry = rx * 0.64;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(-0.5);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f4f1e8';
    ctx.fill();
    ctx.lineWidth = Math.max(1.4, rx * 0.16);
    ctx.strokeStyle = '#8a5a1e';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-rx * 0.45, 0); ctx.lineTo(rx * 0.45, 0);
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.restore();
  }

  function drawAnnotation(ctx, v, a, selected) {
    ctx.save();
    if (a.type === 'arrow') {
      strokePath(ctx, v, a.pts, a.color || '#ffd166', 'run', 1);
    } else if (a.type === 'cone') {
      const s = v.toScreen(a);
      const r = Math.max(5, 0.8 * v.scale);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - r);
      ctx.lineTo(s.x + r * 0.85, s.y + r * 0.7);
      ctx.lineTo(s.x - r * 0.85, s.y + r * 0.7);
      ctx.closePath();
      ctx.fillStyle = a.color || '#ffb020';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else if (a.type === 'text') {
      const s = v.toScreen(a);
      const size = Math.round(Math.max(11, (a.size || 2.2) * v.scale));
      ctx.font = '600 ' + size + 'px ui-sans-serif,system-ui,sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const w = ctx.measureText(a.text).width;
      ctx.fillStyle = 'rgba(10,14,20,.72)';
      ctx.fillRect(s.x - 5, s.y - size * 0.78, w + 10, size * 1.55);
      ctx.fillStyle = a.color || '#ffffff';
      ctx.fillText(a.text, s.x, s.y);
      if (selected) {
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(s.x - 5, s.y - size * 0.78, w + 10, size * 1.55);
      }
    }
    if (selected && a.type !== 'text') {
      const s = v.toScreen(a.type === 'arrow' ? a.pts[a.pts.length - 1] : a);
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(9, 1.2 * v.scale), 0, Math.PI * 2);
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- escena completa ---------- */

  function draw(ctx, v, scene) {
    const st = M.state;
    const opt = scene.options || {};
    RG.field.draw(ctx, v, { grid: opt.grid, stage: M.state.stage });

    const k = scene.k;
    const t = scene.t;
    const frame = M.frame(k);
    const editing = !scene.playing;
    const visible = M.activePlayers();

    /* estela: donde estaban al comenzar el frame */
    if (opt.onion && k > 0) {
      const r = playerRadius(v) * 0.82;
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.4;
      for (const p of visible) {
        const q = v.toScreen(M.pos(k - 1, p.id));
        ctx.beginPath();
        ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,.18)';
        ctx.fill();
        ctx.strokeStyle = st.colors[p.team] + 'aa';
        ctx.stroke();
      }
      ctx.restore();
    }

    /* rutas del frame actual */
    if (opt.routes) {
      if (k > 0) {
        for (const p of visible) {
          if (frame.routes[p.id]) continue;
          const from = M.pos(k - 1, p.id), to = M.pos(k, p.id);
          if (G.dist(from, to) < 1.2) continue;
          ctx.save();
          ctx.globalAlpha = editing ? 0.45 : 0.3;
          ctx.strokeStyle = st.colors[p.team];
          ctx.lineWidth = Math.max(1, 0.13 * v.scale);
          ctx.setLineDash([0.9 * v.scale, 0.7 * v.scale]);
          const s0 = v.toScreen(from), s1 = v.toScreen(to);
          ctx.beginPath();
          ctx.moveTo(s0.x, s0.y);
          ctx.lineTo(s1.x, s1.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }
      for (const p of visible) {
        const r = frame.routes[p.id];
        if (!r) continue;
        const col = st.colors[p.team];
        strokePath(ctx, v, r.pts, col, r.kind, editing ? 0.92 : 0.5,
          scene.playing ? Math.max(0.02, G.easeInOut(t)) : 1);
      }
      if (frame.ballRoute) {
        strokePath(ctx, v, frame.ballRoute.pts, '#ffd166', frame.ballRoute.kind || 'kick', 0.9,
          scene.playing ? Math.max(0.02, G.easeInOut(t)) : 1);
      }
      /* pase implicito: cambio de portador entre frames */
      if (k > 0) {
        const prev = M.frame(k - 1);
        if (frame.ball.carrier && prev.ball.carrier && frame.ball.carrier !== prev.ball.carrier) {
          const from = M.pos(k - 1, prev.ball.carrier);
          const to = M.pos(k, frame.ball.carrier);
          strokePath(ctx, v, [from, to], '#ffd166', 'pass', 0.75, scene.playing ? G.easeInOut(t) : 1);
        }
      }
    }

    /* anotaciones */
    for (const a of frame.ann) drawAnnotation(ctx, v, a, scene.selection && scene.selection.type === 'ann' && scene.selection.id === a.id);
    if (scene.draft && scene.draft.pts && scene.draft.pts.length > 1) {
      strokePath(ctx, v, scene.draft.pts, scene.draft.color || '#ffffff', scene.draft.kind || 'run', 0.75);
    }

    /* jugadores */
    const carrier = frame.ball.carrier;
    const sel = scene.selection;
    for (const p of visible) {
      const at = scene.pos[p.id] || M.pos(k, p.id);
      drawPlayer(ctx, v, p, at, {
        selected: sel && sel.type === 'player' && sel.id === p.id,
        hover: scene.hover && scene.hover.type === 'player' && scene.hover.id === p.id,
        carrier: carrier === p.id,
        labels: opt.labels,
        numbers: opt.numbers
      });
    }

    drawBall(ctx, v, scene.ball);
  }

  return { draw, drawPlayer, drawBall, strokePath, playerRadius, KIND_STYLE };
})();
