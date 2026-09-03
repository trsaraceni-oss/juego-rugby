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
    attack: {
      name: 'Ataque en fase (1-3-3-1)',
      ballCarrier: 'a9',
      a: {
        1: [45.5, 33.2], 2: [45.5, 36.8], 3: [43.8, 40.5], 4: [42.2, 46.5], 6: [43.4, 48.4],
        8: [41.4, 48.8], 5: [39.4, 58.5], 7: [38.2, 60.4], 9: [43.6, 35], 10: [40, 41.5],
        12: [36.5, 52], 13: [33.5, 58.5], 11: [29.5, 66.5], 14: [33, 9], 15: [28, 44]
      },
      b: {
        8: [46.6, 22], 5: [46.4, 26], 7: [46.2, 29.8], 1: [46, 33], 2: [46, 37.4],
        9: [47.6, 35], 3: [46.8, 41.5], 4: [46.8, 45.6], 6: [46.8, 49.8],
        10: [46.8, 54], 12: [46.8, 58], 13: [46.8, 62], 11: [46.6, 67],
        15: [37, 54], 14: [39, 14]
      }
    },
    scrum: {
      name: 'Scrum en mitad de cancha',
      ballCarrier: 'a9',
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
    lineout: {
      name: 'Line-out de 7 (touch izquierda)',
      ballCarrier: 'a2',
      a: {
        2: [40, 0.6], 1: [38.8, 5.5], 3: [38.8, 8], 4: [38.8, 10.5], 5: [38.8, 13],
        6: [38.8, 15.5], 7: [38.8, 18], 8: [38.8, 20.5],
        9: [37.6, 8.5], 10: [34.5, 17], 12: [32, 24], 13: [29.5, 31],
        11: [26, 44], 14: [31, 4.5], 15: [24, 20]
      },
      b: {
        2: [41.8, 3], 1: [41.2, 5.5], 3: [41.2, 8], 4: [41.2, 10.5], 5: [41.2, 13],
        6: [41.2, 15.5], 7: [41.2, 18], 8: [41.2, 20.5],
        9: [42.5, 9], 10: [44.5, 16], 12: [46.5, 24], 13: [48.5, 32],
        11: [50, 46], 14: [44, 4.5], 15: [52, 22]
      }
    },
    kickoff: {
      name: 'Salida desde mitad',
      ballCarrier: 'a10',
      a: {
        10: [49, 35], 9: [47, 30], 8: [48.5, 12], 6: [48.5, 16], 4: [48.5, 20],
        2: [48.5, 24], 1: [46.5, 20], 3: [46.5, 26], 5: [46.5, 15], 7: [48.5, 42],
        12: [46, 46], 13: [44, 52], 11: [44, 62], 14: [45, 6], 15: [40, 35]
      },
      b: {
        1: [58, 12], 2: [58, 18], 3: [58, 24], 4: [60, 15], 5: [60, 21],
        6: [58, 30], 7: [58, 36], 8: [60, 27], 9: [62, 33],
        10: [64, 40], 12: [62, 47], 13: [60, 54], 11: [58, 63], 14: [59, 5], 15: [70, 35]
      }
    },
    defense22: {
      name: 'Defensa en 22 propia',
      ballCarrier: 'b9',
      a: {
        1: [19, 20], 2: [19, 24], 3: [19, 28], 4: [19, 32], 5: [19, 36],
        6: [19, 40], 8: [19, 44], 7: [19, 48], 9: [17, 35],
        10: [19, 52], 12: [19, 56], 13: [19, 60], 11: [19, 65],
        15: [10, 42], 14: [12, 14]
      },
      b: {
        9: [23.5, 30], 1: [23, 25], 2: [23, 21], 8: [24, 17], 3: [25, 34],
        10: [26, 40], 4: [27, 45], 6: [28, 47], 5: [29, 49],
        12: [30, 52], 13: [33, 58], 11: [36, 66], 7: [26, 12], 14: [33, 10], 15: [31, 40]
      }
    },
    manual: {
      name: 'Equipos alineados (armar a mano)',
      ballCarrier: null,
      a: lineUp(30),
      b: lineUp(70)
    },

    /* Parciales: el plantel lo define la formación, no el formato de juego.
       Sirven para practicar una unidad sola, con o sin rival. */
    unit_lineout: {
      name: 'Line-out solo (7 + lanzador + 9)',
      only: true,
      ballCarrier: 'a2',
      a: {
        2: [50, 0.6], 1: [49.4, 5.5], 3: [49.4, 8], 4: [49.4, 10.5], 5: [49.4, 13],
        6: [49.4, 15.5], 7: [49.4, 18], 8: [49.4, 20.5], 9: [47.6, 9]
      },
      b: {
        2: [51.8, 3], 1: [51.2, 5.5], 3: [51.2, 8], 4: [51.2, 10.5], 5: [51.2, 13],
        6: [51.2, 15.5], 7: [51.2, 18], 8: [51.2, 20.5], 9: [53, 9]
      }
    },
    unit_scrum: {
      name: 'Scrum solo (pack + 9)',
      only: true,
      ballCarrier: 'a9',
      a: {
        1: [48.5, 37.2], 2: [48.5, 35], 3: [48.5, 32.8],
        4: [47.2, 36.1], 5: [47.2, 33.9], 6: [47.2, 38.7], 7: [47.2, 31.3], 8: [45.9, 35],
        9: [44.8, 32.6]
      },
      b: {
        1: [51.5, 32.8], 2: [51.5, 35], 3: [51.5, 37.2],
        4: [52.8, 33.9], 5: [52.8, 36.1], 6: [52.8, 31.3], 7: [52.8, 38.7], 8: [54.1, 35],
        9: [55.2, 37.4]
      }
    },
    unit_backline: {
      name: 'Línea de tres cuartos sola',
      only: true,
      ballCarrier: 'a9',
      a: {
        9: [44, 35], 10: [40, 41], 12: [37, 47], 13: [34, 53], 11: [30, 64],
        14: [37, 12], 15: [28, 40]
      },
      b: {
        9: [48, 35], 10: [49, 42], 12: [49, 48], 13: [49, 54], 11: [49, 64],
        14: [48, 14], 15: [42, 46]
      }
    },
    empty: {
      name: 'Cancha vacía (agregar jugadores)',
      only: true,
      ballCarrier: null,
      a: {},
      b: {}
    }
  };

  function formationList() {
    return Object.keys(FORMATIONS).map((k) => ({ key: k, name: FORMATIONS[k].name }));
  }

  /* ---------- estado ---------- */

  const state = {
    id: uid(),
    name: 'Jugada sin nombre',
    squad: 15,
    lastFormation: 'attack',
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
    applyFormation(formationKey || 'attack', 0);
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

  const CARRY_OFFSET = 1.35;

  function carryPos(p, team) {
    const dir = team === 'a' ? 1 : -1;
    return { x: p.x + dir * CARRY_OFFSET * 0.55, y: p.y + CARRY_OFFSET };
  }

  function ballStatic(frameIdx) {
    const fr = frame(frameIdx);
    if (fr.ball.carrier && fr.pos[fr.ball.carrier]) {
      const pl = player(fr.ball.carrier);
      return carryPos(fr.pos[fr.ball.carrier], pl ? pl.team : 'a');
    }
    return { x: fr.ball.x, y: fr.ball.y };
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

    if (cur.ballRoute && cur.ballRoute.pts.length > 1) return G.pointOnPath(cur.ballRoute.pts, e);

    if (cur.ball.carrier && cur.ball.carrier === prev.ball.carrier) {
      const pl = player(cur.ball.carrier);
      return carryPos(playerAt(frameIdx, cur.ball.carrier, t), pl ? pl.team : 'a');
    }

    const from = prev.ball.carrier
      ? carryPos(playerAt(frameIdx, prev.ball.carrier, t), (player(prev.ball.carrier) || {}).team || 'a')
      : { x: prev.ball.x, y: prev.ball.y };
    const to = cur.ball.carrier
      ? carryPos(playerAt(frameIdx, cur.ball.carrier, t), (player(cur.ball.carrier) || {}).team || 'a')
      : { x: cur.ball.x, y: cur.ball.y };

    const p = G.lerpPoint(from, to, e);
    /* pequeno arco para que el pase no sea una recta plana */
    const d = G.dist(from, to);
    const lift = Math.sin(Math.PI * e) * Math.min(1.6, d * 0.08);
    return { x: p.x, y: p.y - lift };
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

  function snapshot() { return JSON.stringify({ name: state.name, squad: state.squad, showB: state.showB, lastFormation: state.lastFormation, colors: state.colors, players: state.players, frames: state.frames }); }

  function restore(json) {
    const s = JSON.parse(json);
    state.name = s.name; state.squad = s.squad; state.showB = s.showB; state.lastFormation = s.lastFormation;
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

  const STORE_KEY = 'rugbyboard.plays.v1';

  function serialize() {
    return {
      v: 1, id: state.id, name: state.name, squad: state.squad, showB: state.showB,
      colors: state.colors, players: state.players, frames: state.frames, saved: Date.now()
    };
  }

  function load(data) {
    if (!data || !Array.isArray(data.frames) || !data.frames.length) throw new Error('Archivo de jugada invalido');
    state.id = data.id || uid();
    state.name = data.name || 'Jugada importada';
    state.squad = data.squad || 15;
    state.showB = data.showB !== false;
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

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; }
  }

  function writeStore(obj) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); return true; } catch (e) { return false; }
  }

  function savePlay() {
    const store = readStore();
    store[state.id] = serialize();
    return writeStore(store);
  }

  function listPlays() {
    const store = readStore();
    return Object.keys(store)
      .map((k) => ({ id: k, name: store[k].name || '(sin nombre)', saved: store[k].saved || 0 }))
      .sort((x, y) => y.saved - x.saved);
  }

  function loadPlay(id) {
    const store = readStore();
    if (!store[id]) return false;
    load(store[id]);
    return true;
  }

  function deletePlay(id) {
    const store = readStore();
    delete store[id];
    return writeStore(store);
  }

  return {
    state, POSITION_NAMES, SQUADS, FORMATIONS, formationList,
    blankFrame, frame, frameCount, player, activePlayers, pos,
    newPlay, rebuildSquad, applyFormation, addPlayer, removePlayer, nextNumber,
    addFrame, duplicateFrame, deleteFrame,
    setPos, setRoute, clearRoute,
    ballStatic, setCarrier, carryPos,
    playerAt, ballAt, sampleAt, totalDuration, resolveTime, timeOfFrame,
    addAnnotation, removeAnnotation,
    commit, undo, redo, resetHistory, history,
    serialize, load, savePlay, listPlays, loadPlay, deletePlay
  };
})();
