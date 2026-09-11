/* cloud.js - cuentas de entrenador: sesión, clubes y equipos.
   Dos implementaciones con la misma interfaz: 'demo', que simula todo en este
   navegador para poder trabajar sin servidor, y 'supabase', que se usa apenas
   js/config.js tenga la URL y la clave del proyecto. Todo devuelve promesas,
   así que el resto de la app no distingue cuál está atrás.

   Contra Supabase se habla por HTTP directo, sin librería: la app no tiene
   dependencias y así sigue. */
window.RG = window.RG || {};

RG.cloud = (function () {
  const CFG = (window.RG_CONFIG || {});
  const DEMO_KEY = 'rugbyboard.cloud.demo.v1';
  const SESSION_KEY = 'rugbyboard.session.v1';
  const uid = () => Math.random().toString(36).slice(2, 10);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function configured() {
    return !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
  }

  /* ---------------------------------------------------------------- demo */

  /* Reproduce las reglas del esquema (db/schema.sql) para que la pantalla se
     pueda probar sin servidor: códigos de club, membresías y equipos. */
  const demo = (function () {
    function read() {
      try {
        return JSON.parse(localStorage.getItem(DEMO_KEY) || 'null') ||
          { session: null, users: {}, clubs: {}, teams: {}, members: {} };
      } catch (e) {
        return { session: null, users: {}, clubs: {}, teams: {}, members: {} };
      }
    }

    function write(db) {
      try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); } catch (e) { /* sin espacio */ }
    }

    const code = () => Math.random().toString(36).slice(2, 8).toUpperCase();

    return {
      kind: 'demo',

      async session() {
        const db = read();
        return db.session ? db.users[db.session] || null : null;
      },

      /* sin servidor no hay mail: entra derecho, y la pantalla avisa que es simulado */
      async signIn(email, name) {
        await wait(220);
        const db = read();
        const clean = String(email || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) throw new Error('Ese mail no parece válido');
        let user = Object.values(db.users).find((u) => u.email === clean);
        if (!user) {
          user = { id: uid(), email: clean, name: (name || clean.split('@')[0]) };
          db.users[user.id] = user;
        }
        db.session = user.id;
        write(db);
        return { user: user };
      },

      async signOut() {
        const db = read();
        db.session = null;
        write(db);
      },

      async myClubs() {
        const db = read();
        if (!db.session) return [];
        return Object.values(db.clubs)
          .filter((c) => (db.members[c.id] || []).some((m) => m.user === db.session))
          .map((c) => Object.assign({}, c, {
            role: (db.members[c.id] || []).find((m) => m.user === db.session).role
          }));
      },

      async createClub(name, firstTeam) {
        await wait(220);
        const db = read();
        if (!db.session) throw new Error('Entrá con tu mail primero');
        const club = { id: uid(), name: String(name).trim(), join_code: code(), created_by: db.session };
        if (!club.name) throw new Error('Poné un nombre de club');
        db.clubs[club.id] = club;
        db.members[club.id] = [{ user: db.session, role: 'owner' }];
        db.teams[club.id] = [{ id: uid(), name: String(firstTeam || 'Primera').trim() || 'Primera' }];
        write(db);
        return club;
      },

      async joinClub(joinCode) {
        await wait(220);
        const db = read();
        if (!db.session) throw new Error('Entrá con tu mail primero');
        const club = Object.values(db.clubs).find((c) => c.join_code === String(joinCode || '').trim().toUpperCase());
        if (!club) throw new Error('Código de club inválido');
        const lista = db.members[club.id] || (db.members[club.id] = []);
        if (!lista.some((m) => m.user === db.session)) lista.push({ user: db.session, role: 'coach' });
        write(db);
        return club;
      },

      async teams(clubId) {
        return (read().teams[clubId] || []).slice();
      },

      async createTeam(clubId, name) {
        await wait(180);
        const db = read();
        const lista = db.teams[clubId] || (db.teams[clubId] = []);
        const limpio = String(name || '').trim();
        if (!limpio) throw new Error('Poné un nombre de equipo');
        if (lista.some((t) => t.name.toLowerCase() === limpio.toLowerCase())) throw new Error('Ya existe un equipo con ese nombre');
        const team = { id: uid(), name: limpio };
        lista.push(team);
        write(db);
        return team;
      },

      async deleteTeam(clubId, teamId) {
        await wait(150);
        const db = read();
        db.teams[clubId] = (db.teams[clubId] || []).filter((t) => t.id !== teamId);
        write(db);
      },

      /* set ups y jugadas, con el mismo modelo de niveles que el servidor */
      async listSetups(clubId) {
        const db = read();
        return (db.setups || []).filter((r) =>
          r.scope === 'global' || r.owner_id === db.session ||
          (r.scope === 'club' && r.club_id === clubId))
          .map((r) => Object.assign({}, r, { mine: r.owner_id === db.session }));
      },

      async saveSetup(row) {
        await wait(120);
        const db = read();
        db.setups = db.setups || [];
        const igual = (r) => r.scope === row.scope &&
          (row.scope !== 'personal' || r.owner_id === db.session) &&
          (row.scope !== 'club' || r.club_id === row.club_id) &&
          (row.base_key ? r.base_key === row.base_key : (!r.base_key && r.name === row.name));
        let fila = db.setups.find(igual);
        if (!fila) {
          fila = Object.assign({ id: uid(), owner_id: db.session }, row);
          db.setups.push(fila);
        } else {
          Object.assign(fila, row);
        }
        write(db);
        return fila;
      },

      async deleteSetup(id) {
        const db = read();
        db.setups = (db.setups || []).filter((r) => r.id !== id);
        write(db);
      },

      async listPlays(clubId) {
        const db = read();
        return (db.plays || []).filter((r) =>
          r.scope === 'global' || r.owner_id === db.session ||
          (r.scope === 'club' && r.club_id === clubId))
          .map((r) => Object.assign({}, r, { mine: r.owner_id === db.session }));
      },

      async savePlay(row) {
        await wait(120);
        const db = read();
        db.plays = db.plays || [];
        let fila = db.plays.find((r) => r.scope === row.scope && r.name === row.name &&
          (row.scope !== 'personal' || r.owner_id === db.session) &&
          (row.scope !== 'club' || r.club_id === row.club_id));
        if (!fila) {
          fila = Object.assign({ id: uid(), owner_id: db.session }, row);
          db.plays.push(fila);
        } else {
          Object.assign(fila, row);
        }
        write(db);
        return fila;
      },

      async deletePlay(id) {
        const db = read();
        db.plays = (db.plays || []).filter((r) => r.id !== id);
        write(db);
      },

      async amAdmin() { return false; },

      async members(clubId) {
        const db = read();
        return (db.members[clubId] || []).map((m) => ({
          id: m.user,
          role: m.role,
          name: (db.users[m.user] || {}).name || '(sin nombre)',
          email: (db.users[m.user] || {}).email || '',
          me: m.user === db.session
        }));
      },

      /* ---- administración del producto ---- */

      async allClubs() {
        const db = read();
        return Object.values(db.clubs).map((c) => Object.assign({}, c, {
          equipos: (db.teams[c.id] || []).length,
          gente: (db.members[c.id] || []).length
        })).sort((a, b) => a.name.localeCompare(b.name));
      },

      async renameClub(clubId, name) {
        const db = read();
        const limpio = String(name || '').trim();
        if (!limpio) throw new Error('Poné un nombre');
        if (!db.clubs[clubId]) throw new Error('No existe ese club');
        db.clubs[clubId].name = limpio;
        write(db);
        return db.clubs[clubId];
      },

      async deleteClub(clubId) {
        const db = read();
        delete db.clubs[clubId];
        delete db.teams[clubId];
        delete db.members[clubId];
        write(db);
      },

      async removeMember(clubId, userId) {
        const db = read();
        db.members[clubId] = (db.members[clubId] || []).filter((m) => m.user !== userId);
        write(db);
      },

      async setClubRole(clubId, userId, role) {
        const db = read();
        const yo = (db.members[clubId] || []).find((m) => m.user === db.session);
        if (!yo || yo.role !== 'owner') throw new Error('Sólo el dueño del club cambia los roles');
        const otro = (db.members[clubId] || []).find((m) => m.user === userId);
        if (!otro) throw new Error('No está en el club');
        otro.role = role;
        write(db);
        return role;
      }
    };
  })();

  /* ------------------------------------------------------------ supabase */

  const remote = (function () {
    const base = String(CFG.supabaseUrl || '').replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
    const key = CFG.supabaseAnonKey || '';
    let ses = null;   /* { access_token, refresh_token, expires_at, user } */

    function guardar(s) {
      ses = s;
      try {
        if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
        else localStorage.removeItem(SESSION_KEY);
      } catch (e) { /* sin espacio */ }
    }

    function leer() {
      if (ses) return ses;
      try { ses = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { ses = null; }
      return ses;
    }

    /* el link del mail vuelve con los tokens en el # de la dirección */
    function tomarDeLaUrl() {
      const h = location.hash || '';
      if (h.indexOf('access_token=') < 0) return false;
      const p = new URLSearchParams(h.replace(/^#/, ''));
      const at = p.get('access_token');
      if (!at) return false;
      guardar({
        access_token: at,
        refresh_token: p.get('refresh_token') || '',
        expires_at: Date.now() + (parseInt(p.get('expires_in'), 10) || 3600) * 1000,
        user: null
      });
      history.replaceState(null, '', location.pathname + location.search);
      return true;
    }

    async function pedir(url, opts) {
      const o = opts || {};
      const headers = Object.assign({ apikey: key, 'Content-Type': 'application/json' }, o.headers || {});
      if (o.auth !== false) {
        const s = leer();
        headers.Authorization = 'Bearer ' + ((s && s.access_token) || key);
      }
      let res;
      try {
        res = await fetch(base + url, { method: o.method || 'GET', headers: headers, body: o.body ? JSON.stringify(o.body) : undefined });
      } catch (e) {
        throw new Error('No se pudo conectar con el servidor');
      }
      const texto = await res.text();
      let data = null;
      try { data = texto ? JSON.parse(texto) : null; } catch (e) { data = texto; }
      if (!res.ok) {
        /* la entrada venció en el medio de un pedido: se renueva y se repite,
           una sola vez, para que no salte la pantalla de entrar */
        if (res.status === 401 && o.auth !== false && !o.reintento && leer()) {
          const nueva = await refrescarToken();
          if (nueva) return pedir(url, Object.assign({}, o, { reintento: true }));
        }
        const msg = (data && (data.message || data.error_description || data.msg || data.error || data.hint)) || ('Error ' + res.status);
        const err = new Error(msg);
        err.status = res.status;
        throw err;
      }
      return data;
    }

    /* Renovar la entrada.

       La sesión se cae sola si se la borra a la primera de cambio: sin señal, en
       el subte, con el servidor lento. Acá sólo se borra cuando el servidor dice
       que la llave ya no vale; si el problema es la red, la sesión queda y se
       reintenta después. Y nunca se renueva dos veces a la vez: el servidor rota
       la llave y dos pedidos juntos se pisan. */

    let renovando = null;

    async function refrescarToken() {
      if (renovando) return renovando;
      const s = leer();
      if (!s || !s.refresh_token) return null;
      renovando = (async () => {
        try {
          const data = await pedir('/auth/v1/token?grant_type=refresh_token', {
            method: 'POST', auth: false, body: { refresh_token: s.refresh_token }
          });
          guardar({
            access_token: data.access_token,
            refresh_token: data.refresh_token || s.refresh_token,
            expires_at: Date.now() + (data.expires_in || 3600) * 1000,
            user: data.user || (s.user || null)
          });
          return ses;
        } catch (e) {
          /* 400 o 401: la llave no vale más, hay que volver a entrar. Otra cosa
             (sin red, servidor caído) no es motivo para echar a nadie. */
          if (e.status === 400 || e.status === 401 || e.status === 403) guardar(null);
          return null;
        } finally {
          renovando = null;
        }
      })();
      return renovando;
    }

    /* mientras la pestaña está abierta, la entrada se renueva antes de vencer */
    let reloj = 0;
    function programarRenovacion() {
      clearTimeout(reloj);
      const s = leer();
      if (!s || !s.expires_at) return;
      const falta = s.expires_at - Date.now() - 5 * 60 * 1000;
      reloj = setTimeout(async () => { await refrescarToken(); programarRenovacion(); },
        Math.max(30000, Math.min(falta, 30 * 60 * 1000)));
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        const s = leer();
        if (s && s.expires_at && s.expires_at < Date.now() + 60000) refrescarToken();
      });
    }

    /* Los errores de la entrada por mail vienen en inglés y sin contexto. Estos
       son los tres que aparecen de verdad, y los tres se arreglan en el panel de
       Supabase, no en la app: conviene que lo diga la pantalla. */
    function explicar(e) {
      const txt = String((e && e.message) || '').toLowerCase();
      if (e && e.status === 429) {
        return 'El servidor de mail no acepta más envíos por ahora: en el plan gratis de Supabase ' +
          'son unos pocos por hora. Esperá un rato y probá de nuevo, o conectá un servicio de mail propio.';
      }
      if (txt.indexOf('rate limit') >= 0 || txt.indexOf('too many') >= 0) {
        return 'Demasiados intentos seguidos. Esperá unos minutos y volvé a probar.';
      }
      if (txt.indexOf('signups not allowed') >= 0 || txt.indexOf('signup is disabled') >= 0 ||
          txt.indexOf('not allowed for this instance') >= 0) {
        return 'El proyecto tiene bloqueadas las altas nuevas: en Supabase, Authentication → ' +
          'Sign In / Providers → Email, hay que permitir que se registren usuarios nuevos.';
      }
      if (txt.indexOf('redirect') >= 0) {
        return 'La dirección de la app no está autorizada: en Supabase, Authentication → URL ' +
          'Configuration, agregala en Redirect URLs.';
      }
      return (e && e.message) || 'No se pudo mandar el mail';
    }

    return {
      kind: 'supabase',

      async session() {
        tomarDeLaUrl();
        const guardada = leer();
        if (!guardada) return null;
        let s = guardada;
        if (s.expires_at && s.expires_at < Date.now() + 60000) {
          s = await refrescarToken();
          /* no se pudo renovar: si la sesión sigue guardada es que fue un
             problema de red, y se sigue adentro con lo último que se sabía */
          if (!s) { const q = leer(); return q && q.user ? q.user : null; }
        }
        programarRenovacion();
        if (s.user && s.user.name) return s.user;
        try {
          const u = await pedir('/auth/v1/user');
          const user = {
            id: u.id,
            email: u.email,
            name: (u.user_metadata && u.user_metadata.name) || String(u.email || '').split('@')[0]
          };
          guardar(Object.assign({}, leer() || s, { user: user }));
          return user;
        } catch (e) {
          if (e.status !== 401 && e.status !== 403) return s.user || null;
          /* la entrada venció mientras tanto: se renueva y se vuelve a probar */
          const nueva = await refrescarToken();
          if (!nueva) { const q = leer(); return q && q.user ? q.user : null; }
          try {
            const u = await pedir('/auth/v1/user');
            const user = {
              id: u.id, email: u.email,
              name: (u.user_metadata && u.user_metadata.name) || String(u.email || '').split('@')[0]
            };
            guardar(Object.assign({}, leer() || nueva, { user: user }));
            return user;
          } catch (e2) { return nueva.user || null; }
        }
      },

      /* manda el link al mail; la sesión llega cuando el entrenador lo abre */
      async signIn(email, name) {
        const clean = String(email || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) throw new Error('Ese mail no parece válido');
        const volverA = location.origin + location.pathname;
        try {
          await pedir('/auth/v1/otp?redirect_to=' + encodeURIComponent(volverA), {
            method: 'POST', auth: false,
            /* should_create_user es el nombre que espera el servidor: con el otro
               el alta de alguien nuevo quedaba librada al valor por defecto */
            body: { email: clean, should_create_user: true, data: name ? { name: String(name).trim() } : {} }
          });
        } catch (e) {
          throw new Error(explicar(e));
        }
        return { pending: true, email: clean };
      },

      async signOut() {
        try { await pedir('/auth/v1/logout', { method: 'POST' }); } catch (e) { /* igual se cierra */ }
        guardar(null);
      },

      async myClubs() {
        const filas = await pedir('/rest/v1/memberships?select=role,clubs(id,name,join_code)');
        return (filas || []).filter((f) => f.clubs).map((f) => Object.assign({ role: f.role }, f.clubs));
      },

      async createClub(name, firstTeam) {
        const limpio = String(name || '').trim();
        if (!limpio) throw new Error('Poné un nombre de club');
        const r = await pedir('/rest/v1/rpc/create_club', {
          method: 'POST', body: { club_name: limpio, first_team: String(firstTeam || 'Primera').trim() || 'Primera' }
        });
        return Array.isArray(r) ? r[0] : r;
      },

      async joinClub(code) {
        const r = await pedir('/rest/v1/rpc/join_club', {
          method: 'POST', body: { code: String(code || '').trim().toUpperCase() }
        });
        return Array.isArray(r) ? r[0] : r;
      },

      async teams(clubId) {
        return await pedir('/rest/v1/teams?select=id,name&order=created_at.asc&club_id=eq.' + encodeURIComponent(clubId)) || [];
      },

      async createTeam(clubId, name) {
        const limpio = String(name || '').trim();
        if (!limpio) throw new Error('Poné un nombre de equipo');
        let filas;
        try {
          filas = await pedir('/rest/v1/teams', {
            method: 'POST', headers: { Prefer: 'return=representation' },
            body: { club_id: clubId, name: limpio }
          });
        } catch (e) {
          if (e.status === 409) throw new Error('Ya existe un equipo con ese nombre');
          throw e;
        }
        const team = Array.isArray(filas) ? filas[0] : filas;
        const yo = await this.session();
        if (team && yo) {
          try { await pedir('/rest/v1/team_members', { method: 'POST', body: { team_id: team.id, user_id: yo.id } }); }
          catch (e) { /* si ya estaba, no importa */ }
        }
        return team;
      },

      async deleteTeam(clubId, teamId) {
        await pedir('/rest/v1/teams?id=eq.' + encodeURIComponent(teamId), { method: 'DELETE' });
      },

      async listSetups() {
        return await pedir('/rest/v1/setups?select=id,scope,club_id,base_key,name,data,owner_id') || [];
      },

      async saveSetup(row) {
        const r = await pedir('/rest/v1/rpc/save_setup', {
          method: 'POST',
          body: {
            p_scope: row.scope, p_club: row.club_id || null, p_base_key: row.base_key || null,
            p_name: row.name, p_data: row.data
          }
        });
        return Array.isArray(r) ? r[0] : r;
      },

      async deleteSetup(id) {
        await pedir('/rest/v1/setups?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
      },

      async listPlays() {
        return await pedir('/rest/v1/plays?select=id,scope,club_id,name,data,owner_id') || [];
      },

      async savePlay(row) {
        const r = await pedir('/rest/v1/rpc/save_play', {
          method: 'POST',
          body: { p_scope: row.scope, p_club: row.club_id || null, p_name: row.name, p_data: row.data }
        });
        return Array.isArray(r) ? r[0] : r;
      },

      async deletePlay(id) {
        await pedir('/rest/v1/plays?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
      },

      /* ¿es administrador del producto? lo dice el servidor, no el navegador */
      async amAdmin() {
        try {
          const r = await pedir('/rest/v1/rpc/is_admin', { method: 'POST', body: {} });
          return r === true;
        } catch (e) { return false; }
      },

      async members(clubId) {
        const yo = await this.session();
        const filas = await pedir('/rest/v1/memberships?select=role,user_id,profiles(name,email)&club_id=eq.' + encodeURIComponent(clubId));
        return (filas || []).map((f) => ({
          id: f.user_id,
          role: f.role,
          name: (f.profiles && f.profiles.name) || '(sin nombre)',
          email: (f.profiles && f.profiles.email) || '',
          me: !!(yo && f.user_id === yo.id)
        }));
      },

      /* ---- administración del producto: las reglas de acceso dejan pasar esto
         sólo si profiles.is_admin está en verdadero (db/migration-4.sql) ---- */

      async allClubs() {
        const filas = await pedir('/rest/v1/clubs?select=id,name,join_code,created_at,teams(count),memberships(count)&order=name');
        return (filas || []).map((c) => ({
          id: c.id, name: c.name, join_code: c.join_code, created_at: c.created_at,
          equipos: (c.teams && c.teams[0] && c.teams[0].count) || 0,
          gente: (c.memberships && c.memberships[0] && c.memberships[0].count) || 0
        }));
      },

      async renameClub(clubId, name) {
        const limpio = String(name || '').trim();
        if (!limpio) throw new Error('Poné un nombre');
        const r = await pedir('/rest/v1/clubs?id=eq.' + encodeURIComponent(clubId), {
          method: 'PATCH', headers: { Prefer: 'return=representation' }, body: { name: limpio }
        });
        if (!r || !r.length) throw new Error('No se pudo renombrar: ¿tenés permiso?');
        return r[0];
      },

      async deleteClub(clubId) {
        await pedir('/rest/v1/clubs?id=eq.' + encodeURIComponent(clubId), { method: 'DELETE' });
      },

      async removeMember(clubId, userId) {
        await pedir('/rest/v1/memberships?club_id=eq.' + encodeURIComponent(clubId) +
          '&user_id=eq.' + encodeURIComponent(userId), { method: 'DELETE' });
      },

      /* el dueño asciende a un entrenador a admin del club, o lo baja */
      async setClubRole(clubId, userId, role) {
        return await pedir('/rest/v1/rpc/set_club_role', {
          method: 'POST', body: { club: clubId, member: userId, new_role: role }
        });
      }
    };
  })();

  const backend = () => (configured() ? remote : demo);

  return {
    get kind() { return backend().kind; },
    configured: configured,
    session: () => backend().session(),
    signIn: (email, name) => backend().signIn(email, name),
    signOut: () => backend().signOut(),
    myClubs: () => backend().myClubs(),
    createClub: (name, team) => backend().createClub(name, team),
    joinClub: (code) => backend().joinClub(code),
    teams: (clubId) => backend().teams(clubId),
    createTeam: (clubId, name) => backend().createTeam(clubId, name),
    deleteTeam: (clubId, teamId) => backend().deleteTeam(clubId, teamId),
    listSetups: (clubId) => backend().listSetups(clubId),
    saveSetup: (row) => backend().saveSetup(row),
    deleteSetup: (id) => backend().deleteSetup(id),
    listPlays: (clubId) => backend().listPlays(clubId),
    savePlay: (row) => backend().savePlay(row),
    deletePlay: (id) => backend().deletePlay(id),
    amAdmin: () => backend().amAdmin(),
    members: (clubId) => backend().members(clubId),
    setClubRole: (clubId, userId, role) => backend().setClubRole(clubId, userId, role),
    allClubs: () => backend().allClubs(),
    renameClub: (clubId, name) => backend().renameClub(clubId, name),
    deleteClub: (clubId) => backend().deleteClub(clubId),
    removeMember: (clubId, userId) => backend().removeMember(clubId, userId)
  };
})();
