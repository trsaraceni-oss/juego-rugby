/* mp4.js - arma un MP4 progresivo (no fragmentado) con una sola pista de video.
   MediaRecorder devuelve MP4 fragmentado y de cuadro variable, que se traba en
   WhatsApp y en varios reproductores; esto escribe el índice completo por
   adelantado y una duración fija por cuadro. */
window.RG = window.RG || {};

RG.mp4 = (function () {

  /* ---------- escritura de cajas ---------- */

  const str = (s) => { const a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
  const u8 = (...v) => new Uint8Array(v);
  const u16 = (n) => new Uint8Array([(n >> 8) & 255, n & 255]);
  const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
  const zeros = (n) => new Uint8Array(n);

  function concat(parts) {
    let len = 0;
    for (const p of parts) len += p.length;
    const out = new Uint8Array(len);
    let off = 0;
    for (const p of parts) { out.set(p, off); off += p.length; }
    return out;
  }

  function box(type, ...children) {
    const body = concat(children);
    return concat([u32(body.length + 8), str(type), body]);
  }

  const fullBox = (type, version, flags, ...children) =>
    box(type, u8(version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255), ...children);

  /* matriz identidad de video */
  const MATRIX = concat([u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000)]);

  /* ---------- descripción del códec ---------- */

  function avcC(description) {
    return box('avcC', new Uint8Array(description));
  }

  /* VP9 no trae description: se arma con los valores del perfil que usa Chrome */
  function vpcC(level) {
    return fullBox('vpcC', 1, 0, u8(
      0,                    /* profile 0 */
      level || 31,          /* level 3.1 */
      (8 << 4) | (1 << 1),  /* bitDepth 8, chroma 4:2:0 colocated, rango limitado */
      1, 1, 1               /* colour primaries / transfer / matrix: BT.709 */
    ), u16(0));
  }

  function sampleEntry(kind, w, h, description) {
    const desc = kind === 'avc' ? avcC(description) : vpcC();
    const name = new Uint8Array(32); /* compressorname vacío */
    return box(kind === 'avc' ? 'avc1' : 'vp09',
      zeros(6), u16(1),                    /* reserved + data_reference_index */
      u16(0), u16(0), zeros(12),           /* pre_defined + reserved */
      u16(w), u16(h),
      u32(0x00480000), u32(0x00480000),    /* 72 dpi */
      u32(0), u16(1),                      /* reserved + frame_count */
      name, u16(0x0018), u16(0xffff),      /* depth + pre_defined */
      desc);
  }

  /* ---------- índice de muestras ---------- */

  function stbl(kind, w, h, description, sizes, keyframes, dataOffset) {
    const n = sizes.length;
    const stszBody = new Uint8Array(4 * n);
    const dv = new DataView(stszBody.buffer);
    for (let i = 0; i < n; i++) dv.setUint32(i * 4, sizes[i]);

    const stssBody = new Uint8Array(4 * keyframes.length);
    const dv2 = new DataView(stssBody.buffer);
    keyframes.forEach((k, i) => dv2.setUint32(i * 4, k));

    return box('stbl',
      fullBox('stsd', 0, 0, u32(1), sampleEntry(kind, w, h, description)),
      fullBox('stts', 0, 0, u32(1), u32(n), u32(1)),          /* todas las muestras duran un tick */
      fullBox('stss', 0, 0, u32(keyframes.length), stssBody),
      fullBox('stsc', 0, 0, u32(1), u32(1), u32(n), u32(1)),  /* un solo chunk */
      fullBox('stsz', 0, 0, u32(0), u32(n), stszBody),
      fullBox('stco', 0, 0, u32(1), u32(dataOffset)));
  }

  function moov(kind, w, h, description, sizes, keyframes, fps, dataOffset) {
    const n = sizes.length;
    const durMs = Math.round(n * 1000 / fps);
    return box('moov',
      fullBox('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(durMs),
        u32(0x00010000), u16(0x0100), u16(0), u32(0), u32(0), MATRIX, zeros(24), u32(2)),
      box('trak',
        fullBox('tkhd', 0, 7, u32(0), u32(0), u32(1), u32(0), u32(durMs),
          u32(0), u32(0), u16(0), u16(0), u16(0), u16(0), MATRIX,
          u32(w * 65536), u32(h * 65536)),
        box('mdia',
          fullBox('mdhd', 0, 0, u32(0), u32(0), u32(fps), u32(n), u16(0x55c4), u16(0)),
          fullBox('hdlr', 0, 0, u32(0), str('vide'), zeros(12), str('VideoHandler ')),
          box('minf',
            fullBox('vmhd', 0, 1, u16(0), u16(0), u16(0), u16(0)),
            box('dinf', fullBox('dref', 0, 0, u32(1), fullBox('url ', 0, 1))),
            stbl(kind, w, h, description, sizes, keyframes, dataOffset)))));
  }

  /* ---------- API ---------- */

  /* samples: [{ data: Uint8Array, key: bool }] en orden de reproducción */
  function build(opts) {
    const kind = opts.codec === 'avc' ? 'avc' : 'vp9';
    const samples = opts.samples;
    if (!samples || !samples.length) throw new Error('No hay cuadros para escribir');
    if (kind === 'avc' && !opts.description) throw new Error('Falta la descripción del códec');

    const sizes = samples.map((s) => s.data.length);
    const keyframes = [];
    samples.forEach((s, i) => { if (s.key) keyframes.push(i + 1); });
    if (!keyframes.length) keyframes.push(1);

    const ftyp = box('ftyp', str('isom'), u32(512), str('isom'), str('iso2'),
      str(kind === 'avc' ? 'avc1' : 'mp41'), str('mp41'));

    /* el offset de los datos depende del tamaño de moov, que depende de las
       tablas: se arma una vez para medirlo y otra con el offset definitivo */
    let head = moov(kind, opts.width, opts.height, opts.description, sizes, keyframes, opts.fps, 0);
    const dataOffset = ftyp.length + head.length + 8;
    head = moov(kind, opts.width, opts.height, opts.description, sizes, keyframes, opts.fps, dataOffset);

    const payload = concat(samples.map((s) => s.data));
    const mdat = concat([u32(payload.length + 8), str('mdat'), payload]);
    return new Blob([ftyp, head, mdat], { type: 'video/mp4' });
  }

  return { build };
})();
