// Pasita para video. Mismas piezas, anclas y poses que src/lib/mascota.ts
// (fuente única de la app). Si cambia una pose allá, se copia aquí.
var PASITA_BASE = '../../public/mascota/';
var PASITA_M = { x: 60, y: 20 }, PASITA_VB = { w: 234, h: 221 };

var PASITA_ANCHOS = {
  'Cuerpo/cuerpo-01.svg': 114, 'Cuerpo/cuerpo-02.svg': 114,
  'Ojos/ojo-der01.svg': 31, 'Ojos/ojo-izq01.svg': 31, 'Ojos/ojo-der02.svg': 28, 'Ojos/ojo-izq02.svg': 28,
  'Ojos/ojo-der03.svg': 26, 'Ojos/ojo-izq03.svg': 27, 'Ojos/ojo-der04.svg': 31, 'Ojos/ojo-izq04.svg': 31,
  'Cejas/ceja-der01.svg': 26, 'Cejas/ceja-izq01.svg': 26, 'Cejas/ceja-der02.svg': 26, 'Cejas/ceja-izq02.svg': 26,
  'Cejas/ceja-der03.svg': 24, 'Cejas/ceja-izq03.svg': 24,
  'Boca/boca-01.svg': 30, 'Boca/boca-02.svg': 30, 'Boca/boca-03.svg': 28, 'Boca/boca-04.svg': 32,
  'Brazos/brazo-der01.svg': 38, 'Brazos/brazo-izq01.svg': 37, 'Brazos/brazo-der02.svg': 55, 'Brazos/brazo-izq02.svg': 55,
  'Brazos/brazo-der03.svg': 65, 'Brazos/brazo-izq03.svg': 64, 'Brazos/brazo-der04.svg': 52, 'Brazos/brazo-izq04.svg': 52,
  'Brazos/brazo-izq05.svg': 43, 'Brazos/brazo-der06.svg': 47, 'Brazos/brazo-izq06.svg': 58, 'Brazos/brazo-izq07.svg': 52,
  'pies/pie-der01.svg': 50, 'pies/pie-izq01.svg': 50,
  'Aura/Aura-morado.svg': 202, 'Aura/Aura-fuego.svg': 202,
};
var PASITA_ANCLAS = {
  'pies/pie-der01.svg': [69.4, 170.7], 'pies/pie-izq01.svg': [-7.4, 170.7],
  'Ojos/ojo-der01.svg': [62.9, 75.3], 'Ojos/ojo-izq01.svg': [19.4, 73.6], 'Ojos/ojo-der02.svg': [63.3, 71.3], 'Ojos/ojo-izq02.svg': [20.0, 71.3],
  'Ojos/ojo-der03.svg': [63.2, 66.1], 'Ojos/ojo-izq03.svg': [24.3, 64.6], 'Ojos/ojo-der04.svg': [62.9, 75.2], 'Ojos/ojo-izq04.svg': [20.0, 75.2],
  'Cejas/ceja-der01.svg': [64.8, 60.7], 'Cejas/ceja-izq01.svg': [22.5, 60.7], 'Cejas/ceja-der02.svg': [65.2, 59.8], 'Cejas/ceja-izq02.svg': [22.2, 59.8],
  'Cejas/ceja-der03.svg': [64.8, 59.6], 'Cejas/ceja-izq03.svg': [27.1, 59.6],
  'Boca/boca-01.svg': [41.9, 96.0], 'Boca/boca-02.svg': [42.5, 93.5], 'Boca/boca-03.svg': [43.2, 96.0], 'Boca/boca-04.svg': [40.0, 107.5],
};
var PIES = ['pies/pie-der01.svg', 'pies/pie-izq01.svg'];
var PASITA_POSES = {
  confiada: { propias: [['Brazos/brazo-der01.svg', 102.5, 98.9], ['Brazos/brazo-izq01.svg', -26.2, 98.9]],
    ancladas: PIES.concat(['Cejas/ceja-der01.svg', 'Cejas/ceja-izq01.svg', 'Ojos/ojo-der01.svg', 'Ojos/ojo-izq01.svg', 'Boca/boca-01.svg']) },
  celebrando: { propias: [['Brazos/brazo-der02.svg', 99.6, 19.6], ['Brazos/brazo-izq02.svg', -41.6, 19.6]],
    ancladas: PIES.concat(['Cejas/ceja-der02.svg', 'Cejas/ceja-izq02.svg', 'Ojos/ojo-der02.svg', 'Ojos/ojo-izq02.svg', 'Boca/boca-02.svg']) },
  pensativa: { propias: [['Brazos/brazo-izq03.svg', -7.5, 102.1, true]],
    ancladas: PIES.concat(['Cejas/ceja-der02.svg', 'Cejas/ceja-izq02.svg', 'Ojos/ojo-der03.svg', 'Ojos/ojo-izq03.svg', 'Boca/boca-03.svg']) },
  aprobando: { propias: [['Brazos/brazo-der03.svg', 95.4, 61.4], ['Brazos/brazo-izq01.svg', -25.4, 88.2]],
    ancladas: PIES.concat(['Cejas/ceja-der02.svg', 'Cejas/ceja-izq02.svg', 'Ojos/ojo-der04.svg', 'Ojos/ojo-izq04.svg', 'Boca/boca-03.svg']) },
  flexionando: { aura: 'Aura/Aura-morado.svg', propias: [['Brazos/brazo-der04.svg', 62.0, 99.6, true], ['Brazos/brazo-izq04.svg', 0.0, 99.6, true]],
    ancladas: PIES.concat(['Cejas/ceja-der03.svg', 'Cejas/ceja-izq03.svg', 'Ojos/ojo-der01.svg', 'Ojos/ojo-izq02.svg', 'Boca/boca-03.svg']) },
  lapiz: { propias: [['Brazos/brazo-der01.svg', 101.1, 100.4], ['Brazos/brazo-izq07.svg', -47.5, 38.2]],
    ancladas: PIES.concat(['Cejas/ceja-der02.svg', 'Cejas/ceja-izq02.svg', 'Ojos/ojo-der04.svg', 'Ojos/ojo-izq04.svg', 'Boca/boca-03.svg']) },
};
var PASITA_CERRADOS = { der: 'Ojos/ojo-der02.svg', izq: 'Ojos/ojo-izq02.svg' };

