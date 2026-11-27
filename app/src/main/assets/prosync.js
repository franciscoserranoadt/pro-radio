/* =====================================================================
   Código Pro — sincronización común de las apps Pro entre el móvil y la pantalla del coche.
   Este archivo es IGUAL en Pro Maps, Pro Radio, Pro Inicio, Pro Garaje y Pro OBD.

   - Un solo código de 8 letras para todas las apps: se pone una vez en cualquier app Pro
     de cada aparato y las demás lo reciben solas (ProSync.java).
   - Cada app tiene uno o varios «canales» (maps, park, radio, inicio, garaje, obd).
   - Los datos van comprimidos y cifrados con el código por ntfy.sh (gratis, sin cuenta).
     ntfy los guarda 12 h; cada aparato vuelve a enviar lo suyo cuando hace falta.
   - Dos formas de juntar:
       · «gana el último» (ajustes): manda el que se cambió más tarde.
       · «juntar» (listas como los repostajes): la app da una función merge(local, remoto).
   ===================================================================== */
(function () {
  'use strict';
  var N = window.ProSync || null;
  var NTFY = 'https://ntfy.sh/';
  var CHUNK = 2400;            // ntfy admite mensajes de hasta 4 KB
  var REPUB = 6 * 3600e3;      // volver a publicar cada 6 h (ntfy borra a las 12 h)
  var subs = {}, watchers = {}, order = [], listeners = [];
  var code = '', pushT = {}, busy = {}, rn = 0, pend = {};
  var st = { lastOk: 0, err: '', sending: false };

  function ls(k, d) { try { var v = localStorage.getItem('ps_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lss(k, v) { try { localStorage.setItem('ps_' + k, JSON.stringify(v)); } catch (e) { } }
  function now() { return Date.now(); }
  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) { } }); }
  function readCode() { try { return N ? String(N.code() || '') : ''; } catch (e) { return ''; } }
  function fmt(c) { return c ? c.slice(0, 4) + '-' + c.slice(4) : ''; }

  /* ---------- peticiones web ---------- */
  window.__psr = function (id, ok, status, text) {
    var p = pend[id]; if (!p) return; delete pend[id];
    p({ ok: !!ok, code: status, text: text || '' });
  };
  function req(method, url, body) {
    return new Promise(function (res, rej) {
      if (!N || !N.req) {
        fetch(url, { method: method, body: body == null ? undefined : body })
          .then(function (r) { return r.text().then(function (t) { res({ ok: r.ok, code: r.status, text: t }); }); })
          .catch(rej);
        return;
      }
      var id = 'ps' + (++rn);
      pend[id] = res;
      N.req(id, method, url, body == null ? null : body);
      setTimeout(function () { if (pend[id]) { delete pend[id]; rej(new Error('tiempo agotado')); } }, 45000);
    });
  }
  function url(app) { return NTFY + N.topic(app); }

  /* ---------- sello de hora de los datos de cada canal ---------- */
  function stamp(app) { return ls('t_' + app, 0); }
  function setStamp(app, t) { lss('t_' + app, t); }

  /* ---------- enviar ---------- */
  function push(app) {
    var o = subs[app];
    if (!code || !o || !N) return Promise.resolve(false);
    if (o.enabled && !o.enabled()) return Promise.resolve(false);
    var t = stamp(app);
    if (!t) { t = 1; setStamp(app, t); }
    var data;
    try { data = o.get(); } catch (e) { return Promise.resolve(false); }
    var txt = N.enc(JSON.stringify({ t: t, d: data }));
    if (!txt) return Promise.resolve(false);
    var n = Math.ceil(txt.length / CHUNK), chain = Promise.resolve(true);
    var sig = t + ':' + txt.length;
    st.sending = true; emit();
    for (var i = 0; i < n; i++) (function (i) {
      chain = chain.then(function (ok) {
        if (!ok) return false;
        var m = JSON.stringify({ ps: 1, t: t, s: sig, i: i, n: n, d: txt.slice(i * CHUNK, (i + 1) * CHUNK) });
        return req('POST', url(app), m).then(function (r) {
          if (!r.ok) st.err = r.code === 429 ? 'Demasiados envíos hoy: se reintentará más tarde' : 'No se pudo enviar (error ' + r.code + ')';
          return r.ok;
        });
      });
    })(i);
    return chain.then(function (ok) {
      st.sending = false;
      if (ok) { lss('pub_' + app, now()); lss('pubT_' + app, t); st.lastOk = now(); st.err = ''; }
      emit(); return ok;
    }).catch(function () { st.sending = false; st.err = 'Sin conexión: se enviará más tarde'; emit(); return false; });
  }

  /* ---------- leer lo último del canal: {t, d} o null ---------- */
  function read(app) {
    return req('GET', url(app) + '/json?poll=1&since=12h').then(function (r) {
      if (!r.ok) throw new Error('error ' + r.code);
      var parts = {};
      (r.text || '').split('\n').forEach(function (line) {
        if (!line) return;
        try {
          var m = JSON.parse(line); if (m.event !== 'message') return;
          var o = JSON.parse(m.message); if (o.ps !== 1) return;
          var k = o.s || String(o.t);
          var p = parts[k] = parts[k] || { t: o.t, n: o.n, got: {}, at: 0 };
          p.got[o.i] = o.d; p.at = Math.max(p.at, m.time || 0);
        } catch (e) { }
      });
      // la versión completa más nueva (por sello de datos y, si empatan, por hora de envío)
      var keys = Object.keys(parts).sort(function (a, b) { return (parts[b].t - parts[a].t) || (parts[b].at - parts[a].at); });
      for (var j = 0; j < keys.length; j++) {
        var p = parts[keys[j]], txt = '', full = true;
        for (var i = 0; i < p.n; i++) { if (p.got[i] == null) { full = false; break; } txt += p.got[i]; }
        if (!full) continue;
        var plain = N.dec(txt);
        if (!plain) continue;
        try { var d = JSON.parse(plain); return { t: d.t || p.t, d: d.d }; } catch (e) { }
      }
      return null;
    });
  }

  /* comparar sin que importe el orden de las claves */
  function canon(x) {
    if (x === null || typeof x !== 'object') return JSON.stringify(x);
    if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
    return '{' + Object.keys(x).sort().filter(function (k) { return x[k] !== undefined; })
      .map(function (k) { return JSON.stringify(k) + ':' + canon(x[k]); }).join(',') + '}';
  }
  function same(a, b) { try { return canon(a) === canon(b); } catch (e) { return false; } }

  /* ---------- recibir un canal ---------- */
  function pull(app) {
    var o = subs[app];
    if (!code || !o || busy[app]) return Promise.resolve();
    if (o.enabled && !o.enabled()) return Promise.resolve();
    busy[app] = true;
    return read(app).then(function (r) {
      busy[app] = false;
      st.lastOk = now(); st.err = '';
      var lt = stamp(app), stale = now() - ls('pub_' + app, 0) > REPUB;
      if (o.merge) {
        var local = o.get();
        if (!r) { if (lt > 1 || o.hasData && o.hasData(local)) return push(app); return; }
        var m = o.merge(local, r.d);
        if (!same(m, local)) { setStamp(app, Math.max(now(), r.t)); o.apply(m, true); }
        if (!same(m, r.d) || stale) return push(app);
        return;
      }
      if (r && lt === 1 && o.join && r.t > 1) {          // recién vinculado: juntar lo de los dos
        var j = o.join(o.get(), r.d);
        o.apply(j, true);
        if (!same(j, r.d)) { setStamp(app, now()); return push(app); }
        setStamp(app, r.t); return;
      }
      if (r && r.t > lt) { setStamp(app, r.t); o.apply(r.d, true); return; }
      if (lt > 1 && (!r || r.t < lt || stale)) return push(app);
    }).catch(function (e) { busy[app] = false; st.err = 'Sin conexión (' + e.message + ')'; emit(); })
      .then(function () { emit(); });
  }

  /* ---------- canales que solo se leen (p. ej. Pro Garaje lee los km de Pro OBD) ---------- */
  function pullWatch(app) {
    var w = watchers[app];
    if (!code || !w || !N) return Promise.resolve();
    return read(app).then(function (r) {
      if (r && r.t > ls('w_' + app, 0)) { lss('w_' + app, r.t); try { w(r.d, r.t); } catch (e) { } }
    }).catch(function () { });
  }

  function pullAll() {
    var chain = Promise.resolve();
    order.forEach(function (a) { chain = chain.then(function () { return pull(a); }); });
    Object.keys(watchers).forEach(function (a) { chain = chain.then(function () { return pullWatch(a); }); });
    return chain;
  }

  /* ---------- ¿ha cambiado el código (desde otra app Pro)? ---------- */
  function checkCode() {
    var c = readCode();
    if (c === code) return false;
    code = c;
    // Recién unido con el código de otro aparato: lo de allí manda en los ajustes
    if (c && N && N.joined && N.joined() === 1) order.forEach(function (a) { if (!subs[a].merge) setStamp(a, 1); });
    Object.keys(watchers).forEach(function (a) { lss('w_' + a, 0); });
    order.forEach(function (a) { lss('pub_' + a, 0); });
    emit();
    if (c) pullAll();
    return true;
  }

  var PS = {
    /** Registra un canal: {get(), apply(datos, remoto), merge?(local, remoto), join?(local, remoto), enabled?(), hasData?(d)} */
    register: function (app, o) { subs[app] = o; if (order.indexOf(app) < 0) order.push(app); },
    /** Lee un canal de otra app (solo lectura): cb(datos, hora) */
    watch: function (app, cb) { watchers[app] = cb; },
    /** Avisar de que han cambiado los datos de un canal */
    changed: function (app, delay) {
      setStamp(app, Math.max(now(), stamp(app) + 1));
      if (!code) return;
      clearTimeout(pushT[app]);
      pushT[app] = setTimeout(function () { push(app); }, delay == null ? 5000 : delay);
    },
    pushNow: function (app) { clearTimeout(pushT[app]); return push(app); },
    pull: pull, pullAll: pullAll,
    code: function () { return code; },
    linked: function () { return !!code; },
    fmt: fmt, canon: canon,
    status: function () { return st; },
    onChange: function (f) { listeners.push(f); },
    available: function () { return !!N; },
    /** Código de versiones anteriores (Pro Maps = 2, Pro Radio = 1) */
    legacy: function (c, prio) { if (N && N.legacy && c) { N.legacy(c, prio); checkCode(); } },
    create: function () {
      var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', c = '';
      for (var k = 0; k < 8; k++) c += abc.charAt(Math.floor(Math.random() * abc.length));
      if (!N) return '';
      N.set(c, 0); checkCode();
      order.forEach(function (a) { if (stamp(a) > 1) PS.changed(a, 300); });
      return c;
    },
    join: function (raw) {
      var c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (c.length !== 8 || !N) return false;
      N.set(c, 1); checkCode();
      return true;
    },
    unlink: function () { if (N) { N.set('', 0); checkCode(); } },
    resume: function () { if (!checkCode() && code) pullAll(); },
    /** Caja lista para poner en los ajustes de cada app */
    box: function (opt) { return makeBox(opt || {}); }
  };
  window.PS = PS;

  /* ---------- caja de ajustes «Código Pro» (igual en todas las apps) ---------- */
  function css() {
    if (document.getElementById('psxCss')) return;
    var s = document.createElement('style'); s.id = 'psxCss';
    s.textContent =
      '.psx{background:rgba(127,127,127,.12);border:1px solid rgba(127,127,127,.25);border-radius:14px;padding:14px;margin:8px 0;color:inherit;font:inherit;text-align:left}' +
      '.psx h4{margin:0 0 6px;font-size:1.05em}.psx p{margin:4px 0;opacity:.8;font-size:.9em;line-height:1.35}' +
      '.psx .psc{font-size:1.6em;font-weight:700;letter-spacing:.12em;margin:6px 0;font-family:monospace}' +
      '.psx .psr{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.psx *{box-sizing:border-box}.psx .psr>*{min-width:0;width:auto;max-width:100%;margin:0}' +
      '.psx button{flex:1 1 140px;min-height:46px;border-radius:12px;border:0;padding:10px 12px;font:inherit;font-weight:600;background:rgba(127,127,127,.25);color:inherit}' +
      '.psx button.pri{background:#1e9bf0;color:#fff}.psx button.dng{background:#c62828;color:#fff}' +
      '.psx input{flex:1 1 160px;min-height:46px;border-radius:12px;border:1px solid rgba(127,127,127,.4);background:rgba(0,0,0,.15);color:inherit;padding:0 12px;font:inherit;font-size:1.15em;letter-spacing:.1em;text-transform:uppercase}' +
      '.psx .ok{color:#2ecc71}.psx .bad{color:#ff7043}';
    document.head.appendChild(s);
  }
  function ago(t) {
    var s = Math.round((now() - t) / 1000);
    if (s < 60) return 'hace un momento';
    if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
    return 'hace ' + Math.round(s / 3600) + ' h';
  }
  function makeBox(opt) {
    css();
    var el = document.createElement('div'); el.className = 'psx';
    var toast = opt.toast || function () { };
    var confirmOff = false;
    function render() {
      if (!N) { el.innerHTML = '<h4>📲 Código Pro</h4><p>Solo funciona dentro de la app.</p>'; return; }
      var what = opt.what ? '<p>En esta app: ' + opt.what + '</p>' : '';
      if (!code) {
        el.innerHTML = '<h4>📲 Código Pro · móvil y coche</h4>' +
          '<p>Un solo código para todas tus apps Pro (Maps, Radio, Inicio, Garaje y OBD). Ponlo una vez en cada aparato y se vinculan todas.</p>' + what +
          '<div class="psr"><button class="pri" data-x="new">➕ Crear código</button></div>' +
          '<p style="margin-top:10px">¿Ya tienes un código en el otro aparato? Escríbelo aquí:</p>' +
          '<div class="psr"><input data-x="in" maxlength="9" placeholder="K7PQ-M2XD" autocomplete="off" autocapitalize="characters"><button data-x="join">Vincular</button></div>';
      } else {
        var s = st.sending ? 'Enviando…' : st.err ? '<span class="bad">' + st.err + '</span>' : st.lastOk ? '<span class="ok">✔ Sincronizado ' + ago(st.lastOk) + '</span>' : 'Sincronizando…';
        el.innerHTML = '<h4>📲 Código Pro · vinculado</h4><div class="psc">' + fmt(code) + '</div>' +
          '<p>' + s + '</p>' + what +
          '<p>En el otro aparato abre cualquier app Pro, entra en sus ajustes y escribe este código en «Código Pro». Las demás apps Pro de cada aparato se vinculan solas.</p>' +
          '<div class="psr"><button data-x="now">🔄 Sincronizar ahora</button><button class="dng" data-x="off">' + (confirmOff ? '¿Seguro? Toca otra vez' : 'Desvincular este aparato') + '</button></div>';
      }
      el.innerHTML += '<p style="margin-top:10px;font-size:.8em">Los datos viajan cifrados con tu código por ntfy.sh (gratis): nadie más puede leerlos. ntfy los guarda 12 horas; cada aparato los vuelve a enviar al abrir la app.</p>';
    }
    el.addEventListener('click', function (e) {
      var x = e.target && e.target.getAttribute && e.target.getAttribute('data-x');
      if (x === 'new') { var c = PS.create(); toast('Código creado: ' + fmt(c)); }
      else if (x === 'join') {
        var inp = el.querySelector('[data-x="in"]');
        if (!PS.join(inp ? inp.value : '')) { toast('El código tiene 8 letras o números'); return; }
        toast('✅ Vinculado. Recibiendo los datos del otro aparato…');
      }
      else if (x === 'now') { toast('Sincronizando…'); order.forEach(function (a) { lss('pub_' + a, 0); }); pullAll(); }
      else if (x === 'off') {
        if (!confirmOff) { confirmOff = true; render(); setTimeout(function () { confirmOff = false; render(); }, 4000); return; }
        confirmOff = false; PS.unlink(); toast('Desvinculado. Tus datos se quedan en este aparato.');
      }
      else return;
      render(); if (opt.onChange) opt.onChange();
    });
    listeners.push(function () { if (document.body.contains(el)) render(); });
    render();
    return el;
  }

  /* ---------- arranque ---------- */
  code = readCode();
  setTimeout(function () {
    try { if (N && N.ask) N.ask(); } catch (e) { }
    setTimeout(function () { if (!checkCode() && code) pullAll(); }, 1500);
  }, 1200);
  setInterval(function () { checkCode(); }, 15000);
  setInterval(function () { if (code && !document.hidden) pullAll(); }, 120000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) PS.resume(); });
})();
