/* ensayo.js - el modo ensayo: la cancha en vivo en la pantalla grande y los
   teléfonos del plantel como joystick.

   El entrenador abre una jugada, se arma una sala con un código de cuatro
   caracteres y cada jugador entra con ese código y toma su número. La pantalla
   del entrenador es la que manda: integra el movimiento de todos y reparte el
   estado; los teléfonos sólo mandan hacia dónde empujan. Así, si se pierde un
   mensaje, nadie queda con una cancha distinta. */
window.RG = window.RG || {};

RG.ensayo = (function () {
  const M = RG.model;
  const G = RG.geom;
  const S = RG.sala;

  const VEL = 7.2;          /* metros por segundo a fondo */
  const ESTADO_MS = 120;    /* cada cuánto el entrenador reparte posiciones */
  const MOV_MS = 120;       /* cada cuánto el teléfono manda su empuje */

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  let raiz = null, canvas = null, ctx = null, view = null, raf = 0, ultimo = 0;
  let volver = null;        /* a dónde se vuelve al salir */

  const sala = {
    rol: null,              /* 'coach' o 'jugador' */
    codigo: null,
    yo: null,               /* id de este dispositivo */
    nombre: '',
    fase: 'espera',         /* espera | corriendo */
    pos: {},                /* id de jugador -> {x, y} */
    vec: {},                /* id de jugador -> {x, y} empuje actual */
    tomados: {},            /* id de jugador -> id de dispositivo */
    conocidos: {},          /* id de dispositivo -> nombre */
    mio: null,              /* id del jugador que maneja este teléfono */
    conexion: 'conectando'
  };

  /* ------------------------------------------------------------ dibujo ---- */

  function propios() { return M.state.players.filter((p) => p.team === 'a'); }

  function escena() {
    const k = M.frameCount() > 1 ? 1 : 0;
    const pos = {};
    for (const p of M.state.players) pos[p.id] = sala.pos[p.id] || M.pos(0, p.id);
    const carrier = M.frame(0).ball.carrier;
    const b = carrier && pos[carrier] ? { x: pos[carrier].x, y: pos[carrier].y, held: 1 } : M.ballStatic(0);
    return {
      k: k, t: 1, pos: pos, ball: b, playing: false,
      options: { onion: false, routes: true, labels: false, grid: false, numbers: true },
      selection: null, hover: null, draft: null
    };
  }

  /* En el teléfono la cancha entera queda diminuta: la cámara acompaña a la
     ficha propia, con un tirón suave para que no vibre. */
  const camara = { x: 50, y: 35, listo: false };
  const VISTA_TEL = { ancho: 46, alto: 30 };

  function seguir() {
    const p = sala.pos[sala.mio];
    if (!p) return;
    if (!camara.listo) { camara.x = p.x; camara.y = p.y; camara.listo = true; }
    camara.x += (p.x - camara.x) * 0.18;
    camara.y += (p.y - camara.y) * 0.18;
    const a = VISTA_TEL.ancho / 2, b = VISTA_TEL.alto / 2;
    view.fit({ x0: camara.x - a, y0: camara.y - b, x1: camara.x + a, y1: camara.y + b });
  }

  function dibujar() {
    if (!ctx) return;
    const pad = $('slPad');
    const conPad = sala.rol === 'jugador' && !!sala.mio;
    if (pad && pad.hidden === conPad) pad.hidden = !conPad;
    const enTelefono = sala.rol === 'jugador' && sala.mio && sala.pos[sala.mio];
    if (enTelefono && M.state.stage !== 'lineout') seguir();
    RG.render.draw(ctx, view, escena());
    if (enTelefono) marcarPropio();
  }

  /* un aro alrededor de la ficha propia: en el teléfono hay que encontrarse rápido */
  function marcarPropio() {
    const s = view.toScreen(sala.pos[sala.mio]);
    const r = RG.render.playerRadius(view) + 7;
    ctx.save();
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /* En el ensayo se corre para cualquier lado, así que se ve la cancha entera y
     no el recuadro de la jugada: si no, el que se va del encuadre desaparece. */
  function encuadrar() {
    ctx = view.resize();
    const lineout = M.state.stage === 'lineout';
    view.swap = lineout;
    view.setBounds(lineout ? RG.field.VIEWS.lineout : null);
    view.fit(lineout ? RG.field.VIEWS.lineout : RG.field.VIEWS.full);
    dibujar();
  }

  /* ------------------------------------------------------------- bucle ---- */

  function bucle(ts) {
    raf = requestAnimationFrame(bucle);
    const dt = Math.min(0.05, (ts - ultimo) / 1000 || 0);
    ultimo = ts;

    if (sala.rol === 'coach' && sala.fase === 'corriendo') {
      for (const id of Object.keys(sala.vec)) {
        const v = sala.vec[id], p = sala.pos[id];
        if (!p || !v || (!v.x && !v.y)) continue;
        /* el teléfono se quedó sin señal o se apagó: la ficha frena sola */
        if (ts - (v.t || 0) > 1200) { v.x = 0; v.y = 0; continue; }
        p.x = G.clamp(p.x + v.x * VEL * dt, -12, 112);
        p.y = G.clamp(p.y + v.y * VEL * dt, -2, 72);
      }
      repartir(ts);
    }
    dibujar();
  }

  function arrancarBucle() {
    cancelAnimationFrame(raf);
    ultimo = performance.now();
    raf = requestAnimationFrame(bucle);
  }

  /* ---------------------------------------------------------- mensajes ---- */

  let ultimoEstado = 0;

  function repartir(ts) {
    if (ts - ultimoEstado < ESTADO_MS) return;
    ultimoEstado = ts;
    const p = {};
    for (const id of Object.keys(sala.pos)) {
      p[id] = [Math.round(sala.pos[id].x * 10) / 10, Math.round(sala.pos[id].y * 10) / 10];
    }
    S.enviar('estado', { f: sala.fase, p: p, t: sala.tomados });
  }

  function recibir(evento, datos) {
    if (sala.rol === 'coach') return recibirCoach(evento, datos);
    return recibirJugador(evento, datos);
  }

  function recibirCoach(evento, d) {
    if (evento === 'hola') {
      sala.conocidos[d.de] = d.nombre || 'Jugador';
      /* la jugada entera va una sola vez, al entrar: después son sólo posiciones */
      S.enviar('jugada', { para: d.de, data: M.serialize(), tomados: sala.tomados, fase: sala.fase });
      lado();
      return;
    }
    if (evento === 'tomar') {
      const p = d.jugador ? propios().find((x) => x.id === d.jugador) : null;
      if (d.jugador && !p) return;
      if (p && sala.tomados[p.id] && sala.tomados[p.id] !== d.de) return;   /* ya lo tiene otro */
      /* suelta el que tenía: sin esto quedaría manejando dos fichas */
      for (const id of Object.keys(sala.tomados)) {
        if (sala.tomados[id] === d.de) { delete sala.tomados[id]; delete sala.vec[id]; }
      }
      if (p) sala.tomados[p.id] = d.de;
      sala.conocidos[d.de] = d.nombre || sala.conocidos[d.de] || 'Jugador';
      S.enviar('estado', { f: sala.fase, p: {}, t: sala.tomados });
      lado();
      return;
    }
    if (evento === 'mov') {
      const id = Object.keys(sala.tomados).find((k) => sala.tomados[k] === d.de);
      if (id) sala.vec[id] = { x: G.clamp(d.x || 0, -1, 1), y: G.clamp(d.y || 0, -1, 1), t: performance.now() };
      return;
    }
    if (evento === 'chau') {
      for (const id of Object.keys(sala.tomados)) {
        if (sala.tomados[id] === d.de) { delete sala.tomados[id]; delete sala.vec[id]; }
      }
      delete sala.conocidos[d.de];
      lado();
    }
  }

  function recibirJugador(evento, d) {
    if (evento === 'jugada') {
      if (d.para && d.para !== sala.yo) return;
      try { M.load(d.data); } catch (e) { return; }
      clearInterval(sala.saludo);
      sala.tieneJugada = true;
      sala.pos = {};
      for (const p of M.state.players) { const q = M.pos(0, p.id); sala.pos[p.id] = { x: q.x, y: q.y }; }
      sala.tomados = d.tomados || {};
      sala.fase = d.fase || 'espera';
      encuadrar();
      lado();
      return;
    }
    if (evento === 'estado') {
      sala.fase = d.f || 'espera';
      sala.tomados = d.t || sala.tomados;
      for (const id of Object.keys(d.p || {})) {
        const q = d.p[id];
        sala.pos[id] = { x: q[0], y: q[1] };
      }
      /* sólo se suelta si el número quedó en manos de otro: mientras el
         entrenador no confirme, el pedido sigue en pie */
      if (sala.mio && sala.tomados[sala.mio] && sala.tomados[sala.mio] !== sala.yo) {
        sala.mio = null;
        camara.listo = false;
        encuadrar();
      }
      lado();
      return;
    }
    if (evento === 'fin') salirSala();
  }

  /* ------------------------------------------------------- panel lateral ---- */

  function direccion() {
    const u = location.origin + location.pathname;
    return u.replace(/^https?:\/\//, '').replace(/index\.html$/, '').replace(/\/$/, '');
  }

  /* El estado llega ocho veces por segundo. Rearmar el panel en cada uno hacía
     que en el teléfono parpadeara y que un toque cayera sobre un botón que se
     estaba reemplazando: se rearma sólo cuando cambió algo que se ve. */
  let firmaPanel = '';

  function lado(forzar) {
    const caja = $('slLado');
    if (!caja) return;
    const firma = [sala.rol, sala.fase, sala.mio, sala.tieneJugada, sala.conexion,
      Object.keys(sala.tomados).sort().map((k) => k + ':' + sala.tomados[k]).join(',')].join('|');
    if (!forzar && firma === firmaPanel) return;
    firmaPanel = firma;

    if (sala.rol === 'coach') {
      const libres = propios().filter((p) => !sala.tomados[p.id]).length;
      caja.innerHTML =
        '<h3>En la cancha</h3>' +
        '<p class="sl-note">Entran desde el teléfono a <b>' + esc(direccion()) + '</b>, tocan ' +
        '«Entrar a una sala», ponen el código y eligen su número. Faltan ' + libres + ' de ' +
        propios().length + '.</p>' +
        (S.enVivo() ? '' : '<p class="sl-note sl-mal">Sin servidor conectado: la sala sólo une ' +
          'pestañas de esta misma máquina.</p>') +
        '<ul class="sl-list">' + propios().map((p) => {
          const quien = sala.tomados[p.id];
          return '<li class="' + (quien ? 'on' : '') + '"><b>' + p.num + '</b>' +
            '<span>' + esc(quien ? (sala.conocidos[quien] || 'Jugador') : 'libre') + '</span></li>';
        }).join('') + '</ul>';
      return;
    }

    /* Hasta que no llega la jugada del entrenador no hay números que mostrar: los
       de esta máquina son de otra jugada y no querría decir nada elegirlos. */
    if (!sala.tieneJugada) {
      caja.innerHTML = '<h3>Esperando al entrenador</h3>' +
        '<p class="sl-note">' + (sala.conexion === 'conectado'
          ? 'La sala <b>' + esc(sala.codigo) + '</b> todavía no está abierta, o el código no es ese. ' +
            'En cuanto el entrenador abra, aparecen los números.'
          : 'Conectando con la sala…') + '</p>' +
        '<button class="btn" id="slOtroCodigo">Probar otro código</button>';
      const otro = $('slOtroCodigo');
      if (otro) otro.addEventListener('click', salirSala);
      return;
    }

    /* teléfono: mientras no tenga número, la grilla para elegirlo */
    if (!sala.mio) {
      caja.innerHTML = '<h3>Elegí tu número</h3>' +
        '<div class="sl-nums">' + propios().map((p) => {
          const tomado = sala.tomados[p.id] && sala.tomados[p.id] !== sala.yo;
          return '<button class="sl-num" data-num="' + p.id + '"' + (tomado ? ' disabled' : '') + '>' +
            p.num + '</button>';
        }).join('') + '</div>';
      caja.querySelectorAll('[data-num]').forEach((b) => b.addEventListener('click', () => {
        sala.mio = b.dataset.num;
        S.enviar('tomar', { de: sala.yo, jugador: sala.mio, nombre: sala.nombre });
        lado();
      }));
      return;
    }

    const p = M.player(sala.mio);
    caja.innerHTML = '<h3>Sos el ' + (p ? p.num : '?') + '</h3>' +
      '<p class="sl-note">' + (sala.fase === 'corriendo'
        ? 'Movete con el círculo de abajo.'
        : 'Esperá que el entrenador arranque.') + '</p>' +
      '<button class="btn" id="slSoltar">Cambiar de número</button>';
    const soltar = $('slSoltar');
    if (soltar) soltar.addEventListener('click', () => {
      S.enviar('tomar', { de: sala.yo, jugador: null, nombre: sala.nombre });
      sala.mio = null;
      camara.listo = false;
      encuadrar();
      lado();
    });
  }

  function acciones() {
    const caja = $('slAcciones');
    if (!caja) return;
    if (sala.rol !== 'coach') { caja.innerHTML = ''; return; }
    caja.innerHTML =
      '<button class="btn" id="slInicio">Posición inicial</button>' +
      '<button class="btn primary" id="slCorrer">' + (sala.fase === 'corriendo' ? 'Parar' : 'Arrancar') + '</button>';
    $('slInicio').addEventListener('click', posicionInicial);
    $('slCorrer').addEventListener('click', () => {
      sala.fase = sala.fase === 'corriendo' ? 'espera' : 'corriendo';
      if (sala.fase === 'espera') sala.vec = {};
      S.enviar('estado', { f: sala.fase, p: {}, t: sala.tomados });
      acciones();
    });
  }

  function posicionInicial() {
    for (const p of M.state.players) {
      const q = M.pos(0, p.id);
      sala.pos[p.id] = { x: q.x, y: q.y };
    }
    sala.vec = {};
    ultimoEstado = 0;
    S.enviar('estado', { f: sala.fase, p: mapaPos(), t: sala.tomados });
    dibujar();
  }

  function mapaPos() {
    const p = {};
    for (const id of Object.keys(sala.pos)) p[id] = [sala.pos[id].x, sala.pos[id].y];
    return p;
  }

  function estadoConexion(e) {
    const antes = sala.conexion;
    sala.conexion = e;
    if (sala.rol === 'jugador' && !sala.tieneJugada && antes !== e) setTimeout(lado, 0);
    const caja = $('slEstado');
    if (!caja) return;
    const texto = {
      conectando: 'conectando…', conectado: S.enVivo() ? 'en vivo' : 'sólo en este navegador',
      reconectando: 'reconectando…', rechazado: 'el servidor rechazó la sala',
      'sin-transporte': 'este navegador no puede abrir salas'
    };
    caja.textContent = texto[e] || e;
    caja.className = 'sl-estado' + (e === 'conectado' ? ' ok' : e === 'conectando' || e === 'reconectando' ? '' : ' mal');
  }

  /* --------------------------------------------------------- el joystick ---- */

  /* El dedo se queda quieto en el borde y el jugador sigue corriendo: por eso el
     empuje se manda a ritmo fijo mientras el dedo está apoyado, no cuando se
     mueve. De paso, si se pierde un mensaje el siguiente lo corrige. */
  function armarPad() {
    const base = $('slPadBase'), knob = $('slPadKnob');
    let activo = null, centro = null, reloj = 0;
    const v = { x: 0, y: 0 };

    function mandar() {
      S.enviar('mov', { de: sala.yo, x: Math.round(v.x * 100) / 100, y: Math.round(v.y * 100) / 100 });
    }

    function apuntar(x, y) {
      const r = base.getBoundingClientRect();
      const rad = r.width / 2;
      let dx = (x - centro.x) / rad, dy = (y - centro.y) / rad;
      const largo = Math.hypot(dx, dy);
      if (largo > 1) { dx /= largo; dy /= largo; }
      /* El empuje se manda en metros de cancha, pero el dedo empuja en la
         pantalla: el escenario de line-out intercambia los ejes para mostrar la
         touch a la izquierda, así que ahí también hay que intercambiarlos. */
      const girado = !!(view && view.swap);
      v.x = girado ? dy : dx;
      v.y = girado ? dx : dy;
      knob.style.transform = 'translate(' + (dx * rad * 0.62) + 'px,' + (dy * rad * 0.62) + 'px)';
    }

    function soltar() {
      activo = null;
      clearInterval(reloj);
      reloj = 0;
      v.x = 0; v.y = 0;
      knob.style.transform = 'translate(0,0)';
      mandar();
    }

    base.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const r = base.getBoundingClientRect();
      centro = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      activo = e.pointerId;
      try { base.setPointerCapture(e.pointerId); } catch (err) { /* el documento alcanza */ }
      apuntar(e.clientX, e.clientY);
      mandar();
      clearInterval(reloj);
      reloj = setInterval(mandar, MOV_MS);
    });

    /* El dedo se va del círculo y el navegador puede quitarle la captura: se
       escucha en el documento para no quedarse con el joystick trabado. */
    document.addEventListener('pointermove', (e) => {
      if (activo === e.pointerId) { e.preventDefault(); apuntar(e.clientX, e.clientY); }
    }, { passive: false });
    document.addEventListener('pointerup', (e) => { if (activo === e.pointerId) soltar(); });
    document.addEventListener('pointercancel', (e) => { if (activo === e.pointerId) soltar(); });
    window.addEventListener('blur', () => { if (activo !== null) soltar(); });
  }

  /* ------------------------------------------------------------- abrir ---- */

  function preparar(rol, codigo) {
    raiz = $('sala');
    canvas = $('cvSala');
    if (!view) { view = RG.field.createView(canvas); armarPad(); }
    sala.rol = rol;
    sala.codigo = codigo;
    sala.yo = S.uid();
    sala.tomados = {};
    sala.conocidos = {};
    sala.vec = {};
    sala.mio = null;
    sala.fase = 'espera';
    sala.tieneJugada = rol === 'coach';
    raiz.hidden = false;
    raiz.classList.toggle('jugador', rol === 'jugador');
    $('home').hidden = true;
    $('app').hidden = true;
    $('slCodigo').innerHTML = 'Código <b>' + esc(codigo) + '</b>';
    $('slJugada').textContent = rol === 'coach' ? M.state.name : '';
    $('slPad').hidden = rol !== 'jugador';
    estadoConexion('conectando');
    acciones();
    firmaPanel = '';
    lado(true);
    S.entrar(codigo, { onMensaje: recibir, onEstado: estadoConexion });
  }

  /* el entrenador: abre la jugada elegida y arma la sala */
  function abrirCoach(playId) {
    if (playId) M.loadPlay(playId);
    const codigo = S.nuevoCodigo();
    preparar('coach', codigo);
    noDormirse();   /* la pantalla grande tampoco se tiene que apagar */
    posicionInicial();
    encuadrar();
    arrancarBucle();
    window.addEventListener('resize', encuadrar);
  }

  /* el jugador: entra con el código y espera la jugada */
  /* La pantalla del teléfono se apaga sola a los treinta segundos y ahí se pierde
     todo: mientras dura el ensayo se pide mantenerla despierta. */
  let despierta = null;
  async function noDormirse() {
    try {
      if (navigator.wakeLock && !despierta) despierta = await navigator.wakeLock.request('screen');
    } catch (e) { /* el navegador no lo permite: se vive con eso */ }
  }
  function soltarPantalla() {
    try { if (despierta) despierta.release(); } catch (e) { /* ya se soltó */ }
    despierta = null;
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && sala.rol) noDormirse();
  });

  function abrirJugador(codigo, nombre) {
    preparar('jugador', String(codigo || '').trim().toUpperCase());
    sala.nombre = nombre || 'Jugador';
    noDormirse();
    encuadrar();
    arrancarBucle();
    window.addEventListener('resize', encuadrar);
    /* El saludo se repite hasta que llega la jugada: si el entrenador todavía no
       abrió la sala, o se perdió el mensaje, el teléfono insiste solo. */
    sala.saludo = setInterval(() => {
      if (sala.conexion === 'conectado') S.enviar('hola', { de: sala.yo, nombre: sala.nombre });
    }, 1500);
    setTimeout(() => { if (sala.conexion === 'conectado') S.enviar('hola', { de: sala.yo, nombre: sala.nombre }); }, 250);
  }

  function salirSala() {
    cancelAnimationFrame(raf);
    clearInterval(sala.saludo);
    soltarPantalla();
    window.removeEventListener('resize', encuadrar);
    if (sala.rol === 'coach') S.enviar('fin', {});
    else S.enviar('chau', { de: sala.yo });
    S.salir();
    if (raiz) raiz.hidden = true;
    if (volver) volver();
  }

  function init(alSalir) {
    volver = alSalir;
    const btn = $('slSalir');
    if (btn) btn.addEventListener('click', salirSala);
  }

  /* asomarse al estado de la sala: lo usan las pruebas y sirve para depurar */
  function estado() {
    return { rol: sala.rol, codigo: sala.codigo, fase: sala.fase, mio: sala.mio,
             tomados: sala.tomados, pos: sala.pos, vec: sala.vec, conexion: sala.conexion };
  }

  return { init, abrirCoach, abrirJugador, salir: salirSala, estado };
})();
