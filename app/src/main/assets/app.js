/* Pro Radio · pantalla principal */
(function () {
'use strict';

var A = window.Android || null;
var $ = function (id) { return document.getElementById(id); };

/* ---------- Almacenamiento ---------- */
var LS = {
  get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
function pref(k, d) {
  if (A && A.getPref) { try { return A.getPref(k, d); } catch (e) {} }
  return LS.get('pref_' + k, d);
}
function setPref(k, v) {
  if (A && A.setPref) { try { A.setPref(k, v); } catch (e) {} }
  LS.set('pref_' + k, v);
}

var S = {
  mem: LS.get('mem', []),
  favs: LS.get('favs', []),
  recent: LS.get('recent', []),
  cc: LS.get('cc', 'ES'),
  chip: 'top',
  query: '',
  list: [],
  listReq: 0,
  now: null,
  queue: [],
  playing: false, want: false, state: 1, err: false, song: '',
  tab: 'home', bank: 0, moving: -1, cont: 'EU',
  countries: null,
  loc: LS.get('loc', null), place: LS.get('place', ''),
  set: { autostart: '1', reconnect: '1', weather: '1' }
};
while (S.mem.length < 30) S.mem.push(null);
S.mem = S.mem.slice(0, 30);
Object.keys(S.set).forEach(function (k) { S.set[k] = pref(k, S.set[k]); });

/* ---------- Iconos ---------- */
var P = {
  radio: '<circle cx="12" cy="12" r="2"/><path d="M8 8a5.6 5.6 0 0 0 0 8M16 8a5.6 5.6 0 0 1 0 8M5.2 5.2a9.6 9.6 0 0 0 0 13.6M18.8 5.2a9.6 9.6 0 0 1 0 13.6"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  nav: '<path d="M12 2l7 19-7-4-7 4z" fill="#fff" stroke="none"/>',
  fire: '<path d="M12 3c1 3.5 5 5 5 10a5 5 0 0 1-10 0c0-2.4 1.4-3.6 2.4-4.8.3 1.6 1.2 2.4 1.2 2.4C11 8 12 5.5 12 3z"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  prev: '<path d="M6 5v14"/><path d="M19 5L9 12l10 7z" fill="#fff"/>',
  next: '<path d="M18 5v14"/><path d="M5 5l10 7-10 7z" fill="#fff"/>',
  pause: '<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="#0c0f2e" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="#0c0f2e" stroke="none"/>',
  play: '<path d="M8 5l11 7-11 7z" fill="#0c0f2e" stroke="#0c0f2e"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  heartf: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="#ff4f8b" stroke="#ff4f8b"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 11.5V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7s-5-2-6.5-5L3 12a1.4 1.4 0 0 1 2.3-1.5L8 13"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wheel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M3.5 10.5h6M14.5 10.5h6M12 14.5V21"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  pin: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
  sun: '<circle cx="12" cy="12" r="4.2" stroke="#ffc65c"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" stroke="#ffc65c"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" stroke="#cfd4ff"/>',
  cloudsun: '<circle cx="9" cy="9" r="3.4" stroke="#ffc65c"/><path d="M9 2.5v1.5M3.5 9H2M4.4 4.4l1 1M13.6 4.4l-1 1" stroke="#ffc65c"/><path d="M8 20h9a3.6 3.6 0 0 0 0-7.2 5 5 0 0 0-9.4 1.4A2.9 2.9 0 0 0 8 20z" fill="#cfd4ff" stroke="none"/>',
  cloud: '<path d="M7 19h10a4 4 0 0 0 0-8 6 6 0 0 0-11.4 1.6A3.4 3.4 0 0 0 7 19z" fill="#cfd4ff" stroke="none"/>',
  rain: '<path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.4 1.6A3.4 3.4 0 0 0 7 15z" fill="#cfd4ff" stroke="none"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" stroke="#3ee7ff"/>',
  snow: '<path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.4 1.6A3.4 3.4 0 0 0 7 15z" fill="#cfd4ff" stroke="none"/><path d="M8 19h.01M12 20h.01M16 19h.01" stroke="#fff" stroke-width="3"/>',
  storm: '<path d="M7 14h10a4 4 0 0 0 0-8 6 6 0 0 0-11.4 1.6A3.4 3.4 0 0 0 7 14z" fill="#cfd4ff" stroke="none"/><path d="M12 14l-2 4h4l-2 4" stroke="#ffc65c"/>',
  fog: '<path d="M4 9h16M3 13h18M5 17h14" stroke="#cfd4ff"/>'
};
function ic(name, size, color) {
  size = size || 22;
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="' + (color || 'currentColor') +
    '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (P[name] || '') + '</svg>';
}
function iconize(root) {
  var els = (root || document).querySelectorAll('i[data-i]');
  for (var k = 0; k < els.length; k++) {
    var e = els[k];
    e.outerHTML = ic(e.getAttribute('data-i'), e.getAttribute('data-s'), e.getAttribute('data-c'));
  }
}

/* ---------- Utilidades ---------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function flag(cc) {
  if (!cc || cc.length !== 2) return '🌐';
  cc = cc.toUpperCase();
  return String.fromCodePoint(127397 + cc.charCodeAt(0), 127397 + cc.charCodeAt(1));
}
var regionNames = null;
try { regionNames = new Intl.DisplayNames(['es'], { type: 'region' }); } catch (e) {}
function countryName(cc, fallback) {
  if (regionNames) { try { var n = regionNames.of(cc); if (n && n !== cc) return n; } catch (e) {} }
  return fallback || cc;
}
var GRADS = ['linear-gradient(135deg,#ff2d6f,#7a1fd1)', 'linear-gradient(135deg,#0a66c2,#3ee7ff)', 'linear-gradient(135deg,#f39200,#e3342f)',
  'linear-gradient(135deg,#00a19a,#1e2a78)', 'linear-gradient(135deg,#d4145a,#fbb03b)', 'linear-gradient(135deg,#6a11cb,#2575fc)',
  'linear-gradient(135deg,#11998e,#38ef7d)', 'linear-gradient(135deg,#ee0979,#ff6a00)', 'linear-gradient(135deg,#3a1c71,#d76d77)'];
function col(name) {
  var h = 0; name = name || '';
  for (var k = 0; k < name.length; k++) h = (h * 31 + name.charCodeAt(k)) | 0;
  return GRADS[Math.abs(h) % GRADS.length];
}
function ini(name) {
  name = (name || '?').replace(/[^\wÀ-ÿ0-9 ]/g, ' ').trim();
  var words = name.split(/\s+/).filter(Boolean);
  for (var k = 0; k < words.length; k++) {
    var w = words[k];
    if (w.length >= 2 && w.length <= 5 && w === w.toUpperCase() && /[A-Z0-9]/.test(w) && !/^(FM|AM)$/.test(w)) return w;
  }
  var skip = /^(radio|la|el|los|las|de|the|fm|am)$/i;
  var main = words.filter(function (w) { return !skip.test(w); });
  if (!main.length) main = words;
  if (main.length === 1) return main[0].slice(0, 4).toUpperCase();
  return (main[0].charAt(0) + main[1].charAt(0)).toUpperCase();
}
function host(u) { var m = /^https?:\/\/([^\/:?#]+)/i.exec(u || ''); return m ? m[1].toLowerCase() : ''; }
/* Logo: primero el de la emisora; si falla o es diminuto, se busca el icono de su web; si no, quedan las iniciales. */
function logoSources(st) {
  var out = [];
  if (st.fav && /^https?:\/\//.test(st.fav)) out.push(st.fav);
  var hosts = [];
  [host(st.hp), host(st.fav)].forEach(function (h) {
    if (h && hosts.indexOf(h) < 0 && !/radio-browser|google|facebook|wikimedia/.test(h)) hosts.push(h);
  });
  hosts.forEach(function (h) { out.push('https://www.google.com/s2/favicons?domain=' + h + '&sz=128'); });
  if (hosts[0]) out.push('https://icons.duckduckgo.com/ip3/' + hosts[0] + '.ico');
  return out;
}
window.PRimgErr = function (im) {
  var alts = (im.getAttribute('data-alts') || '').split('|').filter(Boolean);
  if (alts.length) { im.setAttribute('data-alts', alts.slice(1).join('|')); im.src = alts[0]; }
  else if (im.parentNode) im.parentNode.removeChild(im);
};
window.PRimgOk = function (im) {
  if (im.naturalWidth < 24 && im.naturalHeight < 24) { window.PRimgErr(im); return; }
  im.className = 'ok';
};
function logo(st, extra) {
  var h = '<span class="lg ' + (extra || '') + '" style="background:' + col(st.name) + '">' + esc(ini(st.name));
  var src = logoSources(st);
  if (src.length) h += '<img src="' + esc(src[0]) + '" data-alts="' + esc(src.slice(1).join('|')) + '" onload="PRimgOk(this)" onerror="PRimgErr(this)">';
  return h + '</span>';
}
function idxOf(list, id) { for (var k = 0; k < list.length; k++) if (list[k] && list[k].id === id) return k; return -1; }
function memIndex(id) { return idxOf(S.mem, id); }
function isFav(id) { return idxOf(S.favs, id) >= 0; }
function mini(st) { return { id: st.id, name: st.name, url: st.url, fav: st.fav, hp: st.hp || '', cc: st.cc, city: st.city, tags: st.tags, br: st.br, codec: st.codec }; }
var toastT = null;
function toast(msg) {
  var t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 2600);
}

/* ---------- Escala a la pantalla del coche ---------- */
function fit() {
  var W = window.innerWidth, H = window.innerHeight;
  var sc = W / 1280, h = H / sc, left = 0;
  if (h < 600) { sc = H / 600; h = 600; left = (W - 1280 * sc) / 2; }
  var app = $('app');
  app.style.height = h + 'px';
  app.style.transform = 'translate(' + left + 'px,0) scale(' + sc + ')';
}
window.addEventListener('resize', fit);

/* ---------- Catálogo Radio Browser ---------- */
var RB = ['de1', 'de2', 'fi1', 'nl1', 'at1'], rbi = 0;
function rb(path) {
  return new Promise(function (res, rej) {
    var tries = 0;
    (function go() {
      var url = 'https://' + RB[rbi] + '.api.radio-browser.info' + path;
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; fail(); } }, 10000);
      function fail() { rbi = (rbi + 1) % RB.length; if (++tries < RB.length) go(); else rej(new Error('sin conexión')); }
      fetch(url).then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
        .then(function (j) { if (done) return; done = true; clearTimeout(timer); res(j); })
        .catch(function () { if (done) return; done = true; clearTimeout(timer); fail(); });
    })();
  });
}
function mapSt(o) {
  var tags = (o.tags || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 3).join(' · ');
  return {
    id: o.stationuuid, name: (o.name || '').trim(), url: o.url_resolved || o.url, fav: o.favicon || '', hp: o.homepage || '',
    cc: (o.countrycode || '').toUpperCase(), city: (o.state || '').trim(), tags: tags, br: o.bitrate || 0, codec: o.codec || ''
  };
}
function clean(arr) {
  var seen = {}, out = [];
  arr.forEach(function (o) {
    var s = mapSt(o);
    if (!s.url || !s.name) return;
    var key = s.name.toLowerCase().replace(/\s+/g, '');
    if (seen[key]) return;
    seen[key] = 1; out.push(s);
  });
  return out;
}
var Q = '&hidebroken=true&order=clickcount&reverse=true&limit=200';

