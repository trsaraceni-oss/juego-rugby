/* field.js - dimensiones reglamentarias, cámara y dibujo del escenario.
   Hay dos escenarios: la cancha completa y el corredor de line-out, que se
   mira de costado (la línea de touch a la izquierda) intercambiando los ejes. */
window.RG = window.RG || {};

RG.field = (function () {
  const G = RG.geom;

  /* World Rugby: 100 m entre líneas de try, 70 m de ancho, in-goal de 10 m */
  const F = {
    length: 100, width: 70, inGoal: 10,
    xTryA: 0, xTryB: 100, xDeadA: -10, xDeadB: 110,
    x22A: 22, x22B: 78, x10A: 40, x10B: 60, xHalf: 50, x5A: 5, x5B: 95,
    y5: 5, y15: 15, yMid: 35, postGap: 5.6
  };

  /* encuadres, en metros de cancha */
  const VIEWS = {
    full: { x0: -13, y0: -3, x1: 113, y1: 73 },
    attack: { x0: 48, y0: -2, x1: 113, y1: 72 },
    mid: { x0: 18, y0: -2, x1: 82, y1: 72 },
    defend: { x0: -13, y0: -2, x1: 52, y1: 72 },
    lineout: { x0: 36, y0: -4.5, x1: 64, y1: 23 }
  };

  function createView(canvas) {
    const v = { ox: -13, oy: -3, scale: 8, swap: false, canvas, w: 1, h: 1 };

    /* mundo -> plano de dibujo: el escenario de line-out intercambia los ejes,
       así la distancia a la touch corre en horizontal */
    v.plane = function (p) { return v.swap ? { x: p.y, y: p.x } : { x: p.x, y: p.y }; };

    v.resize = function () {
      const dpr = window.devicePixelRatio || 1;
      const r = canvas.getBoundingClientRect();
      v.w = Math.max(1, r.width); v.h = Math.max(1, r.height);
      canvas.width = Math.round(v.w * dpr);
      canvas.height = Math.round(v.h * dpr);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return ctx;
    };

    v.fit = function (rect) {
      const r0 = rect || VIEWS.full;
      const a = v.plane({ x: r0.x0, y: r0.y0 }), b = v.plane({ x: r0.x1, y: r0.y1 });
      const r = { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
      const sx = v.w / (r.x1 - r.x0), sy = v.h / (r.y1 - r.y0);
      v.scale = Math.min(sx, sy);
      v.ox = r.x0 - (v.w / v.scale - (r.x1 - r.x0)) / 2;
      v.oy = r.y0 - (v.h / v.scale - (r.y1 - r.y0)) / 2;
    };

    v.toScreen = function (p) {
      const a = v.plane(p);
      return { x: (a.x - v.ox) * v.scale, y: (a.y - v.oy) * v.scale };
    };

    v.toWorld = function (p) {
      const a = { x: p.x / v.scale + v.ox, y: p.y / v.scale + v.oy };
      return v.swap ? { x: a.y, y: a.x } : a;
    };

    v.zoomAt = function (screenPt, factor) {
      const before = v.toWorld(screenPt);
      v.scale = G.clamp(v.scale * factor, 2.2, 80);
      const after = v.toWorld(screenPt);
      const d = v.plane({ x: before.x - after.x, y: before.y - after.y });
      v.ox += d.x;
      v.oy += d.y;
    };

    v.panPixels = function (dx, dy) { v.ox -= dx / v.scale; v.oy -= dy / v.scale; };

    return v;
  }

  /* ---------- helpers de dibujo (todo en metros de cancha) ---------- */

  function line(ctx, v, x0, y0, x1, y1) {
    const a = v.toScreen({ x: x0, y: y0 }), b = v.toScreen({ x: x1, y: y1 });
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  function box(ctx, v, x0, y0, x1, y1, fill) {
    const a = v.toScreen({ x: x0, y: y0 }), b = v.toScreen({ x: x1, y: y1 });
    ctx.fillStyle = fill;
    ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x) + 0.6, Math.abs(b.y - a.y) + 0.6);
  }

  function label(ctx, v, x, y, text, size, color, align) {
    const s = v.toScreen({ x: x, y: y });
    ctx.fillStyle = color;
    ctx.font = Math.round(Math.max(9, size * v.scale)) + 'px ui-sans-serif,system-ui,sans-serif';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, s.x, s.y);
  }

  /* rótulo de tamaño fijo en píxeles, con desplazamiento en píxeles */
  function tag(ctx, v, x, y, text, opts) {
    const o = opts || {};
    const s = v.toScreen({ x: x, y: y });
    ctx.save();
    ctx.font = (o.weight || '600 ') + (o.px || 12) + 'px ui-sans-serif,system-ui,sans-serif';
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = o.baseline || 'middle';
    if (o.box) {
      const w = ctx.measureText(text).width;
      const px = s.x + (o.dx || 0), py = s.y + (o.dy || 0);
      const left = o.align === 'left' ? px - 4 : o.align === 'right' ? px - w - 4 : px - w / 2 - 4;
      ctx.fillStyle = 'rgba(11,14,18,.62)';
      ctx.fillRect(left, py - (o.px || 12) * 0.72, w + 8, (o.px || 12) * 1.45);
    }
    ctx.fillStyle = o.color || 'rgba(255,255,255,.8)';
    ctx.fillText(text, s.x + (o.dx || 0), s.y + (o.dy || 0));
    ctx.restore();
  }

  /* ---------- cancha completa ---------- */

  function goalPosts(ctx, v, x, dir) {
    const g = F.postGap / 2;
    const depth = 1.6 * dir;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = Math.max(2, 0.32 * v.scale);
    ctx.lineCap = 'round';
    line(ctx, v, x, F.yMid - g, x + depth, F.yMid - g);
    line(ctx, v, x, F.yMid + g, x + depth, F.yMid + g);
    ctx.lineWidth = Math.max(1.5, 0.22 * v.scale);
    line(ctx, v, x + depth * 0.55, F.yMid - g, x + depth * 0.55, F.yMid + g);
    ctx.restore();
  }

  function ticks(ctx, v, y, from, to, step, half) {
    ctx.beginPath();
    for (let x = from; x <= to + 0.01; x += step) {
      const a = v.toScreen({ x: x, y: y - half }), b = v.toScreen({ x: x, y: y + half });
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }

  function drawFullField(ctx, v, o) {
    const lw = Math.max(1, 0.12 * v.scale);

    box(ctx, v, F.xDeadA, 0, F.xTryA, F.width, '#20603a');
    box(ctx, v, F.xTryB, 0, F.xDeadB, F.width, '#20603a');
    for (let x = 0; x < F.length; x += 5) {
      box(ctx, v, x, 0, x + 5, F.width, (x / 5) % 2 === 0 ? '#2a7a48' : '#26703f');
    }

    if (o.grid) {
      ctx.strokeStyle = 'rgba(255,255,255,.07)';
      ctx.lineWidth = 1;
      for (let x = -10; x <= 110; x += 5) line(ctx, v, x, 0, x, 70);
      for (let y = 0; y <= 70; y += 5) line(ctx, v, -10, y, 110, y);
    }

    ctx.strokeStyle = 'rgba(255,255,255,.92)';
    ctx.lineWidth = lw;
    ctx.setLineDash([]);

    for (const y of [0, F.width]) line(ctx, v, F.xDeadA, y, F.xDeadB, y);
    for (const x of [F.xDeadA, F.xDeadB, F.xTryA, F.xTryB, F.x22A, F.x22B, F.xHalf]) line(ctx, v, x, 0, x, 70);

    ctx.setLineDash([1.0 * v.scale, 0.9 * v.scale]);
    for (const x of [F.x10A, F.x10B, F.x5A, F.x5B]) line(ctx, v, x, 0, x, 70);
    ctx.setLineDash([]);

    ctx.lineWidth = Math.max(1, 0.1 * v.scale);
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    for (const y of [F.y5, F.y15, F.width - F.y15, F.width - F.y5]) ticks(ctx, v, y, 1, 99, 5, 0.55);

    const c = v.toScreen({ x: F.xHalf, y: F.yMid });
    ctx.beginPath();
    ctx.arc(c.x, c.y, Math.max(2, 0.35 * v.scale), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fill();

    goalPosts(ctx, v, F.xTryA, -1);
    goalPosts(ctx, v, F.xTryB, 1);

    if (v.scale > 5) {
      for (const [x, t] of [[22, '22'], [40, '10'], [50, '50'], [60, '10'], [78, '22']]) {
        label(ctx, v, x, 4.2, t, 1.6, 'rgba(255,255,255,.28)');
        label(ctx, v, x, 68.4, t, 1.6, 'rgba(255,255,255,.28)');
      }
    }
  }

  /* ---------- escenario de line-out ---------- */

  function drawLineoutStage(ctx, v, o) {
    const win = VIEWS.lineout;
    const lw = Math.max(1.4, 0.14 * v.scale);

    /* pasto a lo ancho de la ventana, con franjas de corte cada 5 m de cancha */
    for (let x = Math.floor(win.x0 / 5) * 5; x < win.x1 + 5; x += 5) {
      box(ctx, v, x, 0, x + 5, win.y1 + 4, (Math.round(x / 5) % 2 === 0) ? '#2a7a48' : '#26703f');
    }
    /* afuera de la línea de touch */
    box(ctx, v, win.x0 - 5, win.y0 - 4, win.x1 + 5, 0, '#182029');

    /* líneas transversales de la cancha que caigan en la ventana */
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = Math.max(1, 0.1 * v.scale);
    for (const [x, t, dash] of [[F.x22A, '22 m', false], [F.x10A, '10 m', true], [F.xHalf, 'Mitad', false],
                                [F.x10B, '10 m', true], [F.x22B, '22 m', false]]) {
      if (x < win.x0 - 1 || x > win.x1 + 1) continue;
      ctx.setLineDash(dash ? [0.8 * v.scale, 0.7 * v.scale] : []);
      line(ctx, v, x, 0, x, win.y1 + 4);
      tag(ctx, v, x, win.y1 + 1, t, { px: 11, align: 'right', dx: -8, color: 'rgba(255,255,255,.45)', weight: '' });
    }
    ctx.setLineDash([]);

    /* línea de touch */
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = lw * 1.4;
    line(ctx, v, win.x0 - 5, 0, win.x1 + 5, 0);

    /* marcas de un metro sobre la touch: ubican a cada saltador */
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 1; y <= 20; y++) {
      const long = y % 5 === 0;
      const a = v.toScreen({ x: win.x0 + 0.4, y: y }), b = v.toScreen({ x: win.x0 + (long ? 1.8 : 1.1), y: y });
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();

    /* corredor válido: de 5 m a 15 m de la touch */
    box(ctx, v, win.x0 - 5, F.y5, win.x1 + 5, F.y15, 'rgba(255,255,255,.06)');
    ctx.strokeStyle = 'rgba(255,255,255,.92)';
    ctx.lineWidth = lw;
    ctx.setLineDash([1.1 * v.scale, 0.9 * v.scale]);
    line(ctx, v, win.x0 - 5, F.y5, win.x1 + 5, F.y5);
    line(ctx, v, win.x0 - 5, F.y15, win.x1 + 5, F.y15);
    ctx.setLineDash([]);

    /* pasillo de un metro entre las dos filas, en el eje del line-out */
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    line(ctx, v, 50, 0, 50, 20);
    ctx.setLineDash([]);

    if (o.grid) {
      ctx.strokeStyle = 'rgba(255,255,255,.07)';
      ctx.lineWidth = 1;
      for (let y = 0; y <= 22; y++) line(ctx, v, win.x0, y, win.x1, y);
      for (let x = Math.ceil(win.x0); x <= win.x1; x++) line(ctx, v, x, 0, x, 22);
    }

    tag(ctx, v, win.x0 + 0.6, F.y5, '5 m', { px: 13, align: 'center', dy: 14, box: true });
    tag(ctx, v, win.x0 + 0.6, F.y15, '15 m', { px: 13, align: 'center', dy: 14, box: true });
    tag(ctx, v, win.x0 + 0.6, -2.2, 'TOUCH', { px: 11, align: 'center', dy: 14, color: 'rgba(255,255,255,.55)', weight: '' });
    tag(ctx, v, win.x1 - 0.6, 10, 'corredor de line-out', { px: 11, align: 'center', dy: -10, color: 'rgba(255,255,255,.35)', weight: '' });
  }

  function draw(ctx, v, opts) {
    const o = opts || {};
    ctx.save();
    ctx.fillStyle = '#0b0e12';
    ctx.fillRect(0, 0, v.w, v.h);
    if (o.stage === 'lineout') drawLineoutStage(ctx, v, o);
    else drawFullField(ctx, v, o);
    ctx.restore();
  }

  return { F, VIEWS, createView, draw };
})();
