// Base de los videos de bodgar.dev. Contrato con src/bodgar.mjs:
//   window.setup({ids, durs}) → segundos totales; window.render(t); window.momentos() → un segundo por escena.
// Cada plantilla define window.escena(t) (su animación) y, si lo necesita, window.prepara().
// S[id] y E[id] son el inicio y el fin de cada escena, en segundos.
var $ = function (id) { return document.getElementById(id); };
var clamp = function (x) { return Math.max(0, Math.min(1, x)); };
var easeOut = function (p) { return 1 - Math.pow(1 - p, 3); };
var back = function (p) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
var F = 0.3, S = {}, E = {}, ORDEN = [];
function win(t, a, b) { if (t < a || t >= b) return 0; return Math.min(clamp((t - a) / F), clamp((b - t) / F)); }
function slide(el, a, dy) { el.style.opacity = a; el.style.transform = 'translateY(' + ((1 - easeOut(a)) * (dy || 60)) + 'px)'; }
// Un bloque que entra al inicio de la escena a y sale al final de la escena b.
function bloque(el, a, b, t, desde) {
  var i = easeOut(clamp((t - S[a] - 0.05) / 0.5)), o = easeOut(clamp((t - (E[b] - 0.3)) / 0.4));
  el.style.opacity = (t >= S[a] && t < E[b] + 0.1) ? Math.min(i, 1 - o) : 0;
  el.style.transform = 'translateY(' + ((1 - i) * (desde || 120) - o * 60) + 'px)';
  return i;
}
// Aparece un elemento en el segundo `at` (de abajo, o de lado si dx).
function aparece(id, t, at, dx) {
  var q = clamp((t - at) / 0.3), el = typeof id === 'string' ? $(id) : id;
  el.style.opacity = q;
  el.style.transform = dx ? 'translateX(' + ((1 - easeOut(q)) * dx) + 'px)' : 'translateY(' + ((1 - easeOut(q)) * 30) + 'px)';
  return q;
}
// Rebote de entrada.
function pop(el, t, at, dur) { var q = clamp((t - at) / (dur || 0.35)); el.style.opacity = q; el.style.transform = 'scale(' + (0.85 + 0.15 * back(q)) + ')'; return q; }
// Un número que sube de 0 a `hasta` entre at y at+dur.
function cuenta(t, at, dur, hasta) { return hasta * easeOut(clamp((t - at) / dur)); }
function pesos(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
// Dedo que toca el centro de un elemento en el segundo t0. Devuelve true mientras se ve.
function toque(t, t0, el) {
  var d = t - t0, f = $('tap'), r = $('ripple'), fr = $('frame').getBoundingClientRect();
  if (!(d > -0.5 && d < 0.4)) return false;
  var b = el.getBoundingClientRect();
  f.style.left = r.style.left = (b.left - fr.left + b.width / 2) + 'px';
  f.style.top = r.style.top = (b.top - fr.top + b.height / 2) + 'px';
  f.style.opacity = clamp((d + 0.5) / 0.2) * clamp((0.4 - d) / 0.2);
  f.style.transform = 'scale(' + (d > -0.08 && d < 0.12 ? 0.8 : 1) + ')';
  var q = clamp(d / 0.45); r.style.opacity = d > 0 && d < 0.45 ? 0.8 * (1 - q) : 0; r.style.transform = 'scale(' + (1 + q * 1.5) + ')';
  return true;
}
// Rayo del giro ("esto se resuelve").
function giro(el, t, id) {
  el.style.opacity = win(t, S[id], E[id]);
  el.style.transform = 'scale(' + (0.6 + 0.4 * back(clamp((t - S[id]) / 0.4))) + ') rotate(' + (Math.sin(t * 3) * 4) + 'deg)';
}
var RAYO = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>';

window.setup = function (data) {
  ORDEN = data.ids; var t = 0;
  ORDEN.forEach(function (id, i) { S[id] = t; t += data.durs[i]; E[id] = t; });
  document.querySelectorAll('.giro').forEach(function (g) { g.innerHTML = RAYO; });
  if (window.prepara) window.prepara();
  window.render(0);
  return t;
};
window.momentos = function () { return ORDEN.map(function (id) { return S[id] + (E[id] - S[id]) * 0.8; }); };
window.render = function (t) {
  ORDEN.forEach(function (id) {
    var el = $('t-' + id); if (!el) return;
    slide(el, win(t, S[id], E[id] + (id === ORDEN[ORDEN.length - 1] ? 99 : 0)), 50);
    var h = el.querySelector('h1'); if (h) h.style.transform = 'scale(' + (0.92 + 0.08 * back(clamp((t - S[id]) / 0.4))) + ')';
  });
  var tapOn = window.escena ? window.escena(t) : false;
  if (!tapOn && $('tap')) { $('tap').style.opacity = 0; $('ripple').style.opacity = 0; }
  var ult = ORDEN[ORDEN.length - 1];
  if ($('fin')) slide($('fin'), clamp((t - S[ult] - 0.15) / 0.5), 70);
  if ($('url')) $('url').style.transform = 'scale(' + (1 + 0.03 * Math.sin(Math.max(0, t - S[ult] - 1) * 4)) + ')';
};
