/* model.js - estado de la jugada, frames, formaciones, historial y guardado */
window.RG = window.RG || {};

RG.model = (function () {
  const G = RG.geom;
  const uid = G.uid;

  /* ---------- plantel ---------- */

  const POSITION_NAMES = {
    1: 'Pilar izq', 2: 'Hooker', 3: 'Pilar der', 4: 'Segunda', 5: 'Segunda',
    6: 'Ala ciega', 7: 'Ala abierta', 8: 'Octavo', 9: 'Medio scrum', 10: 'Apertura',
    11: 'Wing izq', 12: 'Primer centro', 13: 'Segundo centro', 14: 'Wing der', 15: 'Fullback'
  };

  /* que camisetas usa cada formato de juego */
  const SQUADS = {
    15: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    13: [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 14, 15],
    10: [1, 2, 3, 4, 6, 8, 9, 10, 12, 15],
    7: [1, 2, 3, 7, 9, 10, 15]
  };

  function makePlayers(size) {
    const nums = SQUADS[size] || SQUADS[15];
    const out = [];
    for (const team of ['a', 'b']) {
      for (const num of nums) {
        out.push({ id: team + num, team, num, label: POSITION_NAMES[num] || ('#' + num) });
      }
    }
    return out;
  }

  /* ---------- formaciones (metros; A ataca hacia +x) ---------- */

  /* los dos equipos enfrentados en columna, ordenados por número: punto de
     partida para armar una jugada arrastrando jugadores */
  function lineUp(x) {
    const out = {};
    for (let n = 1; n <= 15; n++) out[n] = [x, 5 + (n - 1) * 4.3];
    return out;
  }

  const FORMATIONS = {

    /* ---------- salidas ---------- */

    kickoff_for: {
      name: 'Salida de mitad de cancha a favor', group: 'Salidas', ballCarrier: 'a10',
      note: 'Sale el 10; el pack persigue por la touch izquierda',
      a: {
        10: [49.5, 35], 9: [46, 32],
        8: [48.5, 12], 4: [48.5, 16], 6: [48.5, 20], 5: [47, 14], 2: [47, 18],
        1: [46, 16], 3: [46, 22], 7: [48.5, 28],
        12: [46, 44], 13: [44, 52], 11: [44, 62], 14: [47, 6], 15: [40, 36]
      },
      b: {
        6: [62, 10], 4: [60, 14], 5: [60, 20], 8: [61, 26], 7: [62, 32],
        1: [64, 16], 2: [64, 22], 3: [64, 28],
        9: [66, 24], 10: [68, 32], 12: [70, 40], 13: [72, 48], 11: [74, 60], 14: [70, 8], 15: [78, 30]
      }
    },

    kickoff_against: {
      name: 'Salida de mitad de cancha en contra', group: 'Salidas', ballCarrier: 'b10',
      note: 'Recepción: cadenas de dos saltadores y coberturas atrás',
      a: {
        4: [40, 14], 5: [40, 20], 8: [39, 26], 6: [38, 10], 7: [38, 32],
        1: [36, 16], 2: [36, 22], 3: [36, 28],
        9: [34, 24], 10: [32, 32], 12: [30, 40], 13: [28, 48], 11: [26, 60], 14: [30, 8], 15: [22, 30]
      },
      b: {
        10: [50.5, 35], 9: [54, 32],
        8: [51.5, 12], 4: [51.5, 16], 6: [51.5, 20], 5: [53, 14], 2: [53, 18],
        1: [54, 16], 3: [54, 22], 7: [51.5, 28],
        12: [54, 44], 13: [56, 52], 11: [56, 62], 14: [53, 6], 15: [60, 36]
      }
    },

    dropout22_for: {
      name: 'Salida de 22 a favor', group: 'Salidas', ballCarrier: 'a10',
      note: 'Drop desde la línea de 22 propia',
      a: {
        10: [21.5, 35], 9: [19, 38],
        8: [20, 22], 4: [21, 26], 5: [21, 30], 6: [21, 40], 7: [21, 44],
        1: [19, 28], 2: [19, 32], 3: [19, 36],
        12: [18, 44], 13: [16, 50], 11: [15, 60], 14: [18, 10], 15: [12, 35]
      },
      b: {
        6: [35, 22], 4: [33, 28], 5: [33, 34], 8: [34, 40], 7: [35, 46],
        1: [37, 30], 2: [37, 36], 3: [37, 42],
        9: [39, 32], 10: [42, 40], 12: [45, 46], 13: [48, 54], 11: [50, 64], 14: [44, 10], 15: [55, 34]
      }
    },

    dropout22_against: {
      name: 'Salida de 22 en contra', group: 'Salidas', ballCarrier: 'b10',
      note: 'Recepción del drop rival a 10 m de la pelota',
      a: {
        6: [65, 22], 4: [67, 28], 5: [67, 34], 8: [66, 40], 7: [65, 46],
        1: [63, 30], 2: [63, 36], 3: [63, 42],
        9: [61, 32], 10: [58, 40], 12: [55, 46], 13: [52, 54], 11: [50, 64], 14: [56, 10], 15: [45, 34]
      },
      b: {
        10: [78.5, 35], 9: [81, 38],
        8: [80, 22], 4: [79, 26], 5: [79, 30], 6: [79, 40], 7: [79, 44],
        1: [81, 28], 2: [81, 32], 3: [81, 36],
        12: [82, 44], 13: [84, 50], 11: [85, 60], 14: [82, 10], 15: [88, 35]
      }
    },

    /* ---------- scrums ----------
       El nombre dice dónde está el scrum mirando en el sentido del ataque, que es
       hacia x creciente. La touch izquierda del que ataca es la de arriba (y chico),
       así que el scrum de izquierda a derecha va pegado al borde superior y la línea
       abre hacia abajo. */

    scrum_left: {
      name: 'Scrum de izquierda a derecha', group: 'Scrums', ballCarrier: 'a9',
      note: 'Scrum sobre la touch izquierda, campo abierto a la derecha',
      a: {
        1: [48.5, 17.2], 2: [48.5, 15], 3: [48.5, 12.8],
        4: [47.2, 16.1], 5: [47.2, 13.9], 6: [47.2, 18.7], 7: [47.2, 11.3], 8: [45.9, 15],
        9: [44.8, 17.5], 10: [41, 24], 12: [38, 31], 13: [35, 38], 11: [30, 52], 14: [38, 6], 15: [28, 30]
      },
      b: {
        1: [51.5, 12.8], 2: [51.5, 15], 3: [51.5, 17.2],
        4: [52.8, 13.9], 5: [52.8, 16.1], 6: [52.8, 11.3], 7: [52.8, 18.7], 8: [54.1, 15],
        9: [55.2, 13], 10: [52.5, 24], 12: [52.5, 31], 13: [52.5, 38], 11: [52.5, 52], 14: [55, 5], 15: [46, 42]
      }
    },

    scrum_right: {
      name: 'Scrum de derecha a izquierda', group: 'Scrums', ballCarrier: 'a9',
      note: 'Scrum sobre la touch derecha, campo abierto a la izquierda',
      a: {
        1: [48.5, 52.8], 2: [48.5, 55], 3: [48.5, 57.2],
        4: [47.2, 53.9], 5: [47.2, 56.1], 6: [47.2, 51.3], 7: [47.2, 58.7], 8: [45.9, 55],
        9: [44.8, 52.5], 10: [41, 46], 12: [38, 39], 13: [35, 32], 11: [30, 18], 14: [38, 64], 15: [28, 40]
      },
      b: {
        1: [51.5, 57.2], 2: [51.5, 55], 3: [51.5, 52.8],
        4: [52.8, 56.1], 5: [52.8, 53.9], 6: [52.8, 58.7], 7: [52.8, 51.3], 8: [54.1, 55],
        9: [55.2, 57], 10: [52.5, 46], 12: [52.5, 39], 13: [52.5, 32], 11: [52.5, 18], 14: [55, 65], 15: [46, 28]
      }
    },

    scrum_mid: {
      name: 'Scrum en mitad de cancha', group: 'Scrums', ballCarrier: 'a9',
      note: 'Scrum en el centro, con los dos lados abiertos',
      a: {
        1: [48.5, 37.2], 2: [48.5, 35], 3: [48.5, 32.8],
        4: [47.2, 36.1], 5: [47.2, 33.9], 6: [47.2, 38.7], 7: [47.2, 31.3], 8: [45.9, 35],
        9: [44.8, 32.6], 10: [41, 39], 12: [38, 44.5], 13: [35, 50], 11: [30.5, 63],
        14: [37.5, 13], 15: [28.5, 36]
      },
      b: {
        1: [51.5, 32.8], 2: [51.5, 35], 3: [51.5, 37.2],
        4: [52.8, 33.9], 5: [52.8, 36.1], 6: [52.8, 31.3], 7: [52.8, 38.7], 8: [54.1, 35],
        9: [55.2, 37.4], 10: [59, 31], 12: [62, 25.5], 13: [65, 20], 11: [69.5, 7],
        14: [62.5, 57], 15: [71.5, 34]
      }
    },

    /* ---------- line-outs (abren el escenario de line-out) ---------- */

    line7: {
      name: 'Line de 7', group: 'Line-outs', only: true, stage: 'lineout', ballCarrier: 'a2',
      note: 'Siete saltadores, cada 1,5 m entre las marcas de 5 y 15',
      a: {
        2: [50, 0.5], 1: [49.5, 5.5], 3: [49.5, 7], 4: [49.5, 8.5], 5: [49.5, 10],
        6: [49.5, 11.5], 7: [49.5, 13], 8: [49.5, 14.5], 9: [48.2, 9]
      },
      b: {
        2: [51.6, 2.5], 1: [50.5, 5.5], 3: [50.5, 7], 4: [50.5, 8.5], 5: [50.5, 10],
        6: [50.5, 11.5], 7: [50.5, 13], 8: [50.5, 14.5], 9: [51.8, 9]
      }
    },

    line5: {
      name: 'Line de 5', group: 'Line-outs', only: true, stage: 'lineout', ballCarrier: 'a2',
      note: 'Cinco en la línea; 3 y 7 quedan fuera, a la altura del 9',
      a: {
        2: [50, 0.5], 1: [49.5, 5.5], 4: [49.5, 7.75], 5: [49.5, 10], 6: [49.5, 12.25], 8: [49.5, 14.5],
        9: [48.2, 9], 3: [47.2, 4.5], 7: [47.2, 15.5]
      },
      b: {
        2: [51.6, 2.5], 1: [50.5, 5.5], 4: [50.5, 7.75], 5: [50.5, 10], 6: [50.5, 12.25], 8: [50.5, 14.5],
        9: [51.8, 9], 3: [52.8, 4.5], 7: [52.8, 15.5]
      }
    },

    line4: {
      name: 'Line de 4', group: 'Line-outs', only: true, stage: 'lineout', ballCarrier: 'a2',
      note: 'Cuatro en la línea, cada 3 m; el resto sale del line',
      a: {
        2: [50, 0.5], 1: [49.5, 5.5], 4: [49.5, 8.5], 5: [49.5, 11.5], 8: [49.5, 14.5],
        9: [48.2, 9], 3: [47.2, 4.5], 6: [47.2, 12], 7: [47.2, 16]
      },
      b: {
        2: [51.6, 2.5], 1: [50.5, 5.5], 4: [50.5, 8.5], 5: [50.5, 11.5], 8: [50.5, 14.5],
        9: [51.8, 9], 3: [52.8, 4.5], 6: [52.8, 12], 7: [52.8, 16]
      }
    },

    /* ---------- estructuras de ataque ---------- */

    canal3_fuego: {
      name: 'Estructura de canal 3 · Fuego', group: 'Estructuras', ballCarrier: 'a9',
      note: 'Canal 3 directo: línea plana y pod cerrado atacando el hombro de adentro',
      a: {
        1: [45.5, 28], 2: [45.5, 32], 9: [43.8, 30], 10: [42, 36],
        3: [43.5, 40], 4: [42.5, 42.5], 6: [44.5, 42.5],
        5: [42.5, 52], 7: [41.5, 54], 8: [43.5, 54],
        12: [39.5, 46], 13: [37, 54], 15: [36, 49], 11: [33, 65], 14: [38, 12]
      },
      b: {
        1: [46.6, 27.5], 2: [46.6, 32.5], 9: [47.8, 30],
        3: [47, 37], 4: [47, 41], 6: [47, 45], 8: [47, 49], 5: [47, 53], 7: [47, 57],
        10: [47, 61], 12: [47, 65.5], 13: [43, 58], 15: [40, 50], 11: [44.5, 67.5], 14: [42, 16]
      }
    },

    canal3_agua: {
      name: 'Estructura de canal 3 · Agua', group: 'Estructuras', ballCarrier: 'a9',
      note: 'Canal 3 con profundidad: 10 atrás, 15 entra por dentro y se busca el ancho',
      a: {
        1: [45.5, 28], 2: [45.5, 32], 9: [43.8, 30], 10: [39, 38],
        3: [41.5, 44], 4: [40.5, 46], 6: [42.5, 46],
        5: [39.5, 58], 7: [38.5, 60], 8: [40.5, 60],
        12: [36, 48], 13: [33, 56], 15: [34.5, 43], 11: [30, 66], 14: [36, 12]
      },
      b: {
        1: [46.6, 27.5], 2: [46.6, 32.5], 9: [47.8, 30],
        3: [47, 37], 4: [47, 41], 6: [47, 45], 8: [47, 49], 5: [47, 53], 7: [47, 57],
        10: [47, 61], 12: [47, 65.5], 13: [42, 60], 15: [38, 52], 11: [43.5, 68], 14: [40, 16]
      }
    },

    /* ---------- otras ---------- */

    /* ---------- punto de partida para armar uno nuevo ---------- */

    empty: {
      name: 'Cancha vacía', group: 'Crear set up', only: true, ballCarrier: null,
      note: 'Sumá jugadores con la herramienta Jugador y guardá el set up',
      a: {}, b: {}
    },

    manual: {
      name: 'Equipos alineados 1 a 15', group: 'Crear set up', ballCarrier: null,
      note: 'Arrastrá a cada uno a su lugar y guardá el set up',
      a: lineUp(30), b: lineUp(70)
    }
  };

  /* ---------- catálogo de set ups ----------

     Cuatro capas, cada una encima de la anterior:

       fábrica   las doce situaciones que trae la app
       global    lo que publica el administrador del producto
       club      la base que deja el club
       personal  el trabajo de cada entrenador

     El catálogo son filas, con la misma forma que las del servidor. El navegador
     guarda una copia: así la app abre sin esperar la red y sigue andando sin
     cuenta. sync.js es el que las sube y las baja. */

  const CAT_KEY = 'rugbyboard.catalog.v1';
  const PLAY_KEY = 'rugbyboard.playrows.v1';
  const OLD_FORM_KEY = 'rugbyboard.formations.v1';   /* lo de antes, sólo para mudarlo */
  const OLD_SETUP_KEY = 'rugbyboard.setups.v1';
  const OLD_PLAY_KEY = 'rugbyboard.plays.v1';

  /* copia intacta de fábrica, para poder restaurar */
  const BASE = {};
  for (const k of Object.keys(FORMATIONS)) BASE[k] = JSON.parse(JSON.stringify(FORMATIONS[k]));

  /* quién está trabajando. Sin cuenta es 'local': todo queda en esta máquina. */
  const me = { user: 'local', club: null, admin: false, clubAdmin: false, cuenta: false };

  let rows = [];        /* filas de set ups */
  let playRows = [];    /* filas de jugadas */
  let avisar = null;    /* sync.js engancha acá para subir lo que cambió */

  const CAPA = { global: 1, club: 2, personal: 3 };
  const GRUPO = { global: 'De la app', club: 'Del club', personal: 'Mis set ups' };

  function suf() { return me.user === 'local' ? '' : '.' + me.user; }
  function bolsa(kind) { return kind === 'plays' ? playRows : rows; }
  function clave(kind) { return (kind === 'plays' ? PLAY_KEY : CAT_KEY) + suf(); }

  function leerJSON(key, vacio) {
    try { const r = JSON.parse(localStorage.getItem(key) || 'null'); return r == null ? vacio : r; }
    catch (e) { return vacio; }
  }
  function escribir(kind) {
    try { localStorage.setItem(clave(kind), JSON.stringify(bolsa(kind))); return true; }
    catch (e) { return false; }
  }

  /* la fila se ve si es global, si es de un club mío, o si es mía */
  function visible(r) {
    if (r.deleted) return false;
    if (r.scope === 'global') return true;
    if (r.scope === 'club') return !!me.club && r.club_id === me.club;
    return !r.owner_id || r.owner_id === me.user;
  }

  function keyDe(r) { return r.base_key || ('c:' + r.id); }

  /* arma FORMATIONS: fábrica abajo, después global, club y lo personal */
  function rebuild() {
    for (const k of Object.keys(FORMATIONS)) if (!BASE[k]) delete FORMATIONS[k];
    for (const k of Object.keys(BASE)) FORMATIONS[k] = JSON.parse(JSON.stringify(BASE[k]));
    const puestas = rows.filter(visible).slice().sort((a, b) => CAPA[a.scope] - CAPA[b.scope]);
    for (const r of puestas) {
      const k = keyDe(r);
      const d = r.data || {};
      if (BASE[k]) {
        FORMATIONS[k] = Object.assign({}, BASE[k], d, {
          name: BASE[k].name, group: BASE[k].group, edited: true, origen: r.scope, rowId: r.id
        });
      } else {
        FORMATIONS[k] = Object.assign({}, d, {
          name: r.name, group: GRUPO[r.scope] || 'Mis set ups', user: true, origen: r.scope, rowId: r.id
        });
      }
    }
  }

  function formationList() {
    return Object.keys(FORMATIONS).map((k) => ({
      key: k, name: FORMATIONS[k].name, group: FORMATIONS[k].group || 'Otras',
      origen: FORMATIONS[k].origen || 'base'
    }));
  }

  /* ---------- quién puede escribir en cada capa ---------- */

  function canWrite(scope) {
    if (scope === 'personal') return true;
    if (scope === 'club') return !!me.club && me.clubAdmin;
    if (scope === 'global') return !!me.admin;
    return false;
  }
  function writableLevels() { return ['personal', 'club', 'global'].filter(canWrite); }
  function whoAmI() { return Object.assign({}, me); }

  /* ---------- alta y corrección de filas ---------- */

  function nuevaFila(kind, campos) {
    const r = Object.assign({ id: 'l:' + uid(), owner_id: me.user }, campos);
    r.updated = Date.now(); r.dirty = true;
    bolsa(kind).push(r);
    return r;
  }

  function tocar(kind, r, campos) {
    Object.assign(r, campos, { updated: Date.now(), dirty: true, deleted: false });
    return r;
  }

  function guardado(kind) {
    const ok = escribir(kind);
    rebuild();
    if (avisar) { try { avisar(kind); } catch (e) { /* sin cuenta no hay a quién avisar */ } }
    return ok;
  }

  /* la fila queda marcada para borrar: sync la baja del servidor y recién ahí sale */
  function borrarFila(kind, id) {
    const b = bolsa(kind);
    const i = b.findIndex((r) => r.id === id);
    if (i < 0) return false;
    if (String(id).indexOf('l:') === 0) b.splice(i, 1);   /* nunca llegó al servidor */
    else { b[i].deleted = true; b[i].dirty = true; b[i].updated = Date.now(); }
    return guardado(kind);
  }

  const round2 = (n) => Math.round(n * 100) / 100;

  /* toma la posición que hay en pantalla y la convierte en set up */
  function captureSetup(name, frameIdx) {
    const fr = frame(frameIdx);
    const f = {
      name: name, only: true, stage: state.stage, note: fr.note || '',
      ballCarrier: fr.ball.carrier, a: {}, b: {}
    };
    for (const p of state.players) {
      const q = fr.pos[p.id];
      if (q) f[p.team][p.num] = [round2(q.x), round2(q.y)];
    }
    return f;
  }

  function filaDeSetup(scope, baseKey, nombre) {
    return rows.find((r) => !r.deleted && r.scope === scope &&
      (scope !== 'club' || r.club_id === me.club) &&
      (scope !== 'personal' || !r.owner_id || r.owner_id === me.user) &&
      (baseKey ? r.base_key === baseKey : (!r.base_key && r.name === nombre)));
  }

  /* guarda como set up nuevo, en la capa que se pida */
  function saveFormation(name, frameIdx, scope) {
    scope = scope || 'personal';
    if (!canWrite(scope)) return null;
    const f = captureSetup(name, frameIdx);
    const previa = filaDeSetup(scope, null, name);   /* mismo nombre: se corrige */
    const fila = previa
      ? tocar('setups', previa, { name: name, data: f })
      : nuevaFila('setups', { scope: scope, club_id: scope === 'club' ? me.club : null, base_key: null, name: name, data: f });
    guardado('setups');
    return keyDe(fila);
  }

  /* guarda encima del set up que está abierto, sea de fábrica o propio */
  function saveIntoSetup(key, frameIdx, scope) {
    const actual = FORMATIONS[key];
    if (!actual) return false;
    scope = scope || 'personal';
    if (!canWrite(scope)) return false;
    const f = captureSetup(actual.name, frameIdx);

    if (BASE[key]) {   /* una de las doce: cada capa guarda su versión */
      const previa = filaDeSetup(scope, key, actual.name);
      if (previa) tocar('setups', previa, { name: actual.name, data: f });
      else nuevaFila('setups', { scope: scope, club_id: scope === 'club' ? me.club : null, base_key: key, name: actual.name, data: f });
      return guardado('setups');
    }

    /* uno creado: si cambia de capa se muda, no se duplica */
    const fila = rows.find((r) => r.id === actual.rowId);
    if (fila && fila.scope === scope) { tocar('setups', fila, { data: f }); return guardado('setups'); }
    if (fila && canWrite(fila.scope)) borrarFila('setups', fila.id);
    nuevaFila('setups', { scope: scope, club_id: scope === 'club' ? me.club : null, base_key: null, name: actual.name, data: f });
    return guardado('setups');
  }

  /* saca la versión de arriba: el set up vuelve a la capa de abajo */
  function restoreSetup(key) {
    const f = FORMATIONS[key];
    if (!f || !f.rowId || !canWrite(f.origen)) return false;
    return borrarFila('setups', f.rowId);
  }

  const deleteFormation = restoreSetup;

  function isUserFormation(key) { return !!(FORMATIONS[key] && FORMATIONS[key].user); }
  function isEditedSetup(key) { return !!(FORMATIONS[key] && FORMATIONS[key].edited); }
  function isBaseSetup(key) { return !!BASE[key]; }
  function setupOrigin(key) { return (FORMATIONS[key] && FORMATIONS[key].origen) || 'base'; }
  /* ¿puedo sacar lo que hay encima de este set up? */
  function canEditSetup(key) {
    const f = FORMATIONS[key];
    return !!(f && f.rowId && canWrite(f.origen));
  }

  /* ---------- lo que usa sync.js ---------- */

  /* entra a la cuenta (o vuelve a lo local con null) y lee el espejo que corresponda */
  function useAccount(info) {
    me.user = info && info.user ? info.user : 'local';
    me.club = (info && info.club) || null;
    me.admin = !!(info && info.admin);
    me.clubAdmin = !!(info && info.clubAdmin);
    me.cuenta = !!(info && info.user);
    rows = leerJSON(clave('setups'), []);
    playRows = leerJSON(clave('plays'), []);
    let mudado = 0;
    if (!me.cuenta) {
      mudado = migrarViejo();       /* lo guardado con el formato anterior */
    } else if (!rows.length && !playRows.length) {
      const suelto = localLeftovers(true);   /* lo que venía trabajando sin cuenta */
      mudado = adoptRows('setups', suelto.setups) + adoptRows('plays', suelto.plays);
    }
    rebuild();
    return mudado;
  }

  function onChange(fn) { avisar = fn; }
  function allRows(kind) { return bolsa(kind).slice(); }
  function pending(kind) { return bolsa(kind).filter((r) => r.dirty || r.deleted); }

  /* la fila local ya está en el servidor: se queda con el id de allá */
  function adopt(kind, localId, servidor) {
    const b = bolsa(kind);
    const i = b.findIndex((r) => r.id === localId);
    if (i < 0) return;
    b[i] = Object.assign({}, b[i], servidor || {}, { dirty: false, updated: Date.now() });
    escribir(kind); rebuild();
  }

  function forget(kind, id) {
    const b = bolsa(kind);
    const i = b.findIndex((r) => r.id === id);
    if (i >= 0) b.splice(i, 1);
    escribir(kind); rebuild();
  }

  /* llega la lista del servidor: manda ella, salvo en lo que todavía no subió */
  function applyRemote(kind, filas) {
    const sinSubir = bolsa(kind).filter((r) => r.dirty || r.deleted);
    const nuevas = (filas || []).filter((r) => !sinSubir.some((p) => p.id === r.id));
    const b = sinSubir.concat(nuevas);
    if (kind === 'plays') playRows = b; else rows = b;
    escribir(kind); rebuild();
  }

  /* Lo que quedó en esta máquina trabajando sin cuenta, para subirlo al entrar.
     Se marca lo que ya se llevó: si dos entrenadores usan la misma máquina, el
     trabajo suelto va a la cuenta del primero y no se le copia al segundo. */
  function localLeftovers(marcar) {
    const cuenta = me.user;
    me.user = 'local';
    const s = leerJSON(clave('setups'), []);
    const p = leerJSON(clave('plays'), []);
    const sueltas = (b) => b.filter((r) => !r.deleted && !r.mudado);
    const salida = { setups: sueltas(s), plays: sueltas(p) };
    if (marcar) {
      for (const r of salida.setups) r.mudado = true;
      for (const r of salida.plays) r.mudado = true;
      try {
        localStorage.setItem(clave('setups'), JSON.stringify(s));
        localStorage.setItem(clave('plays'), JSON.stringify(p));
      } catch (e) { /* si no entra, se vuelve a ofrecer la próxima vez */ }
    }
    me.user = cuenta;
    return salida;
  }

  /* mete filas de otro lado como propias, sin pisar lo que ya hay */
  function adoptRows(kind, filas) {
    let n = 0;
    for (const r of filas || []) {
      const copia = Object.assign({}, r, {
        id: 'l:' + uid(), owner_id: me.user, scope: 'personal', club_id: null,
        dirty: true, deleted: false, mudado: false, updated: Date.now()
      });
      if (kind === 'setups') {
        if (filaDeSetup('personal', copia.base_key, copia.name)) continue;
        rows.push(copia);
      } else {
        const yaEsta = playRows.some((x) => !x.deleted && x.scope === 'personal' &&
          x.data && copia.data && x.data.id === copia.data.id);
        if (yaEsta) continue;
        playRows.push(copia);
      }
      n++;
    }
    if (n) guardado(kind);
    return n;
  }

  /* ---------- mudanza de lo guardado con el formato viejo ---------- */

  function migrarViejo() {
    if (rows.length || playRows.length) return 0;
    let n = 0;
    const ov = leerJSON(OLD_SETUP_KEY, {});
    for (const k of Object.keys(ov)) {
      if (!BASE[k]) continue;
      nuevaFila('setups', { scope: 'personal', club_id: null, base_key: k, name: BASE[k].name, data: ov[k] });
      n++;
    }
    const propios = leerJSON(OLD_FORM_KEY, {});
    for (const k of Object.keys(propios)) {
      const f = propios[k];
      nuevaFila('setups', { scope: 'personal', club_id: null, base_key: null, name: f.name || 'Set up', data: f });
      n++;
    }
    const jug = leerJSON(OLD_PLAY_KEY, {});
    for (const k of Object.keys(jug)) {
      nuevaFila('plays', { scope: 'personal', club_id: null, name: jug[k].name || '(sin nombre)', data: jug[k] });
      n++;
    }
    if (n) { escribir('setups'); escribir('plays'); }
    return n;
  }

  /* al arrancar: lee el espejo de esta máquina */
  function loadUserFormations() {
    useAccount(null);
    return rows.length;
  }

  /* ---------- paquete para pasar los set ups a otro entrenador ---------- */

  /* Todo lo propio en un archivo: set ups y jugadas. Sirve para pasarle el
     trabajo a otro entrenador y para mudarlo de una dirección web a otra, que es
     el caso de siempre: lo guardado es de cada dirección, no viaja solo. */
  function exportAll() {
    return {
      v: 3, kind: 'rugbyboard-setups', saved: Date.now(),
      rows: rows.filter((r) => !r.deleted && r.scope === 'personal')
        .map((r) => ({ base_key: r.base_key, name: r.name, data: r.data })),
      plays: playRows.filter((r) => !r.deleted && r.scope === 'personal')
        .map((r) => ({ name: r.name, data: r.data }))
    };
  }

  function importAll(data, replace) {
    if (!data || data.kind !== 'rugbyboard-setups') throw new Error('Eso no es un paquete de Rugby Board');
    if (replace) {
      for (const r of rows.filter((x) => x.scope === 'personal')) borrarFila('setups', r.id);
      for (const r of playRows.filter((x) => x.scope === 'personal')) borrarFila('plays', r.id);
    }

    /* la primera versión traía dos bolsas de set ups; después, filas */
    let filas = data.rows;
    if (!filas) {
      filas = [];
      for (const k of Object.keys(data.overrides || {})) if (BASE[k]) filas.push({ base_key: k, name: BASE[k].name, data: data.overrides[k] });
      for (const k of Object.keys(data.own || {})) filas.push({ base_key: null, name: (data.own[k] || {}).name || 'Set up', data: data.own[k] });
    }

    let setups = 0;
    for (const f of filas) {
      const previa = filaDeSetup('personal', f.base_key, f.name);
      if (previa) tocar('setups', previa, { name: f.name, data: f.data });
      else nuevaFila('setups', { scope: 'personal', club_id: null, base_key: f.base_key || null, name: f.name, data: f.data });
      setups++;
    }
    if (setups) guardado('setups');

    let jugadas = 0;
    for (const j of data.plays || []) {
      if (!j.data || !Array.isArray(j.data.frames)) continue;
      const nombre = j.name || j.data.name || '(sin nombre)';
      const previa = filaDeJugada('personal', j.data.id, nombre);
      if (previa) tocar('plays', previa, { name: nombre, data: j.data });
      else nuevaFila('plays', { scope: 'personal', club_id: null, name: nombre, data: j.data });
      jugadas++;
    }
    if (jugadas) guardado('plays');

    return { setups: setups, plays: jugadas };
  }

  /* ---------- estado ---------- */

  const state = {
    id: uid(),
    name: 'Jugada sin nombre',
    squad: 15,
    lastFormation: 'kickoff_for',
    setupKey: 'kickoff_for',
    stage: 'field',
    showB: true,
    colors: { a: '#e8503a', b: '#3f7fe0' },
    players: [],
    frames: []
  };

  function blankFrame() {
    return { id: uid(), dur: 1.2, note: '', pos: {}, routes: {}, ball: { carrier: null, x: 50, y: 35 }, ballRoute: null, ann: [] };
  }

  function frame(i) { return state.frames[G.clamp(i, 0, state.frames.length - 1)]; }
  function frameCount() { return state.frames.length; }
  function player(id) { return state.players.find((p) => p.id === id) || null; }
  function activePlayers() { return state.showB ? state.players : state.players.filter((p) => p.team === 'a'); }

  function pos(frameIdx, playerId) {
    const f = frame(frameIdx);
    return (f && f.pos[playerId]) || { x: 50, y: 35 };
  }

  /* coloca a todos en fila fuera de la cancha, por si falta un puesto en la formacion */
  function benchSpot(team, i) {
    return team === 'a' ? { x: 4 + i * 3, y: -4 } : { x: 96 - i * 3, y: 74 };
  }

  /* Arma el plantel que pide la formación: las parciales traen su propia lista
     de camisetas; las completas usan el formato de juego elegido. */
  function rosterFor(f, withB) {
    const teams = withB ? ['a', 'b'] : ['a'];
    const out = [];
    for (const team of teams) {
      const nums = f.only
        ? Object.keys(f[team] || {}).map(Number).sort((x, y) => x - y)
        : (SQUADS[state.squad] || SQUADS[15]);
      for (const num of nums) out.push({ id: team + num, team, num, label: POSITION_NAMES[num] || ('#' + num) });
    }
    return out;
  }

  function applyFormation(key, frameIdx, withB) {
    const f = FORMATIONS[key];
    if (!f) return;
    state.lastFormation = key;
    state.setupKey = key;
    state.players = rosterFor(f, withB !== false);
    const fr = frame(frameIdx);
    fr.pos = {};
    let benchA = 0, benchB = 0;
    for (const p of state.players) {
      const table = f[p.team];
      const spot = table && table[p.num];
      if (spot) fr.pos[p.id] = { x: spot[0], y: spot[1] };
      else fr.pos[p.id] = p.team === 'a' ? benchSpot('a', benchA++) : benchSpot('b', benchB++);
    }
    if (f.ballCarrier && player(f.ballCarrier)) {
      fr.ball = { carrier: f.ballCarrier, x: 0, y: 0 };
    } else {
      fr.ball = { carrier: null, x: 50, y: 35 };
    }
    fr.routes = {};
    fr.ballRoute = null;
    fr.note = f.note || '';
  }

  /* ---------- plantel a mano ---------- */

  function nextNumber(team) {
    const used = new Set(state.players.filter((p) => p.team === team).map((p) => p.num));
    for (let n = 1; n <= 99; n++) if (!used.has(n)) return n;
    return 99;
  }

  function addPlayer(team, at, num) {
    const n = num || nextNumber(team);
    const id = team + n + (state.players.some((p) => p.id === team + n) ? '_' + uid().slice(0, 3) : '');
    const p = { id, team, num: n, label: POSITION_NAMES[n] || ('#' + n) };
    state.players.push(p);
    for (const fr of state.frames) fr.pos[id] = { x: at.x, y: at.y };
    return p;
  }

  function removePlayer(id) {
    const i = state.players.findIndex((p) => p.id === id);
    if (i < 0) return false;
    state.players.splice(i, 1);
    state.frames.forEach((fr, idx) => {
      if (fr.ball.carrier === id) {
        const b = ballStatic(idx);
        fr.ball = { carrier: null, x: b.x, y: b.y };
      }
      delete fr.pos[id];
      delete fr.routes[id];
    });
    return true;
  }

  function rebuildSquad(size, formationKey) {
    state.squad = size;
    state.players = makePlayers(size);
    for (const fr of state.frames) {
      const keep = {};
      for (const p of state.players) keep[p.id] = fr.pos[p.id] || { x: 50, y: 35 };
      fr.pos = keep;
      for (const id of Object.keys(fr.routes)) if (!keep[id]) delete fr.routes[id];
      if (fr.ball.carrier && !player(fr.ball.carrier)) fr.ball = { carrier: null, x: 50, y: 35 };
    }
    if (formationKey) applyFormation(formationKey, 0);
  }

  function newPlay(size, formationKey) {
    state.id = uid();
    state.name = 'Jugada sin nombre';
    state.squad = size || 15;
    state.showB = true;
    state.players = makePlayers(state.squad);
    state.frames = [blankFrame()];
    applyFormation(formationKey || 'kickoff_for', 0);
    resetHistory();
  }

  /* ---------- frames ---------- */

  function addFrame(afterIdx) {
    const src = frame(afterIdx);
    const nf = blankFrame();
    nf.dur = src.dur;
    for (const id of Object.keys(src.pos)) nf.pos[id] = { x: src.pos[id].x, y: src.pos[id].y };
    nf.ball = { carrier: src.ball.carrier, x: src.ball.x, y: src.ball.y };
    if (!src.ball.carrier) {
      const bp = ballStatic(afterIdx);
      nf.ball.x = bp.x; nf.ball.y = bp.y;
    }
    /* conos y textos son referencias fijas: siguen presentes en el frame nuevo */
    for (const a of src.ann) {
      if (a.type === 'cone' || a.type === 'text') nf.ann.push(Object.assign({}, a, { id: uid() }));
    }
    state.frames.splice(afterIdx + 1, 0, nf);
    return afterIdx + 1;
  }

  function duplicateFrame(idx) {
    const copy = JSON.parse(JSON.stringify(frame(idx)));
    copy.id = uid();
    for (const a of copy.ann) a.id = uid();
    state.frames.splice(idx + 1, 0, copy);
    return idx + 1;
  }

  function deleteFrame(idx) {
    if (state.frames.length <= 1) return idx;
    state.frames.splice(idx, 1);
    return G.clamp(idx, 0, state.frames.length - 1);
  }

  /* mover a un jugador en un frame; arrastra los frames siguientes que no fueron editados */
  function setPos(frameIdx, playerId, pt, propagate) {
    const fr = frame(frameIdx);
    const old = fr.pos[playerId];
    const next = { x: pt.x, y: pt.y };
    if (propagate !== false && old) {
      for (let i = frameIdx + 1; i < state.frames.length; i++) {
        const q = state.frames[i].pos[playerId];
        if (!q || Math.abs(q.x - old.x) > 1e-6 || Math.abs(q.y - old.y) > 1e-6) break;
        state.frames[i].pos[playerId] = { x: next.x, y: next.y };
        const r = state.frames[i].routes[playerId];
        if (r && r.pts.length) { r.pts[0] = { x: next.x, y: next.y }; r.pts[r.pts.length - 1] = { x: next.x, y: next.y }; }
      }
    }
    fr.pos[playerId] = next;
    /* la ruta que llega a este frame termina donde esta el jugador */
    const rin = fr.routes[playerId];
    if (rin && rin.pts.length) rin.pts[rin.pts.length - 1] = { x: next.x, y: next.y };
    /* la ruta que sale de este frame arranca donde esta el jugador */
    const nf = state.frames[frameIdx + 1];
    if (nf && nf.routes[playerId] && nf.routes[playerId].pts.length) nf.routes[playerId].pts[0] = { x: next.x, y: next.y };
  }

  function setRoute(frameIdx, playerId, pts, kind) {
    if (frameIdx <= 0) return false;
    const fr = frame(frameIdx);
    if (!pts || pts.length < 2) { delete fr.routes[playerId]; return false; }
    const start = pos(frameIdx - 1, playerId);
    const clean = pts.slice();
    clean[0] = { x: start.x, y: start.y };
    fr.routes[playerId] = { pts: clean, kind: kind || 'run' };
    setPos(frameIdx, playerId, clean[clean.length - 1], false);
    return true;
  }

  function clearRoute(frameIdx, playerId) {
    const fr = frame(frameIdx);
    delete fr.routes[playerId];
  }

  /* ---------- pelota ---------- */

  /* La pelota en manos va en la posición del jugador: el corrimiento para que
     se vea al costado de la ficha lo hace el dibujo, en píxeles, así queda
     igual de pegada en la cancha completa y en el escenario de line-out. */
  function carryPos(p) {
    return { x: p.x, y: p.y, held: true };
  }

  function ballStatic(frameIdx) {
    const fr = frame(frameIdx);
    if (fr.ball.carrier && fr.pos[fr.ball.carrier]) return carryPos(fr.pos[fr.ball.carrier]);
    return { x: fr.ball.x, y: fr.ball.y, held: false };
  }

  function setCarrier(frameIdx, playerId) {
    const fr = frame(frameIdx);
    fr.ball.carrier = playerId;
    if (!playerId) { const b = ballStatic(frameIdx); fr.ball.x = b.x; fr.ball.y = b.y; }
    fr.ballRoute = null;
  }

  /* ---------- muestreo para la animacion ---------- */

  function playerAt(frameIdx, playerId, t) {
    if (frameIdx <= 0) return pos(0, playerId);
    const fr = frame(frameIdx);
    const e = G.easeInOut(G.clamp(t, 0, 1));
    const route = fr.routes[playerId];
    if (route && route.pts.length > 1) return G.pointOnPath(route.pts, e);
    return G.lerpPoint(pos(frameIdx - 1, playerId), pos(frameIdx, playerId), e);
  }

  function ballAt(frameIdx, t) {
    if (frameIdx <= 0) return ballStatic(0);
    const prev = frame(frameIdx - 1), cur = frame(frameIdx);
    const e = G.easeInOut(G.clamp(t, 0, 1));

    if (cur.ballRoute && cur.ballRoute.pts.length > 1) {
      const q = G.pointOnPath(cur.ballRoute.pts, e);
      return { x: q.x, y: q.y, held: false };
    }

    /* el mismo jugador la lleva todo el tramo: la pelota va con él */
    if (cur.ball.carrier && cur.ball.carrier === prev.ball.carrier) {
      return carryPos(playerAt(frameIdx, cur.ball.carrier, t));
    }

    const from = prev.ball.carrier
      ? playerAt(frameIdx, prev.ball.carrier, t)
      : { x: prev.ball.x, y: prev.ball.y };
    const to = cur.ball.carrier
      ? playerAt(frameIdx, cur.ball.carrier, t)
      : { x: cur.ball.x, y: cur.ball.y };

    const q = G.lerpPoint(from, to, e);
    /* pequeño arco para que el pase no sea una recta plana */
    const d = G.dist(from, to);
    const lift = Math.sin(Math.PI * e) * Math.min(1.6, d * 0.08);
    /* sale del centro del que pasa y termina al costado del que recibe */
    return { x: q.x, y: q.y - lift, held: cur.ball.carrier ? e : 0 };
  }

  function totalDuration() {
    let s = 0;
    for (let i = 1; i < state.frames.length; i++) s += state.frames[i].dur;
    return s;
  }

  /* tiempo global -> frame destino + fraccion local */
  function resolveTime(time) {
    if (state.frames.length < 2) return { k: 0, t: 0 };
    let acc = 0;
    for (let i = 1; i < state.frames.length; i++) {
      const d = state.frames[i].dur;
      if (time <= acc + d || i === state.frames.length - 1) {
        return { k: i, t: d <= 0 ? 1 : G.clamp((time - acc) / d, 0, 1) };
      }
      acc += d;
    }
    return { k: state.frames.length - 1, t: 1 };
  }

  function timeOfFrame(idx) {
    let acc = 0;
    for (let i = 1; i <= idx && i < state.frames.length; i++) acc += state.frames[i].dur;
    return acc;
  }

  function sampleAt(time) {
    const { k, t } = resolveTime(time);
    const out = { k, t, pos: {}, ball: null };
    for (const p of state.players) out.pos[p.id] = k === 0 ? pos(0, p.id) : playerAt(k, p.id, t);
    out.ball = k === 0 ? ballStatic(0) : ballAt(k, t);
    return out;
  }

  /* ---------- anotaciones ---------- */

  function addAnnotation(frameIdx, ann) {
    ann.id = uid();
    frame(frameIdx).ann.push(ann);
    return ann;
  }

  function removeAnnotation(frameIdx, id) {
    const fr = frame(frameIdx);
    const i = fr.ann.findIndex((a) => a.id === id);
    if (i >= 0) fr.ann.splice(i, 1);
  }

  /* ---------- historial ---------- */

  const history = { undo: [], redo: [], limit: 80 };

  function snapshot() { return JSON.stringify({ name: state.name, squad: state.squad, showB: state.showB, lastFormation: state.lastFormation, stage: state.stage, colors: state.colors, players: state.players, frames: state.frames }); }

  function restore(json) {
    const s = JSON.parse(json);
    state.name = s.name; state.squad = s.squad; state.showB = s.showB; state.lastFormation = s.lastFormation; state.stage = s.stage || 'field';
    state.colors = s.colors; state.players = s.players; state.frames = s.frames;
  }

  function commit() {
    history.undo.push(snapshot());
    if (history.undo.length > history.limit) history.undo.shift();
    history.redo.length = 0;
  }

  function resetHistory() { history.undo.length = 0; history.redo.length = 0; }

  function undo() {
    if (!history.undo.length) return false;
    history.redo.push(snapshot());
    restore(history.undo.pop());
    return true;
  }

  function redo() {
    if (!history.redo.length) return false;
    history.undo.push(snapshot());
    restore(history.redo.pop());
    return true;
  }

  /* ---------- serializacion / guardado ---------- */

  function serialize() {
    return {
      v: 1, id: state.id, name: state.name, squad: state.squad, showB: state.showB,
      colors: state.colors, players: state.players, frames: state.frames, stage: state.stage, saved: Date.now()
    };
  }

  function load(data) {
    if (!data || !Array.isArray(data.frames) || !data.frames.length) throw new Error('Archivo de jugada invalido');
    state.id = data.id || uid();
    state.name = data.name || 'Jugada importada';
    state.squad = data.squad || 15;
    state.showB = data.showB !== false;
    state.stage = data.stage || 'field';
    state.colors = data.colors || { a: '#e8503a', b: '#3f7fe0' };
    state.players = data.players && data.players.length ? data.players : makePlayers(state.squad);
    state.frames = data.frames.map((f) => ({
      id: f.id || uid(), dur: f.dur || 1.2, note: f.note || '',
      pos: f.pos || {}, routes: f.routes || {},
      ball: f.ball || { carrier: null, x: 50, y: 35 },
      ballRoute: f.ballRoute || null, ann: f.ann || []
    }));
    resetHistory();
  }

  /* Las jugadas guardadas viven en filas, igual que los set ups: la capa dice si
     son propias, del club o de la app. */

  let filaAbierta = null;   /* la fila del catálogo que se está editando */

  function filaDeJugada(scope, playId, nombre) {
    return playRows.find((r) => !r.deleted && r.scope === scope &&
      (scope !== 'club' || r.club_id === me.club) &&
      (scope !== 'personal' || !r.owner_id || r.owner_id === me.user) &&
      ((playId && r.data && r.data.id === playId) || (!playId && r.name === nombre)));
  }

  function savePlay(scope) {
    scope = scope || 'personal';
    if (!canWrite(scope)) return false;
    const data = serialize();
    const previa = filaDeJugada(scope, state.id, state.name);
    const fila = previa
      ? tocar('plays', previa, { name: state.name, data: data })
      : nuevaFila('plays', { scope: scope, club_id: scope === 'club' ? me.club : null, name: state.name, data: data });
    filaAbierta = fila.id;
    guardado('plays');
    return fila.id;
  }

  function listPlays() {
    return playRows.filter(visible)
      .map((r) => ({
        id: r.id, name: (r.data && r.data.name) || r.name || '(sin nombre)',
        saved: (r.data && r.data.saved) || r.updated || 0,
        origen: r.scope, propia: r.scope === 'personal'
      }))
      .sort((x, y) => y.saved - x.saved);
  }

  function loadPlay(id) {
    const r = playRows.find((x) => x.id === id && !x.deleted);
    if (!r || !r.data) return false;
    load(r.data);
    filaAbierta = r.id;
    return true;
  }

  function deletePlay(id) {
    const r = playRows.find((x) => x.id === id);
    if (!r || !canWrite(r.scope)) return false;
    return borrarFila('plays', id);
  }

  function playRow() { return filaAbierta; }

  function playOrigin(id) {
    const r = playRows.find((x) => x.id === id);
    return r ? r.scope : 'personal';
  }

  return {
    state, POSITION_NAMES, SQUADS, FORMATIONS, formationList,
    blankFrame, frame, frameCount, player, activePlayers, pos,
    newPlay, rebuildSquad, applyFormation, addPlayer, removePlayer, nextNumber,
    loadUserFormations, saveFormation, saveIntoSetup, restoreSetup, deleteFormation,
    isUserFormation, isEditedSetup, isBaseSetup, setupOrigin, canEditSetup,
    canWrite, writableLevels, whoAmI, exportAll, importAll,
    useAccount, onChange, allRows, pending, adopt, forget, applyRemote,
    localLeftovers, adoptRows, playOrigin, playRow,
    addFrame, duplicateFrame, deleteFrame,
    setPos, setRoute, clearRoute,
    ballStatic, setCarrier, carryPos,
    playerAt, ballAt, sampleAt, totalDuration, resolveTime, timeOfFrame,
    addAnnotation, removeAnnotation,
    commit, undo, redo, resetHistory, history,
    serialize, load, savePlay, listPlays, loadPlay, deletePlay
  };
})();
