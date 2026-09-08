/* home.js - la puerta de entrada: entrar con el mail, gestionar el club y sus
   equipos, y arrancar a trabajar. La pizarra queda del otro lado, para cuando
   hay algo que dibujar. */
window.RG = window.RG || {};

RG.home = (function () {
  const C = RG.cloud;
  const M = RG.model;
  const SIN_CUENTA = 'rugbyboard.sinCuenta';
  const CODIGO_PENDIENTE = 'rugbyboard.codigoPendiente';

  let app = null, root = null, pendiente = null, cargando = true, errorCodigo = null;
  let estado = { user: null, clubs: [], club: null, teams: [], members: [] };

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  /* ------------------------------------------------------------- datos ---- */

  async function refrescar() {
    estado.user = await C.session();
    estado.clubs = estado.user ? await C.myClubs() : [];

    /* el código que puso al entrar: se aplica al volver del link */
    const codigo = estado.user ? localStorage.getItem(CODIGO_PENDIENTE) : null;
    if (codigo) {
      localStorage.removeItem(CODIGO_PENDIENTE);
      try {
        const club = await C.joinClub(codigo);
        localStorage.setItem('rugbyboard.club', club.id);
        estado.clubs = await C.myClubs();
      } catch (e) { errorCodigo = e && e.message ? e.message : 'No se pudo usar el código'; }
    }

    const guardado = localStorage.getItem('rugbyboard.club');
    estado.club = estado.clubs.find((c) => c.id === guardado) || estado.clubs[0] || null;
    estado.teams = estado.club ? await C.teams(estado.club.id) : [];
    estado.members = estado.club ? await C.members(estado.club.id) : [];
    if (estado.club) localStorage.setItem('rugbyboard.club', estado.club.id);

    /* los set ups y las jugadas pasan a ser los de la cuenta */
    if (RG.sync) await RG.sync.cuenta(estado.user, estado.club);
  }

  const soyDueño = () => !!(estado.club && estado.club.role === 'owner');

  function equipoActual() {
    const id = localStorage.getItem('rugbyboard.team');
    return estado.teams.find((t) => t.id === id) || estado.teams[0] || null;
  }

  const ETIQUETA = { club: 'del club', global: 'de la app', personal: '' };

  function misJugadas() { return M.listPlays(); }

  /* ---------------------------------------------------------- pantallas ---- */

  function vistaCargando() {
    return '<div class="hm-card hm-center"><p class="hm-lead">Cargando…</p></div>';
  }

  function vistaEntrar() {
    return '' +
      '<div class="hm-hero">' +
      '<h1>Rugby Board</h1>' +
      '<p class="hm-lead">La pizarra del club: armá los set ups de partido, dibujá las jugadas, ' +
      'animalas y mandáselas al plantel en video.</p>' +
      '</div>' +
      '<div class="hm-card hm-narrow">' +
      '<h2>Entrá con tu mail</h2>' +
      '<p class="hm-note">Sin contraseña: te llega un link y entrás. Tus set ups y jugadas quedan ' +
      'en tu cuenta y los abrís desde cualquier dispositivo.</p>' +
      '<div id="hmForm" class="hm-form">' +
      '<label>Mail<input type="email" id="hmEmail" placeholder="entrenador@club.com" autocomplete="email"></label>' +
      '<label>Nombre <span class="hm-opt">(la primera vez)</span><input type="text" id="hmName" placeholder="Cómo te ven en el club"></label>' +
      '<label>Código del club <span class="hm-opt">(si te invitaron)</span>' +
      '<input type="text" id="hmJoinCode" placeholder="A1B2C3" maxlength="8" autocapitalize="characters"></label>' +
      '<button class="btn primary big" id="hmGo">Entrar</button>' +
      '</div>' +
      (C.configured() ? '' : '<p class="hm-warn">Sin servidor conectado: la cuenta se simula en este navegador.</p>') +
      '<p class="hm-alt"><button class="hm-link" id="hmSkip">Entrar sin cuenta y trabajar en esta máquina</button></p>' +
      '<p class="hm-alt"><button class="hm-link" id="hmJugador">Soy jugador: entrar a una sala con el código</button></p>' +
      '</div>';
  }

  function vistaJugador() {
    return '' +
      '<div class="hm-hero"><h1>Entrar a la sala</h1>' +
      '<p class="hm-lead">Pedile el código al entrenador: son cuatro caracteres que están en la ' +
      'pantalla grande. No hace falta cuenta.</p></div>' +
      '<div class="hm-card hm-narrow">' +
      '<div id="hmSalaForm" class="hm-form">' +
      '<label>Código de la sala<input type="text" id="hmSalaCodigo" placeholder="AB3K" maxlength="6" ' +
      'autocapitalize="characters" autocomplete="off"></label>' +
      '<label>Tu nombre<input type="text" id="hmSalaNombre" placeholder="Cómo te ven en el equipo"></label>' +
      '<button class="btn primary big" id="hmSalaGo">Entrar</button>' +
      '</div>' +
      (RG.sala && RG.sala.configurado() ? ''
        : '<p class="hm-warn">Sin servidor conectado la sala sólo une pestañas de esta misma ' +
          'máquina: sirve para probarla, no para el plantel.</p>') +
      '<p class="hm-alt"><button class="hm-link" id="hmSalaVolver">Volver</button></p>' +
      '</div>';
  }

  function vistaPendiente() {
    return '' +
      '<div class="hm-card hm-narrow hm-center">' +
      '<h2>Revisá tu mail</h2>' +
      '<p class="hm-lead">Te mandamos un link a <b>' + esc(pendiente) + '</b>. Abrilo desde este ' +
      'mismo dispositivo y volvés a la app con tu cuenta lista.</p>' +
      (localStorage.getItem(CODIGO_PENDIENTE)
        ? '<p class="hm-note">Cuando vuelvas te sumamos al club del código <b>' +
          esc(localStorage.getItem(CODIGO_PENDIENTE)) + '</b>.</p>' : '') +
      '<p class="hm-note">Si no llega en un par de minutos, mirá en spam. El link sirve una sola vez.</p>' +
      '<button class="btn" id="hmBack">Usar otro mail</button>' +
      '</div>';
  }

  function vistaSinClub() {
    return '' +
      '<div class="hm-hero"><h1>Hola, ' + esc(estado.user.name) + '</h1>' +
      '<p class="hm-lead">Falta el club. Creá el tuyo y invitá al resto del cuerpo técnico, o ' +
      'sumate a uno con el código que te pasen.</p></div>' +
      '<div class="hm-cols">' +
      '<div id="hmNewClub" class="hm-card">' +
      '<h2>Crear un club</h2>' +
      '<label>Nombre del club<input type="text" id="hmClubName" placeholder="Club Atlético Sur"></label>' +
      '<label>Primer equipo<input type="text" id="hmTeamName" value="Primera"></label>' +
      '<button class="btn primary" id="hmCreate">Crear club</button>' +
      '</div>' +
      '<div id="hmJoin" class="hm-card">' +
      '<h2>Sumarme a uno</h2>' +
      '<label>Código de invitación<input type="text" id="hmCode" placeholder="A1B2C3" maxlength="8" autocapitalize="characters"></label>' +
      '<button class="btn" id="hmJoinGo">Sumarme</button>' +
      '</div>' +
      '</div>';
  }

  /* Un desplegable en vez de una lista: con veinte jugadas la pantalla se hacía
     larguísima, y los set ups de partido tienen que estar siempre a mano. */
  function listaJugadas() {
    const js = misJugadas();
    if (!js.length) return '<p class="hm-empty">Todavía no guardaste jugadas.</p>';
    return '<div class="hm-pick">' +
      '<select id="hmPlaySel">' + js.map((j) =>
        '<option value="' + esc(j.id) + '">' + esc(j.name) +
        (ETIQUETA[j.origen] ? ' · ' + ETIQUETA[j.origen] : '') + '</option>').join('') +
      '</select><button class="btn" id="hmPlayGo">Abrir</button>' +
      '<button class="btn" id="hmPlayEnsayo" title="Abrir la sala en vivo con esta jugada">Ensayar</button></div>';
  }

  /* Acá van todos: las situaciones de partido que trae la app y las versiones
     propias, del club o publicadas, con la marca de dónde sale cada una. */
  const ORDEN_SETUPS = ['Mis set ups', 'Del club', 'De la app', 'Salidas', 'Scrums', 'Line-outs', 'Estructuras'];
  const MARCA = { personal: ' ✎', club: ' ★', global: ' ◆' };

  function listaSetups() {
    const ss = M.formationList().filter((f) => f.group !== 'Crear set up');
    const grupo = (g) => ss.filter((f) => f.group === g)
      .map((f) => '<option value="' + esc(f.key) + '">' + esc(f.name) + (MARCA[f.origen] || '') + '</option>')
      .join('');
    return '<div class="hm-pick">' +
      '<select id="hmSetupSel">' + ORDEN_SETUPS.map((g) => {
        const items = grupo(g);
        return items ? '<optgroup label="' + g + '">' + items + '</optgroup>' : '';
      }).join('') + '</select>' +
      '<button class="btn" id="hmSetupGo">Abrir</button></div>' +
      '<p class="hm-note">✎ tu versión · ★ del club · ◆ de la app</p>';
  }

  function vistaInicio() {
    const eq = equipoActual();
    const sinCuenta = !estado.user;
    return '' +
      '<div class="hm-hero hm-row">' +
      '<div>' +
      '<h1>' + esc(sinCuenta ? 'Rugby Board' : estado.club.name) + '</h1>' +
      '<p class="hm-lead">' + (sinCuenta
        ? 'Estás trabajando sin cuenta: todo se guarda en este navegador.'
        : esc(estado.user.name) + ' · ' + (estado.club.role === 'owner' ? 'dueño del club'
          : estado.club.role === 'admin' ? 'admin del club' : 'entrenador') +
          (eq ? ' · ' + esc(eq.name) : '')) + '</p>' +
      '</div>' +
      '<div class="hm-actions-top">' +
      (sinCuenta ? '<button class="btn" id="hmLogin">Entrar con mi cuenta</button>'
        : '<button class="btn" id="hmOut">Salir</button>') +
      '</div>' +
      '</div>' +

      '<div class="hm-start">' +
      '<button class="hm-big" id="hmNewPlay"><b>Nueva jugada</b>' +
      '<span>Elegí la situación y dibujá el movimiento, frame por frame</span></button>' +
      '<button class="hm-big alt" id="hmNewSetup"><b>Nueva situación</b>' +
      '<span>Cancha vacía para armar un set up desde cero y guardarlo</span></button>' +
      '<button class="hm-big alt" id="hmSala"><b>Modo ensayo</b>' +
      '<span>La cancha en la pantalla grande y el plantel moviendo su ficha desde el teléfono</span></button>' +
      '</div>' +
      '<p class="hm-alt"><button class="hm-link" id="hmJugador">Entrar a una sala como jugador</button></p>' +

      '<div class="hm-cols">' +

      '<div class="hm-card">' +
      '<h2>Jugadas</h2>' + listaJugadas() +
      '<h2>Set ups</h2>' + listaSetups() +
      '<p class="hm-note">' + (sinCuenta
        ? 'Se guardan en este navegador. Al entrar con tu cuenta se suben solos.'
        : esc(estadoSync())) + '</p>' +
      '</div>' +

      (sinCuenta ? '' :
      '<div class="hm-card">' +
      '<h2>Mi club</h2>' +
      '<h3>Equipos</h3>' +
      '<ul class="hm-list">' +
      (estado.teams.length ? estado.teams.map((t) =>
        '<li class="hm-team-row">' +
        '<button class="hm-item' + (eq && t.id === eq.id ? ' on' : '') + '" data-club-team="' + t.id + '">' + esc(t.name) + '</button>' +
        '<button class="hm-x" data-del-team="' + t.id + '" title="Sacar este equipo">✕</button>' +
        '</li>').join('') : '<li class="hm-empty">Todavía no hay equipos</li>') +
      '</ul>' +
      '<div id="hmNewTeam" class="hm-inline">' +
      '<input type="text" id="hmTeamNew" placeholder="M19, Femenino…">' +
      '<button class="btn sm" id="hmAddTeam">Agregar</button>' +
      '</div>' +
      '<h3>Cuerpo técnico</h3>' +
      '<ul class="hm-list">' +
      estado.members.map((m) => '<li class="hm-member"><span>' + esc(m.name) +
        (m.me ? '<span class="hm-tag">vos</span>' : '') +
        (m.role === 'owner' ? '<span class="hm-tag">dueño</span>' : '') +
        (m.role === 'admin' ? '<span class="hm-tag">admin del club</span>' : '') +
        '</span><small>' + esc(m.email) + '</small>' +
        (soyDueño() && !m.me && m.role !== 'owner'
          ? '<button class="hm-role" data-role="' + esc(m.id) + '" data-to="' +
            (m.role === 'admin' ? 'coach' : 'admin') + '">' +
            (m.role === 'admin' ? 'Sacar admin' : 'Hacer admin') + '</button>'
          : '') +
        '</li>').join('') +
      '</ul>' +
      (soyDueño() ? '<p class="hm-note">Un admin del club deja los set ups y las jugadas base ' +
        'que ven todos los entrenadores del club.</p>' : '') +
      '<h3>Invitar</h3>' +
      '<p class="hm-code" id="hmCodeBox" title="Click para copiarlo">' + esc(estado.club.join_code) + '</p>' +
      '<p class="hm-note">Con ese código entran al club desde su mail.</p>' +
      '</div>') +

      '</div>';
  }

  /* en una línea: si está todo arriba, si falta subir algo o si falló */
  function estadoSync() {
    if (!RG.sync) return '';
    const e = RG.sync.estado();
    if (!e.activa) return 'Se guardan en este navegador.';
    if (e.error) return 'Guardado en esta máquina. No se pudo sincronizar: ' + e.error;
    if (e.pendientes) return 'Subiendo ' + e.pendientes + ' cambios a tu cuenta…';
    return 'Todo guardado en tu cuenta' + (estado.club ? ', junto a la base de ' + estado.club.name : '') + '.';
  }

  let modoJugador = false;

  function pintar() {
    const cuerpo = root.querySelector('.hm-body');
    if (modoJugador) cuerpo.innerHTML = vistaJugador();
    else if (cargando) cuerpo.innerHTML = vistaCargando();
    else if (estado.user) cuerpo.innerHTML = estado.club ? vistaInicio() : vistaSinClub();
    else if (pendiente) cuerpo.innerHTML = vistaPendiente();
    else if (localStorage.getItem(SIN_CUENTA)) cuerpo.innerHTML = vistaInicio();
    else cuerpo.innerHTML = vistaEntrar();
    enganchar();
    if (errorCodigo) { aviso(errorCodigo); errorCodigo = null; }
  }

  function aviso(msg) {
    const cuerpo = root.querySelector('.hm-body');
    const previo = cuerpo.querySelector('.hm-error');
    if (previo) previo.remove();
    const p = document.createElement('p');
    p.className = 'hm-warn hm-error';
    p.textContent = msg;
    cuerpo.appendChild(p);
  }

  async function correr(fn) {
    try { await fn(); await refrescar(); pintar(); }
    catch (e) { aviso(e && e.message ? e.message : 'No se pudo completar'); }
  }

  /* ------------------------------------------------------------ acciones ---- */

  function enganchar() {
    const q = (sel) => root.querySelector(sel);

    /* botón + Enter dentro del bloque */
    function accion(bloque, boton, fn) {
      const caja = q(bloque), btn = q(boton);
      if (!caja || !btn) return;
      btn.addEventListener('click', fn);
      caja.querySelectorAll('input').forEach((inp) => inp.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); fn(); }
      }));
    }

    accion('#hmForm', '#hmGo', () => correr(async () => {
      const codigo = (q('#hmJoinCode') ? q('#hmJoinCode').value : '').trim().toUpperCase();
      if (codigo) localStorage.setItem(CODIGO_PENDIENTE, codigo);
      else localStorage.removeItem(CODIGO_PENDIENTE);
      const r = await C.signIn(q('#hmEmail').value, q('#hmName').value);
      pendiente = r && r.pending ? r.email : null;
    }));

    const saltar = q('#hmSkip');
    if (saltar) saltar.addEventListener('click', () => {
      localStorage.setItem(SIN_CUENTA, '1');
      pintar();
    });

    const login = q('#hmLogin');
    if (login) login.addEventListener('click', () => {
      localStorage.removeItem(SIN_CUENTA);
      pendiente = null;
      pintar();
    });

    const volver = q('#hmBack');
    if (volver) volver.addEventListener('click', () => { pendiente = null; pintar(); });

    accion('#hmNewClub', '#hmCreate', () => correr(async () => {
      const club = await C.createClub(q('#hmClubName').value, q('#hmTeamName').value);
      localStorage.setItem('rugbyboard.club', club.id);
    }));

    accion('#hmJoin', '#hmJoinGo', () => correr(async () => {
      const club = await C.joinClub(q('#hmCode').value);
      localStorage.setItem('rugbyboard.club', club.id);
    }));

    accion('#hmNewTeam', '#hmAddTeam', () => correr(() => C.createTeam(estado.club.id, q('#hmTeamNew').value)));

    root.querySelectorAll('[data-club-team]').forEach((b) => b.addEventListener('click', () => {
      localStorage.setItem('rugbyboard.team', b.dataset.clubTeam);
      pintar();
    }));

    root.querySelectorAll('[data-del-team]').forEach((b) => b.addEventListener('click', async () => {
      const t = estado.teams.find((x) => x.id === b.dataset.delTeam);
      if (!t) return;
      if (!(await RG.ui.askConfirm('¿Sacar el equipo "' + t.name + '" del club?', 'Sacar'))) return;
      correr(() => C.deleteTeam(estado.club.id, t.id));
    }));

    root.querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', () => {
      correr(() => C.setClubRole(estado.club.id, b.dataset.role, b.dataset.to));
    }));

    const salir = q('#hmOut');
    if (salir) salir.addEventListener('click', () => correr(async () => {
      pendiente = null;
      await C.signOut();
      localStorage.removeItem('rugbyboard.club');
      localStorage.removeItem('rugbyboard.team');
    }));

    const codigo = q('#hmCodeBox');
    if (codigo) codigo.addEventListener('click', () => {
      try {
        navigator.clipboard.writeText(estado.club.join_code);
        codigo.classList.add('copiado');
        setTimeout(() => codigo.classList.remove('copiado'), 1200);
      } catch (e) { /* sin portapapeles */ }
    });

    /* arrancar a trabajar */
    const nuevaJugada = q('#hmNewPlay');
    if (nuevaJugada) nuevaJugada.addEventListener('click', () => abrirPizarra('jugada'));
    const nuevoSetup = q('#hmNewSetup');
    if (nuevoSetup) nuevoSetup.addEventListener('click', () => abrirPizarra('setup'));

    /* elegir y abrir: con el botón, con doble click o con Enter sobre la lista */
    function abridor(sel, boton, modo) {
      const lista = q(sel), btn = q(boton);
      if (!lista || !btn) return;
      const abrir = () => { if (lista.value) abrirPizarra(modo, lista.value); };
      btn.addEventListener('click', abrir);
      lista.addEventListener('dblclick', abrir);
      lista.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); abrir(); } });
    }
    abridor('#hmPlaySel', '#hmPlayGo', 'abrir-jugada');
    abridor('#hmSetupSel', '#hmSetupGo', 'abrir-setup');

    /* modo ensayo: la jugada elegida, o el set up si se entra por el botón grande */
    const ensayoJugada = q('#hmPlayEnsayo');
    if (ensayoJugada) ensayoJugada.addEventListener('click', () => {
      const id = q('#hmPlaySel') && q('#hmPlaySel').value;
      if (id) abrirSala('coach', id);
    });

    const ensayoSetup = q('#hmSala');
    if (ensayoSetup) ensayoSetup.addEventListener('click', () => {
      const key = q('#hmSetupSel') && q('#hmSetupSel').value;
      abrirSala('setup', key);
    });

    const comoJugador = q('#hmJugador');
    if (comoJugador) comoJugador.addEventListener('click', () => { modoJugador = true; pintar(); });

    const volverDeSala = q('#hmSalaVolver');
    if (volverDeSala) volverDeSala.addEventListener('click', () => { modoJugador = false; pintar(); });

    accion('#hmSalaForm', '#hmSalaGo', () => {
      const codigo = (q('#hmSalaCodigo').value || '').trim().toUpperCase();
      if (codigo.length < 3) return aviso('Poné el código que muestra la pantalla del entrenador');
      root.hidden = true;
      RG.ensayo.abrirJugador(codigo, (q('#hmSalaNombre').value || '').trim() || 'Jugador');
    });
  }

  /* --------------------------------------------------------- navegación ---- */

  function mostrar() {
    root.hidden = false;
    document.getElementById('app').hidden = true;
    pintar();
  }

  /* Arranca la sala en vivo: con una jugada guardada o con una situación suelta. */
  function abrirSala(desde, id) {
    if (desde === 'setup') {
      const key = id && M.FORMATIONS[id] ? id : 'kickoff_for';
      M.state.frames = [M.blankFrame()];
      M.state.id = RG.geom.uid();
      M.state.name = M.FORMATIONS[key].name;
      M.state.stage = M.FORMATIONS[key].stage || 'field';
      M.applyFormation(key, 0, true);
      root.hidden = true;
      RG.ensayo.abrirCoach(null);
      return;
    }
    root.hidden = true;
    RG.ensayo.abrirCoach(id);
  }

  function abrirPizarra(modo, id) {
    root.hidden = true;
    document.getElementById('app').hidden = false;
    app.onEntrar(modo, id);
  }

  async function init(_app) {
    app = _app;
    root = document.getElementById('home');

    /* cuando termina de subir o bajar, la pantalla se pone al día sola */
    if (RG.sync) RG.sync.onRefresh(() => { if (!root.hidden && !cargando) pintar(); });

    if (RG.ensayo) RG.ensayo.init(() => { modoJugador = false; mostrar(); });

    const volverAlInicio = document.getElementById('btnHome');
    if (volverAlInicio) volverAlInicio.addEventListener('click', async () => {
      await refrescar();
      mostrar();
    });

    window.addEventListener('hashchange', async () => {
      if ((location.hash || '').indexOf('access_token=') < 0) return;
      pendiente = null;
      localStorage.removeItem(SIN_CUENTA);
      await refrescar();
      if (!root.hidden) pintar(); else mostrar();
    });

    mostrar();
    await refrescar();
    cargando = false;
    pintar();
  }

  return { init, mostrar, refrescar, get estado() { return estado; } };
})();
