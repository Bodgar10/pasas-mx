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

// Achica por igual un grupo de líneas (título de varias líneas) para que la más
// ancha quepa en `max` px. Nunca agranda.
function fitLines(lines, max) {
  var widest = 0;
  lines.forEach(function (el) { el.style.width = 'max-content'; widest = Math.max(widest, el.getBoundingClientRect().width); el.style.width = ''; });
  if (widest <= max) return 1;
  var k = max / widest;
  lines.forEach(function (el) { el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * k) + 'px'; });
  return k;
}
// Achica un bloque que envuelve en varias líneas si una palabra sola no cabe.
function fitBlock(el) {
  var size = parseFloat(getComputedStyle(el).fontSize);
  for (var i = 0; i < 25 && el.scrollWidth > el.clientWidth + 1; i++) { size *= 0.94; el.style.fontSize = size + 'px'; }
}

// Cuánto dura cada pantalla de un video con la Pasita: lo suficiente para leerla con calma.
function duracionPantalla(p) {
  if (p.dur) return p.dur;            // voz propia: lo que dura su audio
  if (p.tipo === 'gancho') return 3.2;
  if (p.tipo === 'grande') return 2.4;
  if (p.tipo === 'cierre') return 4;
  var n = (p.titulo || '').length + (p.texto || '').length;
  return Math.max(3.5, Math.min(6.5, 2.2 + n * 0.042));
}
// "▶ 30 segundos": dato real del video, redondeado a 5 s. Sin ganchos ni promesas.
function etiquetaDuracion(pantallas) {
  var s = pantallas.reduce(function (a, p) { return a + duracionPantalla(p); }, 0);
  s = Math.max(10, Math.round(s / 5) * 5);
  return s < 60 ? s + ' segundos' : (s % 60 ? Math.floor(s / 60) + ' min ' + (s % 60) + ' s' : (s / 60) + ' min');
}
