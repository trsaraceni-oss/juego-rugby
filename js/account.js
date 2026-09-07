/* account.js - pantalla de cuenta: entrar, crear el club, armar los equipos e
   invitar al resto del cuerpo técnico. Habla con RG.cloud, así que no le importa
   si atrás está el backend simulado o el servidor. */
window.RG = window.RG || {};

RG.account = (function () {
  const C = RG.cloud;
  let estado = { user: null, clubs: [], club: null, teams: [], members: [] };
  let root = null, cerrar = null, pendiente = null;

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

  /* ---------------------------------------------------------- datos ---- */

  async function refrescar() {
    estado.user = await C.session();
    estado.clubs = estado.user ? await C.myClubs() : [];
    const guardado = localStorage.getItem('rugbyboard.club');
    estado.club = estado.clubs.find((c) => c.id === guardado) || estado.clubs[0] || null;
    estado.teams = estado.club ? await C.teams(estado.club.id) : [];
    estado.members = estado.club ? await C.members(estado.club.id) : [];
  }

  function equipoActual() {
    const id = localStorage.getItem('rugbyboard.team');
    return estado.teams.find((t) => t.id === id) || estado.teams[0] || null;
  }

  /* ---------------------------------------------------------- pantalla ---- */

  function vistaEntrar() {
    return '' +
      '<h2>Entrá con tu mail</h2>' +
      '<p class="ac-lead">Tus set ups y jugadas quedan asociados a tu cuenta y los abrís desde ' +
      'cualquier dispositivo. Sin cuenta la app funciona igual, guardando en este navegador.</p>' +
      '<div id="acForm" class="ac-form">' +
      '<label>Mail<input type="email" id="acEmail" placeholder="entrenador@club.com" required autocomplete="email"></label>' +
      '<label>Nombre <span class="ac-opt">(opcional)</span><input type="text" id="acName" placeholder="Cómo te ven los demás"></label>' +
      '<button class="btn primary" id="acGo">Entrar</button>' +
      '</div>' +
      (C.configured() ? '<p class="ac-note">Te llega un link al mail para entrar, sin contraseña.</p>'
        : '<p class="ac-note ac-warn">Todavía no hay servidor conectado: esto corre simulado en tu ' +
          'navegador, para probar la pantalla. Los datos no salen de esta máquina.</p>');
  }

  /* con servidor real la sesión llega recién cuando abre el link del mail */
  function vistaPendiente() {
    return '' +
      '<h2>Revisá tu mail</h2>' +
      '<p class="ac-lead">Te mandamos un link a <b>' + esc(pendiente) + '</b>. Abrilo desde este mismo ' +
      'dispositivo y volvés directo a la app, ya con tu cuenta.</p>' +
      '<p class="ac-note">Si no llega en un par de minutos, mirá en spam. El link vale una sola vez.</p>' +
      '<div class="ac-foot"><span class="grow"></span><button class="btn" id="acBack">Usar otro mail</button></div>';
  }

  function vistaSinClub() {
    return '' +
      '<h2>Hola, ' + esc(estado.user.name) + '</h2>' +
      '<p class="ac-lead">Todavía no estás en ningún club. Creá el tuyo o sumate a uno con el código ' +
      'que te pase quien lo creó.</p>' +
      '<div class="ac-cols">' +
      '<div id="acNewClub" class="ac-card">' +
      '<h3>Crear un club</h3>' +
      '<label>Nombre del club<input type="text" id="acClubName" placeholder="Club Atlético Sur" required></label>' +
      '<label>Primer equipo<input type="text" id="acTeamName" value="Primera"></label>' +
      '<button class="btn primary" id="acCreate">Crear club</button>' +
      '</div>' +
      '<div id="acJoin" class="ac-card">' +
      '<h3>Sumarme a uno</h3>' +
      '<label>Código de invitación<input type="text" id="acCode" placeholder="A1B2C3" maxlength="8" autocapitalize="characters" required></label>' +
      '<button class="btn" id="acJoinGo">Sumarme</button>' +
      '</div>' +
      '</div>';
  }

  function vistaClub() {
    const eq = equipoActual();
    return '' +
      '<h2>' + esc(estado.club.name) + '</h2>' +
      '<p class="ac-lead">Entraste como ' + esc(estado.user.name) + ' · ' + esc(estado.user.email) +
      (estado.club.role === 'owner' ? ' · dueño del club' : ' · entrenador') + '</p>' +

      '<div class="ac-cols">' +

      '<div class="ac-card">' +
      '<h3>Equipos</h3>' +
      '<ul class="ac-list">' +
      (estado.teams.length ? estado.teams.map((t) =>
        '<li><button class="ac-team' + (eq && t.id === eq.id ? ' on' : '') + '" data-club-team="' + t.id + '">' +
        esc(t.name) + '</button></li>').join('') : '<li class="ac-empty">Todavía no hay equipos</li>') +
      '</ul>' +
      '<div id="acNewTeam" class="ac-inline">' +
      '<input type="text" id="acTeamNew" placeholder="M19, Femenino…" required>' +
      '<button class="btn sm" id="acAddTeam">Agregar</button>' +
      '</div>' +
      '</div>' +

      '<div class="ac-card">' +
      '<h3>Cuerpo técnico</h3>' +
      '<ul class="ac-list">' +
      estado.members.map((m) => '<li class="ac-member"><span class="ac-name">' + esc(m.name) +
        (m.me ? '<span class="ac-tag">vos</span>' : '') +
        (m.role === 'owner' ? '<span class="ac-tag">dueño</span>' : '') +
        '</span><small>' + esc(m.email) + '</small></li>').join('') +
      '</ul>' +
      '<h3>Invitar</h3>' +
      '<p class="ac-code" id="acCodeBox" title="Click para copiarlo">' + esc(estado.club.join_code) + '</p>' +
      '<p class="ac-note">Pasales este código: entran con su mail y quedan en el club.</p>' +
      '</div>' +

      '</div>' +
      '<div class="ac-foot">' +
      (estado.clubs.length > 1 ? '<select id="acClubSel">' + estado.clubs.map((c) =>
        '<option value="' + c.id + '"' + (c.id === estado.club.id ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('') + '</select>' : '') +
      '<span class="grow"></span>' +
      '<button class="btn" id="acOut">Salir de la cuenta</button>' +
      '</div>';
  }

  function pintar() {
    const cuerpo = root.querySelector('.ac-body');
    cuerpo.innerHTML = estado.user ? (estado.club ? vistaClub() : vistaSinClub())
      : (pendiente ? vistaPendiente() : vistaEntrar());
    enganchar();
  }

  function error(msg) {
    const p = document.createElement('p');
    p.className = 'ac-note ac-warn';
    p.textContent = msg;
    const cuerpo = root.querySelector('.ac-body');
    const previo = cuerpo.querySelector('.ac-error');
    if (previo) previo.remove();
    p.classList.add('ac-error');
    cuerpo.appendChild(p);
  }

  async function correr(fn) {
    try { await fn(); await refrescar(); pintar(); }
    catch (e) { error(e && e.message ? e.message : 'No se pudo completar'); }
  }

  function enganchar() {
    const q = (sel) => root.querySelector(sel);

    /* botón + Enter en los campos del bloque: el visor corre la página en un
       iframe sandbox donde el envío de formularios está bloqueado */
    function accion(bloque, boton, fn) {
      const caja = q(bloque), btn = q(boton);
      if (!caja || !btn) return;
      btn.addEventListener('click', fn);
      caja.querySelectorAll('input').forEach((inp) => inp.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); fn(); }
      }));
    }

    accion('#acForm', '#acGo', () => correr(async () => {
      const r = await C.signIn(q('#acEmail').value, q('#acName').value);
      pendiente = r && r.pending ? r.email : null;
    }));

    const volver = q('#acBack');
    if (volver) volver.addEventListener('click', () => { pendiente = null; pintar(); });

    accion('#acNewClub', '#acCreate', () => correr(async () => {
      const club = await C.createClub(q('#acClubName').value, q('#acTeamName').value);
      localStorage.setItem('rugbyboard.club', club.id);
    }));

    accion('#acJoin', '#acJoinGo', () => correr(async () => {
      const club = await C.joinClub(q('#acCode').value);
      localStorage.setItem('rugbyboard.club', club.id);
    }));

    accion('#acNewTeam', '#acAddTeam', () => correr(() => C.createTeam(estado.club.id, q('#acTeamNew').value)));

    root.querySelectorAll('[data-club-team]').forEach((b) => b.addEventListener('click', () => {
      localStorage.setItem('rugbyboard.team', b.dataset.clubTeam);
      pintar();
      actualizarBoton();
    }));

    const sel = q('#acClubSel');
    if (sel) sel.addEventListener('change', () => {
      localStorage.setItem('rugbyboard.club', sel.value);
      localStorage.removeItem('rugbyboard.team');
      correr(async () => {});
    });

    const salir = q('#acOut');
    if (salir) salir.addEventListener('click', () => correr(async () => { pendiente = null; await C.signOut(); }));

    const codigo = q('#acCodeBox');
    if (codigo) codigo.addEventListener('click', () => {
      try {
        navigator.clipboard.writeText(estado.club.join_code);
        codigo.classList.add('copiado');
        setTimeout(() => codigo.classList.remove('copiado'), 1200);
      } catch (e) { /* sin portapapeles */ }
    });
  }

  /* ------------------------------------------------------------ abrir ---- */

  async function abrir() {
    if (root) return;
    root = document.createElement('div');
    root.className = 'modal-back ac-back';
    root.innerHTML = '<div class="modal ac-modal"><button class="ac-close" title="Cerrar">✕</button>' +
      '<div class="ac-body"><p class="ac-lead">Cargando…</p></div></div>';
    document.body.appendChild(root);

    cerrar = () => {
      document.removeEventListener('keydown', onKey, true);
      root.remove();
      root = null;
      actualizarBoton();
    };
    function onKey(ev) {
      if (ev.key === 'Escape') { ev.stopPropagation(); ev.preventDefault(); cerrar(); }
    }
    document.addEventListener('keydown', onKey, true);
    root.querySelector('.ac-close').addEventListener('click', cerrar);
    root.addEventListener('mousedown', (ev) => { if (ev.target === root) cerrar(); });

    await refrescar();
    pintar();
  }

  function actualizarBoton() {
    const btn = document.getElementById('btnAccount');
    if (!btn) return;
    const eq = equipoActual();
    if (estado.user && estado.club) {
      btn.textContent = estado.club.name + (eq ? ' · ' + eq.name : '');
      btn.classList.add('on');
    } else if (estado.user) {
      btn.textContent = estado.user.name;
      btn.classList.add('on');
    } else {
      btn.textContent = 'Entrar';
      btn.classList.remove('on');
    }
  }

  async function init() {
    const btn = document.getElementById('btnAccount');
    if (btn) btn.addEventListener('click', abrir);

    /* Si la app ya estaba abierta, volver del link del mail sólo cambia el # de
       la dirección y el navegador no recarga: hay que tomar la sesión igual. */
    window.addEventListener('hashchange', async () => {
      if ((location.hash || '').indexOf('access_token=') < 0) return;
      pendiente = null;
      await refrescar();
      actualizarBoton();
      if (root) pintar();
      else if (estado.user) abrir();
    });

    await refrescar();
    actualizarBoton();
  }

  return { init, abrir, refrescar, actualizarBoton, get estado() { return estado; } };
})();
