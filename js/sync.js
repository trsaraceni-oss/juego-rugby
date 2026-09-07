/* sync.js - el puente entre lo que hay en esta máquina y la cuenta.

   El modelo trabaja siempre contra una copia local, así la app abre sin esperar
   la red y no se cuelga si el servidor no está. Acá se sube lo que cambió y se
   baja lo que hay en la cuenta: lo global de la app, la base del club y lo suyo. */
window.RG = window.RG || {};

RG.sync = (function () {
  const C = RG.cloud;
  const M = RG.model;

  let cuentaActual = null;     /* id del usuario, o null trabajando sin cuenta */
  let clubActual = null;
  let rolActual = null;        /* el rol en el club: define en qué capas puede escribir */
  let cola = Promise.resolve(); /* las vueltas van en fila, nunca dos a la vez */
  let encolada = false;         /* ya hay una esperando: no hace falta otra */
  let subiendo = false;
  let ultimoError = null;
  let alRefrescar = null;

  const esLocal = (id) => String(id).indexOf('l:') === 0;

  function avisarPantalla() {
    if (alRefrescar) { try { alRefrescar(); } catch (e) { /* la pantalla ya no está */ } }
  }

  /* ---------- subir lo que cambió ---------- */

  async function subirFila(kind, r) {
    if (r.deleted) {
      if (!esLocal(r.id)) {
        if (kind === 'setups') await C.deleteSetup(r.id);
        else await C.deletePlay(r.id);
      }
      M.forget(kind, r.id);
      return;
    }
    const cuerpo = kind === 'setups'
      ? { scope: r.scope, club_id: r.club_id, base_key: r.base_key, name: r.name, data: r.data }
      : { scope: r.scope, club_id: r.club_id, name: r.name, data: r.data };
    const srv = kind === 'setups' ? await C.saveSetup(cuerpo) : await C.savePlay(cuerpo);
    M.adopt(kind, r.id, srv && srv.id ? { id: srv.id, owner_id: srv.owner_id || cuentaActual } : {});
  }

  async function subir() {
    for (const kind of ['setups', 'plays']) {
      for (const r of M.pending(kind)) await subirFila(kind, r);
    }
  }

  /* ---------- bajar lo que hay en la cuenta ---------- */

  function normalizar(r) {
    return {
      id: r.id, scope: r.scope || 'personal', club_id: r.club_id || null,
      base_key: r.base_key || null, name: r.name, data: r.data,
      owner_id: r.owner_id, updated: Date.parse(r.updated_at || '') || Date.now()
    };
  }

  async function bajar() {
    M.applyRemote('setups', (await C.listSetups(clubActual) || []).map(normalizar));
    M.applyRemote('plays', (await C.listPlays(clubActual) || []).map(normalizar));
  }

  /* ---------- una vuelta completa ---------- */

  async function vuelta() {
    if (!cuentaActual) return;
    try {
      await subir();
      await bajar();
      ultimoError = null;
    } catch (e) {
      /* sin red o sin permiso: lo local queda intacto y se reintenta al próximo cambio */
      ultimoError = e && e.message ? e.message : 'No se pudo sincronizar';
    }
    avisarPantalla();
  }

  /* Devuelve la vuelta que va a cubrir este cambio, así el que llama puede
     esperarla. Si ya hay una en fila, se cuelga de esa. */
  function agendar() {
    if (!cuentaActual) return Promise.resolve();
    if (!encolada) {
      encolada = true;
      cola = cola.then(async () => {
        encolada = false;
        subiendo = true;
        try { await vuelta(); } finally { subiendo = false; }
      });
    }
    return cola;
  }

  /* ---------- entrar y salir de la cuenta ---------- */

  /* La llama la pantalla de inicio cada vez que cambia quién está trabajando. */
  async function cuenta(user, club) {
    const id = user ? user.id : null;
    const clubId = club ? club.id : null;
    const rol = club ? club.role : null;
    if (id === cuentaActual && clubId === clubActual && rol === rolActual) return;
    cuentaActual = id;
    clubActual = clubId;
    rolActual = rol;

    if (!id) { M.useAccount(null); avisarPantalla(); return; }

    let admin = false;
    try { admin = await C.amAdmin(); } catch (e) { admin = false; }
    const clubAdmin = rol === 'owner' || rol === 'admin';

    /* useAccount se trae solo lo que venía trabajando sin cuenta, la primera vez */
    M.useAccount({ user: id, club: clubId, admin: admin, clubAdmin: clubAdmin });

    M.onChange(agendar);
    await agendar();
  }

  function estado() {
    return {
      activa: !!cuentaActual,
      subiendo: subiendo,
      error: ultimoError,
      pendientes: cuentaActual ? M.pending('setups').length + M.pending('plays').length : 0
    };
  }

  function onRefresh(fn) { alRefrescar = fn; }

  return { cuenta, agendar, estado, onRefresh };
})();
