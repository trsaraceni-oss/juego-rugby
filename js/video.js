/* video.js - graba la animación de la jugada y devuelve un archivo para compartir */
window.RG = window.RG || {};

RG.video = (function () {
  const M = RG.model;
  const G = RG.geom;

  const SIZE = { w: 1280, h: 720 };
  const HOLD_IN = 0.9;    /* segundos congelado en la posición inicial */
  const HOLD_OUT = 1.4;   /* y en la final, para que se lea el resultado */

  /* Chrome graba MP4 en versiones recientes; si no, cae a WebM (Android y
     computadora lo abren igual, iPhone y WhatsApp prefieren MP4) */
  const CANDIDATES = [
    { mime: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' }
  ];

  function pickFormat() {
    if (typeof MediaRecorder === 'undefined') return null;
    for (const c of CANDIDATES) {
      try { if (MediaRecorder.isTypeSupported(c.mime)) return c; } catch (e) { /* sigue */ }
    }
    return null;
  }

  function supported() {
    const cv = document.createElement('canvas');
    return !!(pickFormat() && typeof cv.captureStream === 'function');
  }

  /* marco: nombre de la jugada, nota del momento y barra de avance */
  function overlay(ctx, w, h, title, note, progress) {
    const pad = Math.round(w * 0.028);
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, h * 0.16);
    grad.addColorStop(0, 'rgba(8,11,15,.78)');
    grad.addColorStop(1, 'rgba(8,11,15,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h * 0.16);

    ctx.fillStyle = '#ffffff';
    ctx.font = '600 ' + Math.round(h * 0.045) + 'px ui-sans-serif,system-ui,sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, pad, pad * 0.8);

    if (note) {
      const fs = Math.round(h * 0.036);
      ctx.font = '500 ' + fs + 'px ui-sans-serif,system-ui,sans-serif';
      const tw = ctx.measureText(note).width;
      const bh = fs * 1.9;
      ctx.fillStyle = 'rgba(8,11,15,.72)';
      ctx.fillRect(pad, h - pad - bh, tw + pad, bh);
      ctx.fillStyle = '#e6ebf2';
      ctx.textBaseline = 'middle';
      ctx.fillText(note, pad + pad * 0.5, h - pad - bh / 2);
    }

    const bar = Math.round(h * 0.008);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(0, h - bar, w, bar);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(0, h - bar, w * G.clamp(progress, 0, 1), bar);
    ctx.restore();
  }

  function frameAt(ctx, v, time, options) {
    const s = M.sampleAt(time);
    RG.render.draw(ctx, v, {
      k: s.k, t: s.t, pos: s.pos, ball: s.ball,
      playing: true, options: options, selection: null, hover: null, draft: null
    });
    return s;
  }

  /* placa con el nombre de la jugada, entre una y otra */
  function titleCard(ctx, w, h, title, subtitle, index, count) {
    ctx.save();
    ctx.fillStyle = '#0f1216';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(0, h / 2 - h * 0.11, w * 0.012, h * 0.22);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if (count > 1) {
      ctx.fillStyle = '#8b97a8';
      ctx.font = '600 ' + Math.round(h * 0.035) + 'px ui-sans-serif,system-ui,sans-serif';
      ctx.fillText(index + ' de ' + count, w * 0.06, h / 2 - h * 0.07);
    }
    ctx.fillStyle = '#e6ebf2';
    ctx.font = '600 ' + Math.round(h * 0.075) + 'px ui-sans-serif,system-ui,sans-serif';
    ctx.fillText(title, w * 0.06, h / 2 + h * 0.02);
    if (subtitle) {
      ctx.fillStyle = '#8b97a8';
      ctx.font = '500 ' + Math.round(h * 0.038) + 'px ui-sans-serif,system-ui,sans-serif';
      ctx.fillText(subtitle, w * 0.06, h / 2 + h * 0.09);
    }
    ctx.restore();
  }

  function prepareView(cv, app) {
    const v = RG.field.createView(cv);
    v.w = SIZE.w; v.h = SIZE.h;
    v.swap = M.state.stage === 'lineout';
    v.setBounds(M.state.stage === 'lineout' ? RG.field.VIEWS.lineout : null);
    v.fit(app.playBox());
    return v;
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* espera hasta `seconds`, dibujando en cada cuadro */
  function playFor(seconds, drawFn) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      (function tick() {
        const elapsed = (performance.now() - t0) / 1000;
        drawFn(Math.min(elapsed, seconds));
        if (elapsed < seconds) requestAnimationFrame(tick);
        else resolve();
      })();
    });
  }

  /* Graba en tiempo real: es lo único que garantiza el ritmo correcto del
     archivo. `plays` vacío = la jugada que está abierta; si trae ids de
     jugadas guardadas, las encadena con una placa de título entre cada una. */
  async function record(app, onProgress, plays) {
    const fmt = pickFormat();
    if (!fmt) throw new Error('Este navegador no puede grabar video');

    const lista = (plays && plays.length) ? plays.slice() : [null];
    const backup = (plays && plays.length) ? M.serialize() : null;

    const cv = document.createElement('canvas');
    cv.width = SIZE.w; cv.height = SIZE.h;
    const ctx = cv.getContext('2d');

    const stream = cv.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: fmt.mime, videoBitsPerSecond: 4500000 });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((res) => { rec.onstop = res; });

    /* estimación para la barra de avance */
    const CARD = 1.3;
    let done = 0;
    const options = Object.assign({}, app.options, { onion: false });

    rec.start();
    try {
      for (let i = 0; i < lista.length; i++) {
        if (lista[i]) M.loadPlay(lista[i]);
        const title = M.state.name || 'Jugada';
        const total = M.totalDuration();
        if (total <= 0) continue;
        const v = prepareView(cv, app);
        const tramo = (lista.length > 1 ? CARD : 0) + HOLD_IN + total + HOLD_OUT;
        const base = done;
        const largoTotal = lista.length * (CARD + 6);

        if (lista.length > 1) {
          await playFor(CARD, () => {
            titleCard(ctx, SIZE.w, SIZE.h, title, M.frame(0).note || '', i + 1, lista.length);
          });
        }
        await playFor(HOLD_IN + total + HOLD_OUT, (elapsed) => {
          const time = G.clamp(elapsed - HOLD_IN, 0, total);
          const s = frameAt(ctx, v, time, options);
          overlay(ctx, SIZE.w, SIZE.h, title, M.frame(s.k).note || M.frame(0).note || '',
            (base + CARD + elapsed) / largoTotal);
          if (onProgress) onProgress(G.clamp((base + CARD + elapsed) / largoTotal, 0, 0.99));
        });
        done += tramo;
      }
    } finally {
      if (backup) M.load(backup);
      await wait(120);
      if (rec.state !== 'inactive') rec.stop();
      await stopped;
      stream.getTracks().forEach((t) => t.stop());
    }
    if (onProgress) onProgress(1);
    return { blob: new Blob(chunks, { type: fmt.mime }), ext: fmt.ext, mime: fmt.mime };
  }

  return { record, supported, pickFormat, SIZE };
})();