var CHIPS = [
  { k: 'top', n: 'Populares', i: 'fire' }, { k: 'news', n: 'Noticias', tag: 'news' }, { k: 'pop', n: 'Música', tag: 'pop' },
  { k: 'sport', n: 'Deportes', tag: 'sport' }, { k: '80s', n: '80s-90s', tag: '80s' }, { k: 'fav', n: 'Favoritas', i: 'heart' }
];

function loadList() {
  var req = ++S.listReq;
  var chip = S.chip, p;
  renderChips();
  if (chip === 'fav') p = Promise.resolve(S.favs.slice());
  else if (chip === 'rec') p = Promise.resolve(S.recent.slice());
  else if (chip === 'search') {
    var q = encodeURIComponent(S.query);
    p = Promise.all([
      rb('/json/stations/search?name=' + q + Q).catch(function () { return []; }),
      rb('/json/stations/search?tag=' + q + Q).catch(function () { return []; })
    ]).then(function (r) { return clean(r[0].concat(r[1])); });
  } else {
    var c = null;
    CHIPS.forEach(function (x) { if (x.k === chip) c = x; });
    if (c && c.tag) p = rb('/json/stations/search?countrycode=' + S.cc + '&tag=' + c.tag + Q).then(clean);
    else p = rb('/json/stations/bycountrycodeexact/' + S.cc + '?' + Q.slice(1)).then(clean);
  }
  $('list').innerHTML = '<div class="msg"><b>Cargando emisoras…</b>Un momento</div>';
  p.then(function (list) {
    if (req !== S.listReq) return;
    S.list = list;
    renderList();
  }).catch(function () {
    if (req !== S.listReq) return;
    S.list = [];
    $('list').innerHTML = '<div class="msg"><b>Sin conexión</b>No se pudo cargar el catálogo. Revisa los datos o el wifi.<br><span class="retry" data-a="retry">Reintentar</span></div>';
  });
}

