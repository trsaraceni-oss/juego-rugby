/* geom.js - utilidades geometricas en coordenadas de cancha (metros) */
window.RG = window.RG || {};

RG.geom = (function () {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const uid = () => Math.random().toString(36).slice(2, 9);

  function lerpPoint(a, b, t) {
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
  }

  /* longitud acumulada de una polilinea */
  function cumulative(pts) {
    const acc = [0];
    for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + dist(pts[i - 1], pts[i]));
    return acc;
  }

  function pathLength(pts) {
    if (!pts || pts.length < 2) return 0;
    const acc = cumulative(pts);
    return acc[acc.length - 1];
  }

  /* punto sobre la polilinea a fraccion t (0..1) de su longitud de arco */
  function pointOnPath(pts, t) {
    if (!pts || !pts.length) return null;
    if (pts.length === 1) return { x: pts[0].x, y: pts[0].y };
    const acc = cumulative(pts);
    const total = acc[acc.length - 1];
    if (total <= 1e-6) return { x: pts[0].x, y: pts[0].y };
    const target = clamp(t, 0, 1) * total;
    let i = 1;
    while (i < acc.length - 1 && acc[i] < target) i++;
    const seg = acc[i] - acc[i - 1];
    const local = seg <= 1e-6 ? 0 : (target - acc[i - 1]) / seg;
    return lerpPoint(pts[i - 1], pts[i], local);
  }

  /* angulo de la tangente al final de la polilinea (para la punta de flecha) */
  function endAngle(pts) {
    if (!pts || pts.length < 2) return 0;
    const b = pts[pts.length - 1];
    let a = pts[pts.length - 2];
    for (let i = pts.length - 2; i >= 0 && dist(pts[i], b) < 0.4; i--) a = pts[i];
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  function distToSegment(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 <= 1e-9) return dist(p, a);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = clamp(t, 0, 1);
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  function distToPath(p, pts) {
    if (!pts || pts.length === 0) return Infinity;
    if (pts.length === 1) return dist(p, pts[0]);
    let best = Infinity;
    for (let i = 1; i < pts.length; i++) best = Math.min(best, distToSegment(p, pts[i - 1], pts[i]));
    return best;
  }

  /* Ramer-Douglas-Peucker: limpia el trazo a mano alzada */
  function simplify(pts, tol) {
    if (!pts || pts.length < 3) return pts ? pts.slice() : [];
    let maxD = 0, idx = 0;
    const a = pts[0], b = pts[pts.length - 1];
    for (let i = 1; i < pts.length - 1; i++) {
      const d = distToSegment(pts[i], a, b);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD <= tol) return [a, b];
    const left = simplify(pts.slice(0, idx + 1), tol);
    const right = simplify(pts.slice(idx), tol);
    return left.slice(0, -1).concat(right);
  }

  /* suavizado Catmull-Rom para que las rutas no se vean poligonales */
  function smooth(pts, samplesPerSeg) {
    if (!pts || pts.length < 3) return pts ? pts.slice() : [];
    const n = samplesPerSeg || 8;
    const p = [pts[0]].concat(pts, [pts[pts.length - 1]]);
    const out = [];
    for (let i = 1; i < p.length - 2; i++) {
      const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
      for (let s = 0; s < n; s++) {
        const t = s / n, t2 = t * t, t3 = t2 * t;
        out.push({
          x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        });
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  /* Curva entre dos puntos a la que se le dicen las direcciones de salida y de
     llegada: pasa por los dos y empalma con lo que viene antes y después, así el
     recorrido no tiene quiebres. */
  function hermite(p1, p2, m1, m2, t) {
    const t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    return {
      x: h00 * p1.x + h10 * m1.x + h01 * p2.x + h11 * m2.x,
      y: h00 * p1.y + h10 * m1.y + h01 * p2.y + h11 * m2.y
    };
  }

  /* arco lateral para pases y patadas: curva la recta a-b hacia un costado */
  function arcPath(a, b, bulge, samples) {
    const n = samples || 16;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const cx = mx - (dy / len) * bulge, cy = my + (dx / len) * bulge;
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, mt = 1 - t;
      out.push({
        x: mt * mt * a.x + 2 * mt * t * cx + t * t * b.x,
        y: mt * mt * a.y + 2 * mt * t * cy + t * t * b.y
      });
    }
    return out;
  }

  return {
    clamp, lerp, dist, easeInOut, uid, lerpPoint,
    pathLength, pointOnPath, endAngle,
    distToSegment, distToPath, simplify, smooth, arcPath, hermite
  };
})();
