/* demos.js - jugadas de ejemplo armadas con la API del modelo */
window.RG = window.RG || {};

RG.demos = (function () {
  const M = RG.model;

  /* Un paso describe el frame siguiente: a donde va cada jugador (un punto = recta,
     varios puntos = recorrido dibujado) y quien queda con la pelota. */
  function build(spec) {
    M.state.name = spec.name;
    M.state.squad = 15;
    M.state.showB = true;
    M.state.players = M.state.players.length ? M.state.players : [];
    M.rebuildSquad(15, null);
    M.state.frames = [M.blankFrame()];
    M.applyFormation(spec.formation, 0);
    M.frame(0).note = spec.note || '';

    spec.steps.forEach((step) => {
      const k = M.addFrame(M.frameCount() - 1);
      const fr = M.frame(k);
      fr.dur = step.dur || 1.1;
      fr.note = step.note || '';
      for (const id of Object.keys(step.moves || {})) {
        const pts = step.moves[id].map((q) => ({ x: q[0], y: q[1] }));
        if (pts.length === 1) M.setPos(k, id, pts[0], false);
        else M.setRoute(k, id, RG.geom.smooth(pts, 6), 'run');
      }
      if (step.carrier !== undefined) M.setCarrier(k, step.carrier);
      for (const a of step.ann || []) M.addAnnotation(k, a);
    });

    M.state.id = RG.geom.uid();
    M.resetHistory();
  }

  const PLAYS = {
    lineout_backs: {
      name: 'Line-out: salto de 5 y juego de backs',
      formation: 'lineout_field',
      note: 'Line-out de 7 en la touch izquierda',
      steps: [
        {
          dur: 1.0, carrier: 'a9', note: 'Salto del 5, pelota limpia al 9',
          moves: {
            a9: [[37.4, 11]], a5: [[38.8, 10.6]], a4: [[39, 8.7]], a6: [[39, 12]],
            a10: [[36, 19]], a12: [[33.5, 26]], a13: [[31, 33]], a15: [[26, 22]], a11: [[27.5, 45]],
            b9: [[43.5, 13]], b10: [[44, 18]], b12: [[46, 26]], b13: [[48, 34]]
          }
        },
        {
          dur: 1.0, carrier: 'a10', note: 'Pase al 10, que ataca la línea',
          moves: {
            a10: [[36, 19], [38, 22], [40, 25]],
            a12: [[36.5, 30]], a13: [[33.5, 37]], a11: [[30, 48]], a15: [[31, 33]],
            a9: [[38, 17]],
            b10: [[43.5, 24]], b12: [[45, 32]], b13: [[47, 40]], b11: [[48, 52]]
          }
        },
        {
          dur: 1.1, carrier: 'a12', note: 'El 12 recibe y busca el corte',
          moves: {
            a12: [[36.5, 30], [39.5, 33], [42.5, 35]],
            a13: [[37, 42]], a15: [[35, 37]], a11: [[33, 51]], a10: [[39, 27]],
            b10: [[42, 29]], b12: [[44, 36]], b13: [[46, 44]], b11: [[47, 56]], b15: [[44, 40]]
          }
        },
        {
          dur: 1.2, carrier: 'a15', note: 'Entra el 15 por adentro y rompe',
          moves: {
            a15: [[35, 37], [39, 40], [44, 42], [49, 43]],
            a12: [[44, 34]], a13: [[41, 45]], a11: [[38, 54]],
            b12: [[45, 37]], b13: [[46.5, 45]], b15: [[47, 43]], b11: [[48, 57]]
          }
        }
      ]
    },

    scrum_blindside: {
      name: 'Scrum: ciego del 8 con el 9 y el wing',
      formation: 'scrum_mid',
      note: 'Scrum propio en mitad de cancha',
      steps: [
        {
          dur: 1.0, carrier: 'a8', note: 'El 8 levanta la pelota y sale al lado ciego',
          moves: {
            a8: [[45.9, 35], [45.6, 31.5], [46, 28]],
            a9: [[46.5, 30.5]], a10: [[42, 41]], a14: [[40, 13]], a15: [[31, 34]],
            b9: [[54.5, 34]], b7: [[52.5, 33]]
          }
        },
        {
          dur: 1.0, carrier: 'a9', note: 'Pase corto al 9, que fija al ala',
          moves: {
            a9: [[46.5, 30.5], [48.5, 26.5], [50.5, 23]],
            a8: [[47, 26]], a14: [[43, 12]], a11: [[33, 60]], a15: [[35, 26]],
            b7: [[52, 27]], b9: [[53, 30]], b14: [[57, 20]], b15: [[64, 30]]
          }
        },
        {
          dur: 1.2, carrier: 'a14', note: 'Habilita al 14 con espacio afuera',
          moves: {
            a14: [[43, 12], [49, 10], [56, 9]],
            a9: [[52, 20]], a15: [[42, 22]], a8: [[50, 24]],
            b14: [[59, 14]], b7: [[55, 22]], b15: [[62, 20]]
          }
        },
        {
          dur: 1.2, carrier: 'a15', note: 'El 15 entra por dentro para el apoyo',
          moves: {
            a14: [[62, 9]], a15: [[42, 22], [50, 18], [58, 15]],
            a9: [[56, 19]],
            b15: [[64, 13]], b14: [[63, 10]], b13: [[60, 22]]
          }
        }
      ]
    },

    counter_kick: {
      name: 'Contra desde patada: recepción del 15',
      formation: 'defense22',
      note: 'El rival patea al fondo, el 15 contraataca',
      steps: [
        {
          dur: 1.1, carrier: 'a15', note: 'El 15 toma en el aire',
          moves: {
            a15: [[10, 42], [11, 38], [13, 35]],
            a11: [[16, 58]], a14: [[15, 16]], a10: [[17, 46]], a9: [[15, 33]],
            b10: [[24, 38]], b12: [[27, 46]], b13: [[30, 54]]
          }
        },
        {
          dur: 1.1, carrier: 'a15', note: 'Arranca hacia el hueco entre el 12 y el 13',
          moves: {
            a15: [[13, 35], [17, 34], [22, 36]],
            a11: [[21, 56]], a10: [[21, 44]], a14: [[20, 18]], a9: [[19, 32]],
            b12: [[26, 44]], b13: [[29, 52]], b10: [[24, 36]], b11: [[31, 62]]
          }
        },
        {
          dur: 1.2, carrier: 'a11', note: 'Descarga al 11 que dobla por afuera',
          moves: {
            a11: [[21, 56], [28, 58], [36, 60]],
            a15: [[28, 40]], a10: [[27, 46]], a9: [[25, 34]],
            b13: [[33, 56]], b11: [[36, 64]], b15: [[40, 52]]
          }
        }
      ]
    }
  };

  function list() {
    return Object.keys(PLAYS).map((k) => ({ key: k, name: PLAYS[k].name }));
  }

  function load(key) {
    if (!PLAYS[key]) return false;
    build(PLAYS[key]);
    return true;
  }

  return { PLAYS, list, load, build };
})();