/* ---------- Reproducción ---------- */
function memList() { return S.mem.filter(function (x) { return !!x; }); }
function play(st, src) {
  // Siguiente / anterior (pantalla y volante) recorren siempre las memorias.
  var list = memList();
  var i = idxOf(list, st.id);
  if (i < 0) { list = [st].concat(list); i = 0; }
  S.queue = list.map(mini);
  S.now = st; S.song = ''; S.want = true; S.playing = false; S.state = 2; S.err = false;
  addRecent(st);
  rb('/json/url/' + st.id).catch(function () {});
  if (A) A.setQueue(JSON.stringify(S.queue), i);
  else { S.playing = true; S.state = 3; }
  renderNow();
}
function addRecent(st) {
  var r = S.recent.filter(function (x) { return x.id !== st.id; });
  r.unshift(mini(st));
  S.recent = r.slice(0, 20); LS.set('recent', S.recent);
}
function toggle() {
  if (!S.now) { var m = memList(); if (m.length) play(m[0]); else if (S.list.length) play(S.list[0]); return; }
  if (A) A.toggle(); else { S.want = !S.want; S.playing = S.want; renderNow(); }
}
function step(fwd) {
  if (A) { if (fwd) A.next(); else A.prev(); return; }
  if (!S.queue.length) return;
  var i = idxOf(S.queue, S.now ? S.now.id : ''), n = S.queue.length;
  play(S.queue[(i + (fwd ? 1 : -1) + n) % n]);
}
function findStation(id) {
  var pools = [S.queue, S.mem, S.favs, S.list, S.recent];
  for (var k = 0; k < pools.length; k++) { var i = idxOf(pools[k], id); if (i >= 0) return pools[k][i]; }
  return null;
}
function toggleFav(st) {
  if (!st) return;
  var i = idxOf(S.favs, st.id);
  if (i >= 0) { S.favs.splice(i, 1); toast('Quitada de favoritas'); }
  else { S.favs.unshift(mini(st)); toast('Añadida a favoritas ♥'); }
  LS.set('favs', S.favs); localChanged();
  if (S.chip === 'fav') { S.list = S.favs.slice(); renderList(); } else updateRowHearts();
  renderNow();
}
function saveMem(slot, st) {
  S.mem[slot] = mini(st); LS.set('mem', S.mem); localChanged();
  toast('Guardada en la memoria ' + (slot + 1));
  renderNow();
}
function clearMem(slot) { S.mem[slot] = null; LS.set('mem', S.mem); localChanged(); toast('Memoria ' + (slot + 1) + ' vacía'); renderNow(); }
function firstFreeMem() { for (var k = 0; k < 30; k++) if (!S.mem[k]) return k; return -1; }

