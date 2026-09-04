/* video.js - graba la animación de la jugada y devuelve un archivo para compartir.
   Prefiere WebCodecs + muxer propio de MP4: da cuadro fijo (30 fps) y un archivo
   progresivo, que es lo que reproducen bien WhatsApp y los reproductores de
   escritorio. MediaRecorder queda como respaldo, pero produce MP4 fragmentado
   y de cuadro variable, que se traba en varios reproductores. */
window.RG = window.RG || {};

RG.video = (function () {
  const M = RG.model;
  const G = RG.geom;

  const SIZE = { w: 1280, h: 720 };
  const FPS = 30;
  const BITRATE = 4500000;
  const HOLD_IN = 0.9;    /* segundos congelado en la posición inicial */
  const HOLD_OUT = 1.4;   /* y en la final, para que se lea el resultado */
  const CARD = 1.4;       /* placa con el nombre, al encadenar varias jugadas */

  const AVC = ['avc1.42001f', 'avc1.42E01E', 'avc1.4d401f', 'avc1.640028'];

  const MR_CANDIDATES = [
    { mime: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' }
  ];

  /* ---------- disponibilidad ---------- */

  async function pickCodec(forced) {
    if (typeof VideoEncoder === 'undefined') return null;
    const lista = forced ? [forced] : AVC;
    for (const codec of lista) {
      try {
        const r = await VideoEncoder.isConfigSupported({ codec: codec, width: SIZE.w, height: SIZE.h, bitrate: BITRATE, framerate: FPS });
        if (r && r.supported) return codec;
      } catch (e) { /* sigue */ }
    }
    return null;
  }

  function pickFormat() {
    if (typeof MediaRecorder === 'undefined') return null;
    for (const c of MR_CANDIDATES) {
      try { if (MediaRecorder.isTypeSupported(c.mime)) return c; } catch (e) { /* sigue */ }
    }
    return null;
  }

  function supported() {
    const cv = document.createElement('canvas');
    return !!(pickFormat() || typeof VideoEncoder !== 'undefined') && typeof cv.getContext === 'function';
  }

  /* ---------- dibujo ---------- */

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

  function viewFor(cv, app) {
    const v = RG.field.createView(cv);
    v.w = SIZE.w; v.h = SIZE.h;
    v.swap = M.state.stage === 'lineout';
    v.setBounds(M.state.stage === 'lineout' ? RG.field.VIEWS.lineout : null);
    v.fit(app.playBox());
    return v;
  }

  /* ---------- plan de la grabación ---------- */

  /* Recorre las jugadas una vez para medirlas. Devuelve los tramos en orden y la
     duración total, con la jugada abierta restaurada al final. */
  function plan(app, plays) {
    const ids = (plays && plays.length) ? plays.slice() : [null];
    const backup = ids.length > 1 || ids[0] ? M.serialize() : null;
    const items = [];
    for (const id of ids) {
      if (id && !M.loadPlay(id)) continue;
      items.push({
        id: id, name: M.state.name || 'Jugada', note: M.frame(0).note || '',
        dur: M.totalDuration(), card: ids.length > 1 ? CARD : 0
      });
    }
    if (backup) M.load(backup);
    const total = items.reduce((s, it) => s + it.card + HOLD_IN + it.dur + HOLD_OUT, 0);
    return { items: items, total: total, backup: backup };
  }

  /* dibuja un instante del plan; devuelve false cuando el plan terminó */
  function makePainter(app, cv, ctx, p) {
    const options = Object.assign({}, app.options, { onion: false });
    let idx = -1, base = 0, view = null;

    return function paint(t) {
      /* ubicar el tramo que corresponde a este instante */
      let acc = 0, i = 0;
      for (; i < p.items.length; i++) {
        const largo = p.items[i].card + HOLD_IN + p.items[i].dur + HOLD_OUT;
        if (t < acc + largo || i === p.items.length - 1) break;
        acc += largo;
      }
      const it = p.items[i];
      if (!it) return false;
      if (i !== idx) {
        idx = i; base = acc;
        if (it.id) M.loadPlay(it.id);
        view = viewFor(cv, app);
      }
      const local = t - base;
      if (local < it.card) {
        titleCard(ctx, SIZE.w, SIZE.h, it.name, it.note, i + 1, p.items.length);
        return true;
      }
      const time = G.clamp(local - it.card - HOLD_IN, 0, it.dur);
      const s = M.sampleAt(time);
      RG.render.draw(ctx, view, {
        k: s.k, t: s.t, pos: s.pos, ball: s.ball,
        playing: true, options: options, selection: null, hover: null, draft: null
      });
      overlay(ctx, SIZE.w, SIZE.h, it.name, M.frame(s.k).note || it.note, t / p.total);
      return true;
    };
  }

  /* ---------- grabación con WebCodecs (cuadro fijo, MP4 progresivo) ---------- */

  async function recordWebCodecs(app, onProgress, plays, codec) {
    const cv = document.createElement('canvas');
    cv.width = SIZE.w; cv.height = SIZE.h;
    const ctx = cv.getContext('2d', { alpha: false });

    const p = plan(app, plays);
    if (!p.items.length || p.total <= 0) throw new Error('No hay nada para grabar');

    const esAvc = codec.indexOf('avc') === 0;
    const samples = [];
    let description = null, encError = null;

    const encoder = new VideoEncoder({
      output: (chunk, meta) => {
        if (!description && meta && meta.decoderConfig && meta.decoderConfig.description) {
          description = new Uint8Array(meta.decoderConfig.description);
        }
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        samples.push({ data: data, key: chunk.type === 'key' });
      },
      error: (e) => { encError = e; }
    });
    const config = { codec: codec, width: SIZE.w, height: SIZE.h, bitrate: BITRATE, framerate: FPS, latencyMode: 'quality' };
    if (esAvc) config.avc = { format: 'avc' };   /* longitudes al frente, como pide el MP4 */
    encoder.configure(config);

    const paint = makePainter(app, cv, ctx, p);
    const totalFrames = Math.max(1, Math.round(p.total * FPS));
    const dur = Math.round(1000000 / FPS);

    try {
      for (let i = 0; i < totalFrames; i++) {
        if (encError) throw encError;
        paint(i / FPS);
        const frame = new VideoFrame(cv, { timestamp: Math.round(i * 1000000 / FPS), duration: dur });
        encoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
        frame.close();
        if (encoder.encodeQueueSize > 6) await new Promise((r) => setTimeout(r, 6));
        if (i % 10 === 0) {
          if (onProgress) onProgress(i / totalFrames);
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      await encoder.flush();
    } finally {
      if (p.backup) M.load(p.backup);
      try { encoder.close(); } catch (e) { /* ya cerrado */ }
    }
    if (encError) throw encError;
    const blob = RG.mp4.build({
      codec: esAvc ? 'avc' : 'vp9', width: SIZE.w, height: SIZE.h,
      fps: FPS, samples: samples, description: description
    });
    if (onProgress) onProgress(1);
    return { blob: blob, ext: 'mp4', mime: 'video/mp4', engine: 'webcodecs' };
  }

  /* ---------- respaldo: MediaRecorder en tiempo real ---------- */

  async function recordMediaRecorder(app, onProgress, plays) {
    const fmt = pickFormat();
    if (!fmt) throw new Error('Este navegador no puede grabar video');

    const cv = document.createElement('canvas');
    cv.width = SIZE.w; cv.height = SIZE.h;
    const ctx = cv.getContext('2d', { alpha: false });

    const p = plan(app, plays);
    if (!p.items.length || p.total <= 0) throw new Error('No hay nada para grabar');

    const stream = cv.captureStream(FPS);
    const rec = new MediaRecorder(stream, { mimeType: fmt.mime, videoBitsPerSecond: BITRATE });
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((res) => { rec.onstop = res; });

    const paint = makePainter(app, cv, ctx, p);
    rec.start();
    try {
      await new Promise((resolve) => {
        const t0 = performance.now();
        (function tick() {
          const t = (performance.now() - t0) / 1000;
          paint(Math.min(t, p.total));
          if (onProgress) onProgress(G.clamp(t / p.total, 0, 0.99));
          if (t < p.total) requestAnimationFrame(tick);
          else resolve();
        })();
      });
    } finally {
      if (p.backup) M.load(p.backup);
      await new Promise((r) => setTimeout(r, 150));
      if (rec.state !== 'inactive') rec.stop();
      await stopped;
      stream.getTracks().forEach((t) => t.stop());
    }
    if (onProgress) onProgress(1);
    return { blob: new Blob(chunks, { type: fmt.mime }), ext: fmt.ext, mime: fmt.mime, engine: 'mediarecorder' };
  }

  /* Antes de entregar el archivo se comprueba que el navegador pueda abrirlo:
     si algo salió mal, se prefiere el respaldo a bajar un video roto. */
  function playable(blob) {
    return new Promise((resolve) => {
      let listo = false;
      const url = URL.createObjectURL(blob);
      const el = document.createElement('video');
      el.preload = 'metadata';
      el.muted = true;
      const done = (ok) => { if (listo) return; listo = true; URL.revokeObjectURL(url); resolve(ok); };
      el.onloadedmetadata = () => done(isFinite(el.duration) && el.duration > 0.2 && el.videoWidth > 0);
      el.onerror = () => done(false);
      setTimeout(() => done(false), 5000);
      el.src = url;
    });
  }

  /* ---------- entrada única ---------- */

  async function record(app, onProgress, plays, opts) {
    const o = opts || {};
    if (!o.forceMediaRecorder) {
      const codec = await pickCodec(o.codec);
      if (codec) {
        try {
          const out = await recordWebCodecs(app, onProgress, plays, codec);
          if (await playable(out.blob)) return out;
          if (o.strict) throw new Error('El archivo generado no se pudo abrir');
        } catch (e) { if (o.strict) throw e; /* si falla, se usa el respaldo */ }
      }
    }
    return recordMediaRecorder(app, onProgress, plays);
  }

  return { record, supported, pickFormat, pickCodec, SIZE, FPS };
})();
