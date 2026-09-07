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

      async members(clubId) {
        const db = read();
        return (db.members[clubId] || []).map((m) => ({
          role: m.role,
          name: (db.users[m.user] || {}).name || '(sin nombre)',
          email: (db.users[m.user] || {}).email || '',
          me: m.user === db.session
        }));
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
        const msg = (data && (data.message || data.error_description || data.msg || data.error || data.hint)) || ('Error ' + res.status);
        const err = new Error(msg);
        err.status = res.status;
        throw err;
      }
      return data;
    }

    async function refrescarToken() {
      const s = leer();
      if (!s || !s.refresh_token) return null;
      try {
        const data = await pedir('/auth/v1/token?grant_type=refresh_token', {
          method: 'POST', auth: false, body: { refresh_token: s.refresh_token }
        });
        guardar({
          access_token: data.access_token,
          refresh_token: data.refresh_token || s.refresh_token,
          expires_at: Date.now() + (data.expires_in || 3600) * 1000,
          user: data.user || null
        });
        return ses;
      } catch (e) {
        guardar(null);
        return null;
      }
    }

    return {
      kind: 'supabase',

      async session() {
        tomarDeLaUrl();
        let s = leer();
        if (!s) return null;
        if (s.expires_at && s.expires_at < Date.now() + 60000) {
          s = await refrescarToken();
          if (!s) return null;
        }
        if (s.user && s.user.name) return s.user;
        try {
          const u = await pedir('/auth/v1/user');
          const user = {
            id: u.id,
            email: u.email,
            name: (u.user_metadata && u.user_metadata.name) || String(u.email || '').split('@')[0]
          };
          guardar(Object.assign({}, s, { user: user }));
          return user;
        } catch (e) {
          if (e.status === 401 || e.status === 403) guardar(null);
          return null;
        }
      },

      /* manda el link al mail; la sesión llega cuando el entrenador lo abre */
      async signIn(email, name) {
        const clean = String(email || '').trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) throw new Error('Ese mail no parece válido');
        const volverA = location.origin + location.pathname;
        await pedir('/auth/v1/otp?redirect_to=' + encodeURIComponent(volverA), {
          method: 'POST', auth: false,
          body: { email: clean, create_user: true, data: name ? { name: String(name).trim() } : {} }
        });
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

      async members(clubId) {
        const yo = await this.session();
        const filas = await pedir('/rest/v1/memberships?select=role,user_id,profiles(name,email)&club_id=eq.' + encodeURIComponent(clubId));
        return (filas || []).map((f) => ({
          role: f.role,
          name: (f.profiles && f.profiles.name) || '(sin nombre)',
          email: (f.profiles && f.profiles.email) || '',
          me: !!(yo && f.user_id === yo.id)
        }));
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
    members: (clubId) => backend().members(clubId)
  };
})();