/* ---------- Pintado ---------- */
function setTab(t) {
  if (t !== 'mem' && S.moving >= 0) S.moving = -1;
  S.tab = t;
  ['home', 'mem', 'world', 'set'].forEach(function (x) { $('v-' + x).classList.toggle('show', x === t); });
  var tabs = document.querySelectorAll('.tab');
  for (var k = 0; k < tabs.length; k++) tabs[k].classList.toggle('on', tabs[k].getAttribute('data-t') === t);
  if (t === 'world' && !S.countries) loadCountries();
  if (t === 'mem') readVolume();
}
function renderChips() {
  var h = '';
  CHIPS.forEach(function (c, k) {
    h += '<div class="chip' + (S.chip === c.k ? ' on' : '') + '" data-a="chip" data-v="' + k + '">' + (c.i ? ic(c.i, 18) : '') + c.n + '</div>';
  });
  if (S.chip === 'search') h += '<div class="chip on">' + ic('search', 18) + esc(S.query.slice(0, 18)) + '</div>';
  if (S.chip === 'rec') h += '<div class="chip on">' + ic('clock', 18) + 'Recientes</div>';
  $('chips').innerHTML = h;
  $('cFlag').textContent = flag(S.cc);
  $('cName').textContent = countryName(S.cc, S.cc);
  var cnt = '';
  if (S.countries) S.countries.forEach(function (c) { if (c.cc === S.cc) cnt = '· ' + c.n.toLocaleString('es-ES') + ' emisoras'; });
  $('cCount').textContent = cnt;
}
function rowHtml(st, k) {
  var on = S.now && S.now.id === st.id;
  var sub = [st.tags, st.city].filter(Boolean).join(' · ') || countryName(st.cc, st.cc);
  return '<div class="card row' + (on ? ' on' : '') + '" data-a="row" data-v="' + k + '" data-id="' + esc(st.id) + '">' +
    '<span class="num">' + (k + 1) + '</span>' + logo(st) +
    '<div class="nm"><b>' + esc(st.name) + '</b><small>' + (S.chip === 'search' || S.chip === 'fav' || S.chip === 'rec' ? flag(st.cc) + ' ' : '') + esc(sub) + '</small></div>' +
    '<span class="eqslot"></span>' +
    (st.br ? '<span class="kb">' + st.br + 'k</span>' : '') +
    '<span class="hb" data-a="rowfav" data-v="' + k + '">' + ic(isFav(st.id) ? 'heartf' : 'heart', 24) + '</span></div>';
}
function renderList() {
  renderChips();
  if (!S.list.length) {
    var m = S.chip === 'fav' ? '<b>Sin favoritas</b>Pulsa el corazón de una emisora para guardarla aquí.' :
      S.chip === 'rec' ? '<b>Sin recientes</b>Aquí verás las últimas emisoras que escuches.' : '<b>No hay emisoras</b>Prueba con otro país o búsqueda.';
    $('list').innerHTML = '<div class="msg">' + m + '</div>';
    return;
  }
  var h = '';
  S.list.forEach(function (st, k) { h += rowHtml(st, k); });
  $('list').innerHTML = h;
  $('list').scrollTop = 0;
  updateRowState();
}
function updateRowState() {
  var rows = $('list').querySelectorAll('.row');
  for (var k = 0; k < rows.length; k++) {
    var on = !!(S.now && rows[k].getAttribute('data-id') === S.now.id);
    rows[k].classList.toggle('on', on);
    var eq = rows[k].querySelector('.eqslot');
    if (eq) eq.innerHTML = on && S.playing ? '<span class="eq"><i></i><i></i><i></i><i></i></span>' : '';
  }
}
function updateRowHearts() {
  var hs = $('list').querySelectorAll('.hb');
  for (var k = 0; k < hs.length; k++) {
    var st = S.list[+hs[k].getAttribute('data-v')];
    if (st) hs[k].innerHTML = ic(isFav(st.id) ? 'heartf' : 'heart', 24);
  }
}
function liveInfo() {
  if (!S.now) return ['SIN EMISORA', 'off'];
  if (S.err) return ['SIN SEÑAL · REINTENTANDO', 'wait'];
  if (S.want && !S.playing) return ['CONECTANDO…', 'wait'];
  if (S.playing) return ['EN DIRECTO', ''];
  return ['EN PAUSA', 'off'];
}
function renderNow() {
  var st = S.now, li = liveInfo();
  $('liveTag').className = 'live ' + li[1]; $('liveTxt').textContent = li[0];
  $('miniTag').parentNode.className = 'live ' + li[1];
  var mi = st ? memIndex(st.id) : -1;
  $('miniTag').textContent = (mi >= 0 ? 'M ' + (mi + 1) + ' · ' : '') + li[0];
  if (st) {
    $('art').innerHTML = (mi >= 0 ? '<span class="mem">M ' + (mi + 1) + '</span>' : '') + logo(st);
    $('stName').textContent = st.name;
    $('stSong').innerHTML = S.song ? ic('music', 16) + ' ' + esc(S.song) : '';
    $('stTags').textContent = st.tags || '';
    $('stPlace').textContent = flag(st.cc) + ' ' + [st.city, countryName(st.cc, st.cc)].filter(Boolean).join(' · ');
    var b = '';
    if (st.br) b += '<span class="bd">' + st.br + ' KBPS</span>';
    if (st.codec) b += '<span class="bd">' + esc(st.codec.toUpperCase()) + '</span>';
    if (S.playing) b += '<span class="bd c">SEÑAL OK</span>';
    $('stBadges').innerHTML = b;
    $('miniArt').innerHTML = logo(st);
    $('miniName').textContent = st.name;
    $('miniSong').textContent = S.song || st.tags || '';
  } else {
    $('art').innerHTML = '<span class="lg" style="background:' + GRADS[5] + '">' + ic('radio', 70, '#fff') + '</span>';
    $('stName').textContent = 'Elige una emisora';
    $('stSong').textContent = ''; $('stTags').textContent = 'Toca una emisora de la lista o una memoria';
    $('stPlace').textContent = ''; $('stBadges').innerHTML = '';
    $('miniArt').innerHTML = ''; $('miniName').textContent = '—'; $('miniSong').textContent = '';
  }
  var pi = ic(S.want ? 'pause' : 'play', 50);
  $('bPlay').innerHTML = pi; $('mPlay').innerHTML = ic(S.want ? 'pause' : 'play', 40);
  $('bFav').innerHTML = ic(st && isFav(st.id) ? 'heartf' : 'heart', 34, st && isFav(st.id) ? null : '#ff4f8b');
  renderQuick(); renderSlots(); updateRowState();
}
function renderQuick() {
  var h = '';
  for (var k = 0; k < 6; k++) {
    var m = S.mem[k], on = m && S.now && S.now.id === m.id;
    h += '<div class="q' + (on ? ' on' : '') + (m ? '' : ' empty') + '" data-a="slot" data-v="' + k + '"><b>' + (k + 1) + '</b><span>' + (m ? esc(m.name) : 'Libre') + '</span></div>';
  }
  $('quick').innerHTML = h;
}
function renderSlots() {
  var h = '', used = 0;
  S.mem.forEach(function (m) { if (m) used++; });
  if (S.moving >= 0 && S.mem[S.moving]) {
    $('memHint').innerHTML = '<span class="movetxt">↕ Moviendo «' + esc(S.mem[S.moving].name) + '» (M' + (S.moving + 1) +
      '): toca la nueva posición</span><span class="movecancel" data-a="movecancel">Cancelar</span>';
  } else {
    $('memHint').innerHTML = ic('hand') + 'Toca una libre para guardar la que suena · mantén pulsada para mover o cambiar &nbsp;·&nbsp; <b>' + used + '</b>&nbsp;/ 30';
  }
  var bh = '';
  ['Memorias 1 – 10', '11 – 20', '21 – 30'].forEach(function (n, k) {
    bh += '<div class="chip' + (S.bank === k ? ' on' : '') + '" data-a="bank" data-v="' + k + '">' + n + '</div>';
  });
  $('banks').innerHTML = bh;
  for (var k = S.bank * 10; k < S.bank * 10 + 10; k++) {
    var m = S.mem[k];
    if (m) {
      var on = S.now && S.now.id === m.id;
      h += '<div class="card slot' + (on ? ' on' : '') + (S.moving === k ? ' moving' : (S.moving >= 0 ? ' target' : '')) + '" data-a="slot" data-v="' + k + '"><span class="n">' + (k + 1) + '</span>' + logo(m) +
        '<b>' + esc(m.name) + '</b><small>' + flag(m.cc) + ' ' + esc(m.tags || countryName(m.cc, m.cc)) + '</small></div>';
    } else {
      h += '<div class="card slot empty' + (S.moving >= 0 ? ' target' : '') + '" data-a="slot" data-v="' + k + '"><span class="n">' + (k + 1) + '</span>' +
        (S.moving >= 0 ? '<div class="plus">↓</div>Mover aquí' : '<div class="plus">+</div>Libre<br>Toca para guardar<br>la emisora que suena') + '</div>';
    }
  }
  $('slots').innerHTML = h;
}

