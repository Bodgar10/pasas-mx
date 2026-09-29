// Utilidades compartidas por las plantillas de video.
// Cada plantilla define window.setup(data) → duración en segundos y window.render(t).
var $ = function (id) { return document.getElementById(id); };
var clamp = function (x) { return Math.max(0, Math.min(1, x)); };
var easeOut = function (p) { return 1 - Math.pow(1 - p, 3); };
var back = function (p) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
var F = 0.35;

function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// Opacidad de una escena entre a y b, con fundido de entrada y salida.
function win(t, a, b, fadeIn, fadeOut) {
  if (t < a || t >= b) return 0;
  var i = fadeIn === false ? 1 : clamp((t - a) / F);
  var o = fadeOut === false ? 1 : clamp((b - t) / F);
  return Math.min(i, o);
}

// Aplica opacidad + un pequeño desplazamiento de entrada a un elemento.
function show(el, a) {
  el.style.opacity = a;
  el.style.transform = 'translateY(' + ((1 - easeOut(a)) * 3) + 'cqw)';
}

// Entrada con rebote a partir del segundo `at`.
function pop(el, t, at, dur) {
  var q = clamp((t - at) / (dur || 0.3));
  el.style.opacity = q;
  el.style.transform = 'scale(' + (0.88 + 0.12 * back(q)) + ')';
  return q;
}

// Anillo de cuenta regresiva: n segundos que terminan en `end`.
function ring(elRing, elBar, elNum, t, start, end) {
  var on = t >= start && t < end + 0.2;
  elRing.style.opacity = on ? clamp((t - start) / 0.25) : 0;
  if (!on) return;
  var span = end - start, left = Math.max(0, end - t);
  elNum.textContent = Math.max(1, Math.ceil(left));
  elBar.setAttribute('stroke-dashoffset', (100.5 * (1 - left / span)).toFixed(1));
}

// Reduce la letra hasta que el texto quepa en su caja.
function fit(el, box) {
  var size = parseFloat(getComputedStyle(el).fontSize);
  for (var i = 0; i < 30 && (el.scrollWidth > box.clientWidth - 2 || box.scrollHeight > box.clientHeight + 1); i++) {
    size *= 0.94; el.style.fontSize = size + 'px';
  }
}

var RING_SVG = '<svg viewBox="0 0 40 40"><circle class="track" cx="20" cy="20" r="16"/><circle class="bar" cx="20" cy="20" r="16" stroke-dasharray="100.5" stroke-dashoffset="0"/></svg><b>5</b>';