// Arma a la Pasita dentro de `el` con `px` de ancho. Devuelve el wrapper.
function buildPasita(el, pose, px) {
  var r = PASITA_POSES[pose], k = px / PASITA_VB.w, html = '';
  function pieza(src, x, y, extra) {
    return '<img src="' + PASITA_BASE + src + '" ' + (extra || '') + ' style="position:absolute;left:' + ((x + PASITA_M.x) * k) +
      'px;top:' + ((y + PASITA_M.y) * k) + 'px;width:' + (PASITA_ANCHOS[src] * k) + 'px;height:auto">';
  }
  if (r.aura) html += pieza(r.aura, -44, -37, 'data-aura');
  r.propias.filter(function (p) { return !p[3]; }).forEach(function (p) { html += pieza(p[0], p[1], p[2]); });
  html += pieza('Cuerpo/cuerpo-01.svg', 0, 0);
  r.propias.filter(function (p) { return p[3]; }).forEach(function (p) { html += pieza(p[0], p[1], p[2]); });
  r.ancladas.forEach(function (src) {
    var a = PASITA_ANCLAS[src], ojo = src.indexOf('Ojos/ojo-der') === 0 ? 'der' : (src.indexOf('Ojos/ojo-izq') === 0 ? 'izq' : '');
    html += pieza(src, a[0], a[1], ojo ? 'data-ojo="' + ojo + '" data-abierto="' + src + '"' : '');
  });
  el.innerHTML = '<div class="pasita-in" style="position:relative;width:' + px + 'px;height:' + (px * PASITA_VB.h / PASITA_VB.w) + 'px">' + html + '</div>';
  return el.firstChild;
}

// Parpadeo determinista: ojos cerrados 0.13 s en los segundos indicados.
var PARPADEOS = [1.7, 4.9, 7.4, 10.8, 13.1, 16.6, 19.2, 22.5, 25.8, 29.3];
function blinkAll(t) {
  var cerrado = PARPADEOS.some(function (b) { return t >= b && t < b + 0.13; });
  document.querySelectorAll('img[data-ojo]').forEach(function (img) {
    var src = cerrado ? PASITA_BASE + PASITA_CERRADOS[img.dataset.ojo] : PASITA_BASE + img.dataset.abierto;
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
  });
}

// Promesa que se resuelve cuando todas las piezas (incluidos ojos cerrados) cargaron.
function pasitaReady() {
  var extra = [PASITA_CERRADOS.der, PASITA_CERRADOS.izq].map(function (s) { var i = new Image(); i.src = PASITA_BASE + s; return i; });
  var imgs = Array.prototype.slice.call(document.images).concat(extra);
  return Promise.all(imgs.map(function (i) {
    return i.complete && i.naturalWidth ? true : new Promise(function (ok, ko) { i.onload = ok; i.onerror = function () { ko(new Error('No cargó ' + i.src)); }; });
  }));
}
