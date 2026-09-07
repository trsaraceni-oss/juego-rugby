/* cloud.js - cuentas de entrenador: sesión, clubes y equipos.
   Detrás hay dos implementaciones con la misma interfaz: 'demo', que simula todo
   en este navegador para poder trabajar sin servidor, y 'supabase', que se activa
   sola en cuanto js/config.js tenga la URL y la clave del proyecto.
   Todas las funciones devuelven promesas: el resto de la app no distingue cuál está. */
window.RG = window.RG || {};

RG.cloud = (function () {
  const CFG = (window.RG_CONFIG || {});
  const DEMO_KEY = 'rugbyboard.cloud.demo.v1';
  const uid = () => Math.random().toString(36).slice(2, 10);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function configured() {
    return !!(CFG.supabaseUrl && CFG.supabaseAnonKey);
  }

  /* ---------------------------------------------------------------- demo */

  /* Reproduce las reglas del esquema (db/schema.sql) para que la pantalla se
     pruebe de verdad: códigos de club, membresías y equipos. */
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

    function code() {
      return Math.random().toString(36).slice(2, 8).toUpperCase();
    }

    return {
      kind: 'demo',

      async session() {
        const db = read();
        return db.session ? db.users[db.session] || null : null;
      },

      /* sin servidor de mail no hay link: se entra derecho, avisando que es simulado */
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
        return user;
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
        const db = read();
        return (db.teams[clubId] || []).slice();
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

  /* Se completa cuando estén la URL y la clave: misma interfaz que demo, contra
     las tablas y funciones de db/schema.sql. */
  const remote = null;

  const backend = () => (configured() && remote ? remote : demo);

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
    members: (clubId) => backend().members(clubId)
  };
})();