/* ---------- Países ---------- */
var CONT = {
  EU: ['Europa', 'AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA VA XK'],
  AM: ['América', 'AG AI AR AW BB BL BM BO BQ BR BS BZ CA CL CO CR CU CW DM DO EC FK GD GF GL GP GT GY HN HT JM KN KY LC MF MQ MS MX NI PA PE PM PR PY SR SV SX TC TT US UY VC VE VG VI'],
  AF: ['África', 'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG EH ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TG TN TZ UG YT ZA ZM ZW'],
  AS: ['Asia', 'AE AF AM AZ BD BH BN BT CN GE HK ID IL IN IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TL TM TR TW UZ VN YE'],
  OC: ['Oceanía', 'AS AU CK FJ FM GU KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TO TV VU WF WS']
};
function contOf(cc) { for (var k in CONT) if (CONT[k][1].indexOf(cc) >= 0) return k; return null; }
function loadCountries() {
  var cache = LS.get('countries', null);
  if (cache && Date.now() - cache.t < 7 * 864e5) { S.countries = cache.list; renderCountries(); renderChips(); return; }
  $('countries').innerHTML = '<div class="msg"><b>Cargando países…</b></div>';
  rb('/json/countries').then(function (arr) {
    var map = {};
    arr.forEach(function (c) {
      var cc = (c.iso_3166_1 || '').toUpperCase();
      if (cc.length !== 2 || !c.stationcount) return;
      if (!map[cc]) map[cc] = { cc: cc, name: countryName(cc, c.name), n: 0 };
      map[cc].n += c.stationcount;
    });
    S.countries = Object.keys(map).map(function (k) { return map[k]; });
    LS.set('countries', { t: Date.now(), list: S.countries });
    renderCountries(); renderChips();
  }).catch(function () {
    $('countries').innerHTML = '<div class="msg"><b>Sin conexión</b>No se pudo cargar la lista de países.<br><span class="retry" data-a="retryc">Reintentar</span></div>';
  });
}
function renderCountries() {
  var all = S.countries || [];
  var h = '', total = 0;
  ['EU', 'AM', 'AF', 'AS', 'OC'].forEach(function (k) {
    var n = all.filter(function (c) { return contOf(c.cc) === k; }).length;
    h += '<div class="ci' + (S.cont === k ? ' on' : '') + '" data-a="cont" data-v="' + k + '">' + ic('globe') + CONT[k][0] + '<em>' + n + '</em></div>';
  });
  h += '<div class="ci gap" data-a="recent">' + ic('clock') + 'Recientes<em>' + S.recent.length + '</em></div>';
  h += '<div class="ci" data-a="favs">' + ic('heart') + 'Favoritas<em>' + S.favs.length + '</em></div>';
  $('conts').innerHTML = h;
  all.forEach(function (c) { total += c.n; });
  $('worldInfo').textContent = 'Catálogo mundial · ' + all.length + ' países · ' + total.toLocaleString('es-ES') + ' emisoras';
  var list = all.filter(function (c) { return contOf(c.cc) === S.cont; }).sort(function (a, b) { return b.n - a.n; });
  var g = '';
  list.forEach(function (c) {
    g += '<div class="card ct' + (c.cc === S.cc ? ' on' : '') + '" data-a="ctry" data-v="' + c.cc + '"><span class="flag">' + flag(c.cc) +
      '</span><div><b>' + esc(c.name) + '</b><small>' + c.n.toLocaleString('es-ES') + ' emisoras</small></div></div>';
  });
  $('countries').innerHTML = g || '<div class="msg">Sin países</div>';
}
function doSearch(q) {
  q = (q || '').trim();
  if (q.length < 2) { toast('Escribe al menos 2 letras'); return; }
  S.query = q; S.chip = 'search';
  $('q').blur();
  setTab('home'); loadList();
}

/* ---------- Clima ---------- */
var WMO = [[0, 'Despejado', 'sun'], [1, 'Casi despejado', 'sun'], [2, 'Parcialmente nuboso', 'cloudsun'], [3, 'Nublado', 'cloud'],
  [48, 'Niebla', 'fog'], [57, 'Llovizna', 'rain'], [67, 'Lluvia', 'rain'], [77, 'Nieve', 'snow'], [82, 'Chubascos', 'rain'],
  [86, 'Chubascos de nieve', 'snow'], [99, 'Tormenta', 'storm']];
function wmo(code) { for (var k = 0; k < WMO.length; k++) if (code <= WMO[k][0]) return WMO[k]; return WMO[3]; }
var placeFor = null;
function weather() {
  $('wx').style.display = S.set.weather === '1' ? '' : 'none';
  if (S.set.weather !== '1') return;
  var l = S.loc;
  if (!l) return;
  var u = 'https://api.open-meteo.com/v1/forecast?latitude=' + l.lat.toFixed(3) + '&longitude=' + l.lon.toFixed(3) +
    '&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1';
  fetch(u).then(function (r) { return r.json(); }).then(function (j) {
    var c = j.current || {}, d = j.daily || {};
    var w = wmo(c.weather_code || 0);
    var icon = w[2];
    if (!c.is_day && icon === 'sun') icon = 'moon';
    $('wxIcon').innerHTML = ic(icon, 26);
    $('wxT').textContent = Math.round(c.temperature_2m) + '°';
    var mx = d.temperature_2m_max ? Math.round(d.temperature_2m_max[0]) : '', mn = d.temperature_2m_min ? Math.round(d.temperature_2m_min[0]) : '';
    $('wxDesc').textContent = w[1] + (mx !== '' ? ' · ' + mx + '° / ' + mn + '°' : '');
  }).catch(function () { $('wxDesc').textContent = 'Clima sin conexión'; });
  var key = l.lat.toFixed(2) + ',' + l.lon.toFixed(2);
  if (placeFor !== key) {
    placeFor = key;
    fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + l.lat + '&longitude=' + l.lon + '&localityLanguage=es')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var p = j.city || j.locality || j.principalSubdivision || '';
        if (p) { S.place = p; LS.set('place', p); }
        showPlace();
      }).catch(showPlace);
  }
}
function showPlace() { $('wxPlace').textContent = 'EXTERIOR' + (S.place ? ' · ' + S.place.toUpperCase() : ''); }

/* ---------- Ajustes ---------- */
function renderSettings() {
  var sws = document.querySelectorAll('.sw[data-k]');
  for (var k = 0; k < sws.length; k++) sws[k].classList.toggle('on', S.set[sws[k].getAttribute('data-k')] === '1');
  weather();
}
var KEYS = { 85: 'Play / Pausa', 126: 'Play', 127: 'Pausa', 87: 'Siguiente', 88: 'Anterior', 86: 'Stop', 24: 'Subir volumen', 25: 'Bajar volumen', 164: 'Silencio', 79: 'Botón auricular', 90: 'Avance rápido', 89: 'Retroceso' };

/* ---------- Volumen ---------- */
var vol = 50;
function readVolume() { if (A && A.getVolume) { try { vol = A.getVolume(); } catch (e) {} } showVol(); }
function setVol(v) { vol = Math.max(0, Math.min(100, Math.round(v))); if (A && A.setVolume) A.setVolume(vol); showVol(); }
function showVol() { $('volFill').style.width = vol + '%'; $('volNum').textContent = vol + '%'; }

