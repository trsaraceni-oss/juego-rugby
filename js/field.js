/* field.js - dimensiones reglamentarias, camara y dibujo de la cancha */
window.RG = window.RG || {};

RG.field = (function () {
  const G = RG.geom;

  /* World Rugby: 100 m entre lineas de try, 70 m de ancho, in-goal de 10 m */
  const F = {
    length: 100, width: 70, inGoal: 10,
    xTryA: 0, xTryB: 100, xDeadA: -10, xDeadB: 110,
    x22A: 22, x22B: 78, x10A: 40, x10B: 60, xHalf: 50, x5A: 5, x5B: 95,
    y5: 5, y15: 15, yMid: 35, postGap: 5.6
  };

  const VIEWS = {
    full: { x0: -13, y0: -3, x1: 113, y1: 73 },
    attack: { x0: 48, y0: -2, x1: 113, y1: 72 },
    mid: { x0: 18, y0: -2, x1: 82, y1: 72 },
    defend: { x0: -13, y0: -2, x1: 52, y1: 72 }
  };

  function createView(canvas) {
    const v = { ox: -13, oy: -3, scale: 8, canvas, w: 1, h: 1 };

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
      const r = rect || VIEWS.full;
      const sx = v.w / (r.x1 - r.x0), sy = v.h / (r.y1 - r.y0);
      v.scale = Math.min(sx, sy);
      v.ox = r.x0 - (v.w / v.scale - (r.x1 - r.x0)) / 2;
      v.oy = r.y0 - (v.h / v.scale - (r.y1 - r.y0)) / 2;
    };

    v.toScreen = function (p) { return { x: (p.x - v.ox) * v.scale, y: (p.y - v.oy) * v.scale }; };
    v.sx = function (x) { return (x - v.ox) * v.scale; };
    v.sy = function (y) { return (y - v.oy) * v.scale; };
    v.toWorld = function (p) { return { x: p.x / v.scale + v.ox, y: p.y / v.scale + v.oy }; };

    v.zoomAt = function (screenPt, factor) {
      const before = v.toWorld(screenPt);
      v.scale = G.clamp(v.scale * factor, 2.2, 60);
      const after = v.toWorld(screenPt);
      v.ox += before.x - after.x;
      v.oy += before.y - after.y;
    };

    v.panPixels = function (dx, dy) { v.ox -= dx / v.scale; v.oy -= dy / v.scale; };

    return v;
  }

  /* ---------- dibujo ---------- */

  function line(ctx, v, x0, y0, x1, y1) {
    ctx.beginPath();
    ctx.moveTo(v.sx(x0), v.sy(y0));
    ctx.lineTo(v.sx(x1), v.sy(y1));
    ctx.stroke();
  }

  /* marcas cortas de 5 m y 15 m, perpendiculares a la linea de touch */
  function ticks(ctx, v, y, from, to, step, half) {
    ctx.beginPath();
    for (let x = from; x <= to + 0.01; x += step) {
      ctx.moveTo(v.sx(x), v.sy(y - half));
      ctx.lineTo(v.sx(x), v.sy(y + half));
    }
    ctx.stroke();
  }

  function goalPosts(ctx, v, x, dir) {
    const g = F.postGap / 2;
    const depth = 1.6 * dir;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = Math.max(2, 0.32 * v.scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(v.sx(x), v.sy(F.yMid - g)); ctx.lineTo(v.sx(x + depth), v.sy(F.yMid - g));
    ctx.moveTo(v.sx(x), v.sy(F.yMid + g)); ctx.lineTo(v.sx(x + depth), v.sy(F.yMid + g));
    ctx.stroke();
    ctx.lineWidth = Math.max(1.5, 0.22 * v.scale);
    ctx.beginPath();
    ctx.moveTo(v.sx(x + depth * 0.55), v.sy(F.yMid - g));
    ctx.lineTo(v.sx(x + depth * 0.55), v.sy(F.yMid + g));
    ctx.stroke();
    ctx.restore();
  }

  function draw(ctx, v, opts) {
    const o = opts || {};
    const lw = Math.max(1, 0.12 * v.scale);

    ctx.save();
    ctx.fillStyle = '#0b0e12';
    ctx.fillRect(0, 0, v.w, v.h);

    /* in-goals */
    ctx.fillStyle = '#20603a';
    ctx.fillRect(v.sx(F.xDeadA), v.sy(0), (F.inGoal) * v.scale, F.width * v.scale);
    ctx.fillRect(v.sx(F.xTryB), v.sy(0), (F.inGoal) * v.scale, F.width * v.scale);

    /* campo de juego con franjas de corte de pasto */
    for (let x = 0; x < F.length; x += 5) {
      ctx.fillStyle = (x / 5) % 2 === 0 ? '#2a7a48' : '#26703f';
      ctx.fillRect(v.sx(x), v.sy(0), 5 * v.scale + 0.6, F.width * v.scale);
    }

    /* grilla opcional */
    if (o.grid) {
      ctx.strokeStyle = 'rgba(255,255,255,.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -10; x <= 110; x += 5) { ctx.moveTo(v.sx(x), v.sy(0)); ctx.lineTo(v.sx(x), v.sy(70)); }
      for (let y = 0; y <= 70; y += 5) { ctx.moveTo(v.sx(-10), v.sy(y)); ctx.lineTo(v.sx(110), v.sy(y)); }
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255,255,255,.92)';
    ctx.lineWidth = lw;
    ctx.setLineDash([]);

    /* perimetro y lineas transversales solidas */
    ctx.strokeRect(v.sx(F.xDeadA), v.sy(0), (F.length + 2 * F.inGoal) * v.scale, F.width * v.scale);
    line(ctx, v, F.xTryA, 0, F.xTryA, 70);
    line(ctx, v, F.xTryB, 0, F.xTryB, 70);
    line(ctx, v, F.x22A, 0, F.x22A, 70);
    line(ctx, v, F.x22B, 0, F.x22B, 70);
    line(ctx, v, F.xHalf, 0, F.xHalf, 70);

    /* lineas de 10 m y de 5 m: discontinuas */
    ctx.setLineDash([1.0 * v.scale, 0.9 * v.scale]);
    line(ctx, v, F.x10A, 0, F.x10A, 70);
    line(ctx, v, F.x10B, 0, F.x10B, 70);
    line(ctx, v, F.x5A, 0, F.x5A, 70);
    line(ctx, v, F.x5B, 0, F.x5B, 70);
    ctx.setLineDash([]);

    /* marcas de 5 m y 15 m paralelas al touch */
    ctx.lineWidth = Math.max(1, 0.1 * v.scale);
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    for (const y of [F.y5, F.y15, F.width - F.y15, F.width - F.y5]) {
      ticks(ctx, v, y, 1, 99, 5, 0.55);
    }

    /* marca central */
    ctx.beginPath();
    ctx.arc(v.sx(F.xHalf), v.sy(F.yMid), Math.max(2, 0.35 * v.scale), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fill();

    goalPosts(ctx, v, F.xTryA, -1);
    goalPosts(ctx, v, F.xTryB, 1);

    /* referencias de distancia */
    if (v.scale > 5) {
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.font = Math.round(Math.max(9, 1.6 * v.scale)) + 'px ui-sans-serif,system-ui,sans-serif';
      ctx.textAlign = 'center';
      const marks = [[22, '22'], [40, '10'], [50, '50'], [60, '10'], [78, '22']];
      for (const [x, t] of marks) {
        ctx.fillText(t, v.sx(x), v.sy(4.2));
        ctx.fillText(t, v.sx(x), v.sy(68.4));
      }
    }
    ctx.restore();
  }

  return { F, VIEWS, createView, draw };
})();
