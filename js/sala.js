/* sala.js - la sala en vivo: el entrenador y los teléfonos hablando por un código.

   Hay dos transportes con la misma interfaz. Con servidor conectado va por el
   canal en tiempo real de Supabase, que es un WebSocket con el protocolo de
   Phoenix; se habla a mano, sin librería, igual que el resto de la app. Sin
   servidor queda el canal del propio navegador, que sólo une pestañas de la
   misma máquina: sirve para probar, no para el plantel. */
window.RG = window.RG || {};

RG.sala = (function () {
  const CFG = () => (window.RG_CONFIG || {});
  const configurado = () => !!(CFG().supabaseUrl && CFG().supabaseAnonKey);

  const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   /* sin O/0 ni I/1 */
  function nuevoCodigo() {
    let s = '';
    for (let i = 0; i < 4; i++) s += LETRAS[Math.floor(Math.random() * LETRAS.length)];
    return s;
  }

  const uid = () => Math.random().toString(36).slice(2, 10);

  /* ------------------------------------------------------- por Supabase ---- */

  function porSupabase(codigo, cb) {
    const base = String(CFG().supabaseUrl || '').replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
    const url = base.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' +
      encodeURIComponent(CFG().supabaseAnonKey) + '&vsn=1.0.0';
    const topic = 'realtime:rugby-' + codigo;

    let ws = null, ref = 0, latido = 0, reintento = 0, cerrado = false, listo = false;

    function abrir() {
      ws = new WebSocket(url);

      ws.onopen = function () {
        ref = 0;
        ws.send(JSON.stringify({
          topic: topic, event: 'phx_join', ref: String(++ref), join_ref: '1',
          payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: false } }
        }));
        clearInterval(latido);
        latido = setInterval(function () {
          if (ws && ws.readyState === 1) {
            ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }));
          }
        }, 25000);
      };

      ws.onmessage = function (ev) {
        let m;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.event === 'phx_reply' && m.topic === topic) {
          const ok = m.payload && m.payload.status === 'ok';
          listo = ok;
          reintento = 0;
          cb.onEstado(ok ? 'conectado' : 'rechazado');
          return;
        }
        if (m.event === 'broadcast' && m.payload) cb.onMensaje(m.payload.event, m.payload.payload || {});
        if (m.event === 'phx_error') cb.onEstado('rechazado');
      };

      ws.onclose = function () {
        clearInterval(latido);
        listo = false;
        if (cerrado) return;
        cb.onEstado('reconectando');
        /* la señal del teléfono se corta a cada rato: se vuelve a entrar sola */
        reintento = Math.min(reintento + 1, 6);
        setTimeout(abrir, 400 * reintento);
      };

      ws.onerror = function () { /* onclose se encarga */ };
    }

    abrir();

    return {
      tipo: 'supabase',
      enVivo: true,
      enviar: function (evento, datos) {
        if (!ws || ws.readyState !== 1 || !listo) return false;
        ws.send(JSON.stringify({
          topic: topic, event: 'broadcast', ref: String(++ref),
          payload: { type: 'broadcast', event: evento, payload: datos || {} }
        }));
        return true;
      },
      salir: function () {
        cerrado = true;
        clearInterval(latido);
        try { if (ws) ws.close(); } catch (e) { /* ya estaba cerrado */ }
      }
    };
  }

  /* --------------------------------------------------- por el navegador ---- */

  /* Une pestañas del mismo navegador. No sirve para teléfonos, pero deja probar
     la sala completa sin servidor. */
  function porNavegador(codigo, cb) {
    if (typeof BroadcastChannel === 'undefined') {
      setTimeout(function () { cb.onEstado('sin-transporte'); }, 0);
      return { tipo: 'ninguno', enVivo: false, enviar: function () { return false; }, salir: function () {} };
    }
    const bc = new BroadcastChannel('rugby-sala-' + codigo);
    bc.onmessage = function (ev) {
      const m = ev.data || {};
      cb.onMensaje(m.evento, m.datos || {});
    };
    setTimeout(function () { cb.onEstado('conectado'); }, 0);
    return {
      tipo: 'navegador',
      enVivo: false,
      enviar: function (evento, datos) { bc.postMessage({ evento: evento, datos: datos || {} }); return true; },
      salir: function () { try { bc.close(); } catch (e) { /* ya cerrado */ } }
    };
  }

  /* ------------------------------------------------------------ público ---- */

  let actual = null;

  function entrar(codigo, cb) {
    salir();
    const manejo = { onMensaje: cb.onMensaje || function () {}, onEstado: cb.onEstado || function () {} };
    actual = configurado() ? porSupabase(codigo, manejo) : porNavegador(codigo, manejo);
    actual.codigo = codigo;
    return actual;
  }

  function salir() {
    if (actual) { actual.salir(); actual = null; }
  }

  function enviar(evento, datos) { return actual ? actual.enviar(evento, datos) : false; }
  function tipo() { return actual ? actual.tipo : null; }
  function enVivo() { return !!(actual && actual.enVivo); }

  return { entrar, salir, enviar, tipo, enVivo, nuevoCodigo, uid, configurado };
})();