/* ---------- Hoja de opciones ---------- */
var sheetActs = [];
function sheet(title, opts) {
  sheetActs = opts;
  $('sTitle').textContent = title;
  var h = '';
  opts.forEach(function (o, k) { h += '<div class="sopt ' + (o.c || '') + '" data-a="sopt" data-v="' + k + '">' + esc(o.t) + '</div>'; });
  h += '<div class="sopt" data-a="sclose">Cancelar</div>';
  $('sBtns').innerHTML = h;
  $('sheet').classList.add('show');
}
function closeSheet() { $('sheet').classList.remove('show', 'top'); var i = $('syIn'); if (i) i.blur(); }
function slotLong(k) {
  if (S.moving >= 0) { slotTap(k); return; }
  var m = S.mem[k], opts = [];
  if (m) opts.push({ t: '↕ Mover a otra posición', f: function () { startMove(k); } });
  if (S.now) opts.push({ t: 'Guardar aquí «' + S.now.name + '»', c: 'pri', f: function () { saveMem(k, S.now); } });
  if (m) opts.push({ t: 'Escuchar «' + m.name + '»', f: function () { play(m); } });
  if (m) opts.push({ t: 'Vaciar la memoria ' + (k + 1), c: 'dng', f: function () { clearMem(k); } });
  if (!opts.length) { toast('Primero pon una emisora para poder guardarla'); return; }
  sheet('Memoria ' + (k + 1), opts);
}
function startMove(k) {
  S.moving = k; S.bank = Math.floor(k / 10);
  setTab('mem'); renderSlots();
  toast('Toca la posición donde quieres ponerla');
}
function endMove(msg) { S.moving = -1; LS.set('mem', S.mem); localChanged(); renderNow(); if (msg) toast(msg); }
function doMove(from, to) {
  var m = S.mem[from];
  if (from === to || !m) { S.moving = -1; renderSlots(); return; }
  if (!S.mem[to]) { S.mem[to] = m; S.mem[from] = null; endMove('«' + m.name + '» movida a la M' + (to + 1)); return; }
  var other = S.mem[to];
  sheet('Mover «' + m.name + '» a la M' + (to + 1), [
    { t: 'Ponerla en la M' + (to + 1) + ' y correr las demás', c: 'pri', f: function () {
      var it = S.mem.splice(from, 1)[0]; S.mem.splice(to, 0, it);
      endMove('«' + m.name + '» ahora es la M' + (to + 1));
    } },
    { t: 'Intercambiar con «' + other.name + '»', f: function () {
      S.mem[to] = m; S.mem[from] = other;
      endMove('Intercambiadas M' + (from + 1) + ' y M' + (to + 1));
    } }
  ]);
}
function slotTap(k) {
  if (S.moving >= 0) { doMove(S.moving, k); return; }
  var m = S.mem[k];
  if (m) { play(m); return; }
  if (!S.now) { toast('Primero pon una emisora para poder guardarla'); return; }
  saveMem(k, S.now);
}
function rowLong(k) {
  var st = S.list[k]; if (!st) return;
  var free = firstFreeMem(), opts = [{ t: 'Escuchar', c: 'pri', f: function () { play(st, S.list); } }];
  if (memIndex(st.id) < 0) {
    if (free >= 0) opts.push({ t: 'Guardar en la memoria ' + (free + 1), f: function () { saveMem(free, st); } });
    else opts.push({ t: 'Memorias llenas (borra una en Memorias)', f: function () { setTab('mem'); } });
  }
  opts.push({ t: isFav(st.id) ? 'Quitar de favoritas' : 'Añadir a favoritas', f: function () { toggleFav(st); } });
  sheet(st.name, opts);
}

/* ---------- Toques y pulsaciones largas ---------- */
var press = null;
function actionEl(t) { return t && t.closest ? t.closest('[data-a]') : null; }
document.addEventListener('pointerdown', function (e) {
  var el = actionEl(e.target);
  if (!el) return;
  press = { el: el, x: e.clientX, y: e.clientY, long: false, ev: e };
  el.classList.add('press');
  press.timer = setTimeout(function () {
    if (!press) return;
    press.long = true; press.el.classList.remove('press');
    act(press.el, true, press.ev);
  }, 650);
});
document.addEventListener('pointermove', function (e) {
  if (!press) return;
  if (Math.abs(e.clientX - press.x) > 14 || Math.abs(e.clientY - press.y) > 14) cancelPress();
});
function cancelPress() { if (!press) return; clearTimeout(press.timer); press.el.classList.remove('press'); press = null; }
document.addEventListener('pointercancel', cancelPress);
document.addEventListener('pointerup', function (e) {
  if (!press) return;
  var p = press; clearTimeout(p.timer); p.el.classList.remove('press'); press = null;
  if (!p.long) act(p.el, false, e);
});

function act(el, long, ev) {
  var a = el.getAttribute('data-a'), v = el.getAttribute('data-v');
  switch (a) {
    case 'tab': setTab(v); break;
    case 'chip': S.chip = CHIPS[+v].k; loadList(); break;
    case 'row':
      if (long) rowLong(+v); else if (S.list[+v]) play(S.list[+v], S.list);
      break;
    case 'rowfav': toggleFav(S.list[+v]); break;
    case 'slot': if (long) slotLong(+v); else slotTap(+v); break;
    case 'bank': S.bank = +v; renderSlots(); break;
    case 'movecancel': S.moving = -1; renderSlots(); break;
    case 'play': toggle(); break;
    case 'prev': step(false); break;
    case 'next': step(true); break;
    case 'fav': toggleFav(S.now); break;
    case 'seeall': setTab('mem'); break;
    case 'country': setTab('world'); break;
    case 'cont': S.cont = v; renderCountries(); break;
    case 'ctry': S.cc = v; LS.set('cc', v); S.chip = 'top'; setTab('home'); loadList(); break;
    case 'recent': S.chip = 'rec'; setTab('home'); loadList(); break;
    case 'favs': S.chip = 'fav'; setTab('home'); loadList(); break;
    case 'retry': loadList(); break;
    case 'retryc': loadCountries(); break;
    case 'sw': {
      var k = el.getAttribute('data-k');
      S.set[k] = S.set[k] === '1' ? '0' : '1'; setPref(k, S.set[k]); renderSettings();
      break;
    }
    case 'vdown': setVol(vol - 7); break;
    case 'vup': setVol(vol + 7); break;
    case 'volbar': {
      var r = el.getBoundingClientRect();
      if (ev && r.width) setVol((ev.clientX - r.left) / r.width * 100);
      break;
    }
    case 'mic':
      if (!A || !A.voice()) toast('El reconocimiento de voz no está disponible');
      break;
    case 'qgo': doSearch($('q').value); break;
    case 'sopt': { var o = sheetActs[+v]; closeSheet(); if (o) o.f(); break; }
    case 'sclose': closeSheet(); break;
    case 'synew': syncCreate(); break;
    case 'syjoinsheet': joinSheet(); break;
    case 'syjoin': syncJoin($('syIn') ? $('syIn').value : ''); break;
    case 'synow': toast('Sincronizando…'); syncPull(); break;
    case 'syoff': syncOff(); break;
    case 'upd': if (A && A.checkUpdate) A.checkUpdate(); else toast('Solo disponible en la app'); break;
  }
}

/* ---------- Sincronización móvil ⇄ coche ----------
   Las memorias y favoritas se guardan en jsonblob.com (gratis, sin cuenta).
   Para vincular se usa un código de 8 letras que viaja por ntfy.sh (como en Pro Maps). */
var BLOB = 'https://jsonblob.com/api/jsonBlob/';
var NTFY = 'https://ntfy.sh/proradio-';
var SY = LS.get('sync', null);
var syncT = LS.get('syncT', 0), lastSync = 0, syncMsg = '', pushT = null, syncBusy = false;
var httpN = 0, httpP = {};
function http(method, url, body) {
  return new Promise(function (res, rej) {
    if (!A || !A.http) {
      fetch(url, { method: method, body: body == null ? undefined : body, headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' } })
        .then(function (r) { return r.text().then(function (t) { res({ ok: r.ok, code: r.status, text: t, loc: r.headers.get('Location') || '' }); }); })
        .catch(rej);
      return;
    }
    var id = 'h' + (++httpN);
    httpP[id] = { res: res, rej: rej };
    A.http(id, method, url, body == null ? null : body);
    setTimeout(function () { if (httpP[id]) { delete httpP[id]; rej(new Error('tiempo agotado')); } }, 30000);
  });
}
function fmtCode(c) { return c.slice(0, 4) + '-' + c.slice(4); }
function newCode() {
  var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', c = '';
  for (var k = 0; k < 8; k++) c += abc.charAt(Math.floor(Math.random() * abc.length));
  return c;
}
function hasData(mem, favs) { return (mem || []).some(function (x) { return !!x; }) || (favs || []).length > 0; }
function syncData() { return { app: 'proradio', v: 1, t: syncT, mem: S.mem, favs: S.favs }; }
function localChanged() {
  syncT = Date.now(); LS.set('syncT', syncT);
  if (!SY) return;
  clearTimeout(pushT); pushT = setTimeout(syncPush, 1500);
}
function fixMem(m) { m = (m || []).slice(0, 30); while (m.length < 30) m.push(null); return m; }
function applyRemote(d, msg) {
  S.mem = fixMem(d.mem); S.favs = d.favs || [];
  LS.set('mem', S.mem); LS.set('favs', S.favs);
  syncT = d.t || Date.now(); LS.set('syncT', syncT);
  if (S.chip === 'fav') { S.list = S.favs.slice(); renderList(); } else updateRowHearts();
  renderNow();
  if (msg) toast(msg);
}
var DEAD = 'El enlace ha caducado: desvincula y crea un código nuevo';
function syncPush() {
  if (!SY) return Promise.resolve();
  return http('PUT', BLOB + SY.blob, JSON.stringify(syncData())).then(function (r) {
    if (r.ok) { lastSync = Date.now(); syncMsg = ''; }
    else syncMsg = r.code === 404 ? DEAD : 'No se pudo enviar (error ' + r.code + ')';
    renderSync();
  }).catch(function () { syncMsg = 'Sin conexión: se enviará más tarde'; renderSync(); });
}
function syncPull() {
  if (!SY || syncBusy) return Promise.resolve();
  syncBusy = true;
  return http('GET', BLOB + SY.blob).then(function (r) {
    syncBusy = false;
    if (!r.ok) { syncMsg = r.code === 404 ? DEAD : 'Error ' + r.code; renderSync(); return; }
    var d = null; try { d = JSON.parse(r.text); } catch (e) {}
    if (d && d.app === 'proradio' && d.t > syncT) applyRemote(d, '📲 Memorias actualizadas desde el otro aparato');
    else if (!d || d.t < syncT) syncPush();
    lastSync = Date.now(); syncMsg = ''; renderSync();
  }).catch(function () { syncBusy = false; syncMsg = 'Sin conexión'; renderSync(); });
}
/* Publica el enlace en ntfy para que el otro aparato pueda unirse con el código (dura 12 h). */
function announce(force) {
  if (!SY) return;
  if (!force && Date.now() - LS.get('annT', 0) < 6 * 3600e3) return;
  http('POST', NTFY + SY.code.toLowerCase(), SY.blob).then(function (r) { if (r.ok) LS.set('annT', Date.now()); }).catch(function () {});
}
function syncCreate() {
  toast('Creando código…');
  if (!syncT) { syncT = Date.now(); LS.set('syncT', syncT); }
  http('POST', BLOB.slice(0, -1), JSON.stringify(syncData())).then(function (r) {
    var m = /jsonBlob\/([A-Za-z0-9-]+)/.exec(r.loc || '');
    if (!r.ok || !m) { toast('No se pudo crear el código. Inténtalo de nuevo.'); return; }
    SY = { code: newCode(), blob: m[1] }; LS.set('sync', SY);
    announce(true); lastSync = Date.now(); syncMsg = '';
    renderSync();
    toast('Código creado: ' + fmtCode(SY.code));
  }).catch(function () { toast('Sin conexión. Inténtalo de nuevo.'); });
}
function syncJoin(raw) {
  var code = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 8) { toast('El código tiene 8 letras o números'); return; }
  closeSheet(); toast('Buscando el otro aparato…');
  http('GET', NTFY + code.toLowerCase() + '/json?poll=1&since=12h').then(function (r) {
    var blob = null;
    (r.text || '').split('\n').forEach(function (line) {
      try { var m = JSON.parse(line); if (m.event === 'message' && /^[A-Za-z0-9-]{10,}$/.test(m.message)) blob = m.message; } catch (e) {}
    });
    if (!blob) { toast('Código no encontrado. Abre Pro Radio en el otro aparato y vuelve a probar.'); return; }
    return http('GET', BLOB + blob).then(function (r2) {
      if (!r2.ok) { toast('No se pudo leer el otro aparato (error ' + r2.code + ')'); return; }
      var d = null; try { d = JSON.parse(r2.text); } catch (e) {}
      SY = { code: code, blob: blob }; LS.set('sync', SY); LS.set('annT', Date.now());
      if (d && hasData(d.mem, d.favs)) {
        // Se juntan: manda lo del otro aparato; los huecos libres se rellenan con lo de este.
        var mem = fixMem(d.mem), local = S.mem;
        for (var k = 0; k < 30; k++) if (!mem[k] && local[k] && idxOf(mem, local[k].id) < 0) mem[k] = local[k];
        var favs = (d.favs || []).slice();
        S.favs.forEach(function (f) { if (idxOf(favs, f.id) < 0) favs.push(f); });
        applyRemote({ mem: mem, favs: favs, t: Date.now() }, '✅ Vinculado: memorias juntadas con el otro aparato');
        syncPush();
      } else {
        localChanged(); syncPush();
        toast('✅ Vinculado');
      }
      lastSync = Date.now(); renderSync();
    });
  }).catch(function () { toast('Sin conexión. Inténtalo de nuevo.'); });
}
function joinSheet() {
  sheetActs = [];
  $('sTitle').textContent = 'Escribe el código del otro aparato';
  $('sBtns').innerHTML = '<input id="syIn" class="syin" maxlength="9" placeholder="K7PQ-M2XD" autocomplete="off" autocapitalize="characters">' +
    '<div class="sopt pri" data-a="syjoin">Vincular</div><div class="sopt" data-a="sclose">Cancelar</div>';
  $('sheet').classList.add('show', 'top');
  setTimeout(function () { var i = $('syIn'); if (i) i.focus(); }, 200);
}
function syncOff() {
  sheet('¿Desvincular este aparato?', [{ t: 'Sí, desvincular', c: 'dng', f: function () {
    SY = null; LS.set('sync', null); renderSync(); toast('Desvinculado. Tus memorias se quedan en este aparato.');
  } }]);
}
function ago(t) {
  var s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'hace un momento';
  if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
  return 'hace ' + Math.round(s / 3600) + ' h';
}
function renderSync() {
  var b = $('syncBox'); if (!b) return;
  if (!SY) {
    b.innerHTML = '<div class="syh">📲 Sincronizar móvil y coche</div><div class="muted">Las memorias y favoritas serán iguales en los dos aparatos.</div>' +
      '<div class="sybtns"><div class="sybtn pri" data-a="synew">Crear código</div><div class="sybtn" data-a="syjoinsheet">Tengo un código</div></div>';
  } else {
    b.innerHTML = '<div class="syh">📲 Vinculado · código <span class="code">' + fmtCode(SY.code) + '</span></div><div class="muted">' +
      esc(syncMsg || (lastSync ? 'Sincronizado ' + ago(lastSync) : 'Sincronizando…')) +
      ' · En el otro aparato: Ajustes → Tengo un código.</div>' +
      '<div class="sybtns"><div class="sybtn" data-a="synow">🔄 Sincronizar ahora</div><div class="sybtn dng" data-a="syoff">Desvincular</div></div>';
  }
}

/* ---------- Llamadas desde la parte nativa ---------- */
window.PR = {
  onState: function (s) {
    S.playing = !!s.playing; S.want = !!s.want; S.state = s.state; S.err = !!s.error; S.song = s.song || '';
    if (s.id) { var st = findStation(s.id); if (st) S.now = st; }
    renderNow();
  },
  onLocation: function (lat, lon) {
    var first = !S.loc;
    S.loc = { lat: lat, lon: lon }; LS.set('loc', S.loc);
    if (first || Date.now() - lastWx > 5 * 60000) { lastWx = Date.now(); weather(); }
  },
  onKey: function (code, name) {
    var d = document.querySelector('.detect');
    d.classList.add('hit');
    $('keyOut').innerHTML = 'Detectado: <b style="color:#5cff9d">' + esc(KEYS[code] || name) + '</b> (código ' + code + ') ✓';
    if (code === 24 || code === 25) setTimeout(readVolume, 300);
  },
  onHttp: function (o) { var p = httpP[o.id]; if (!p) return; delete httpP[o.id]; if (!o.ok && !o.code) p.rej(new Error(o.text)); else p.res(o); },
  onResume: function () { syncPull(); },
  onVoice: function (text) { $('q').value = text; doSearch(text); },
  toast: toast
};
var lastWx = 0;

/* ---------- Arranque ---------- */
function bind(id, a) { $(id).setAttribute('data-a', a); }
function init() {
  iconize();
  fit();
  var tabs = document.querySelectorAll('.tab');
  for (var k = 0; k < tabs.length; k++) { tabs[k].setAttribute('data-a', 'tab'); tabs[k].setAttribute('data-v', tabs[k].getAttribute('data-t')); }
  bind('bPlay', 'play'); bind('mPlay', 'play'); bind('bPrev', 'prev'); bind('mPrev', 'prev'); bind('bNext', 'next'); bind('mNext', 'next');
  bind('bFav', 'fav'); bind('seeAll', 'seeall'); bind('countryBtn', 'country');
  bind('vDown', 'vdown'); bind('vUp', 'vup'); bind('volBar', 'volbar'); bind('micBtn', 'mic'); bind('qGo', 'qgo'); bind('updBtn', 'upd');
  if (A && A.version) { try { $('updBtn').textContent = '🔄 Buscar actualización (tienes la v' + A.version() + ')'; } catch (e) {} }
  var sws = document.querySelectorAll('.sw[data-k]');
  for (var j = 0; j < sws.length; j++) sws[j].setAttribute('data-a', 'sw');
  $('q').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.keyCode === 13) doSearch(this.value); });
  $('sheet').addEventListener('click', function (e) { if (e.target === this) closeSheet(); });

  if (A && A.lastQueue) { try { S.queue = JSON.parse(A.lastQueue()) || []; } catch (e) {} }
  showPlace();
  if (!S.loc) setTimeout(function () { if (!S.loc) { S.loc = { lat: 40.4168, lon: -3.7038 }; weather(); } }, 20000);

  setTab('home');
  renderSettings();
  renderNow();
  loadList();
  readVolume();
  if (A && A.requestState) A.requestState();

  var clock = function () {
    var d = new Date();
    $('clock').textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  };
  clock(); setInterval(clock, 10000);
  setInterval(function () { lastWx = Date.now(); weather(); }, 15 * 60000);
  setTimeout(loadCountriesQuiet, 1500);
  renderSync();
  if (SY) { announce(false); setTimeout(syncPull, 1200); }
  setInterval(function () { if (SY) syncPull(); if (S.tab === 'set') renderSync(); }, 60000);
}
function loadCountriesQuiet() {
  var cache = LS.get('countries', null);
  if (cache && Date.now() - cache.t < 7 * 864e5) { S.countries = cache.list; renderChips(); return; }
  if (!S.countries) loadCountries();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
