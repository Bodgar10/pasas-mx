// Fondos ilustrados para los videos y portadas (estilo de los carruseles de @pasas.mx).
// Vectores dibujados aquí: sin imágenes externas, nítidos a cualquier tamaño.
//   buildFondo(el, 'cuarto')          → cuarto de estudio de noche
//   buildFondo(el, 'imagen:foo.png')  → una imagen de video/fondos/ (p. ej. generada con ChatGPT, sin texto)
//   animFondo(t)                      → movimiento sutil (lava, estrellas, partículas)

var FONDO_W = 1080, FONDO_H = 1920;

function _libros(x, y, specs) {
  // Libros acostados en pila (de abajo hacia arriba). specs: [ancho, alto, color, etiqueta]
  var out = '', yy = y;
  specs.forEach(function (b, i) {
    var w = b[0], h = b[1], dx = (i % 2 ? 14 : -6);
    yy -= h;
    out += '<g transform="translate(' + (x + dx) + ',' + yy + ')">' +
      '<rect width="' + w + '" height="' + h + '" rx="8" style="fill:' + b[2] + '"/>' +
      '<rect x="' + (w - 26) + '" y="4" width="20" height="' + (h - 8) + '" rx="4" style="fill:#efe6ff;opacity:.85"/>' +
      '<rect y="' + (h - 7) + '" width="' + w + '" height="7" rx="3" style="fill:#000;opacity:.25"/>' +
      (b[3] ? '<text x="26" y="' + (h / 2 + 12) + '" style="font:900 32px Nunito;fill:#fff;opacity:.75;letter-spacing:1px">' + b[3] + '</text>' : '') +
      '</g>';
  });
  return out;
}

function _estante(x, y, w) {
  var colors = ['#6d28d9', '#0e7490', '#be185d', '#a16207', '#4c1d95', '#155e75', '#9d174d'];
  var out = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="18" rx="6" style="fill:#2a1a4d"/>';
  var cx = x + 10, i = 0;
  while (cx < x + w - 40) {
    var bw = 26 + (i * 13) % 18, bh = 110 + (i * 37) % 60, tilt = (i === 5 ? -12 : 0);
    out += '<rect x="' + cx + '" y="' + (y - bh) + '" width="' + bw + '" height="' + bh + '" rx="5" transform="rotate(' + tilt + ' ' + (cx + bw) + ' ' + y + ')" style="fill:' + colors[i % colors.length] + ';opacity:.8"/>';
    cx += bw + 4 + (tilt ? 16 : 0); i++;
  }
  return out;
}

function _fondoCuarto() {
  var stars = '';
  for (var i = 0; i < 22; i++) {
    var sx = 700 + (i * 97) % 300, sy = 330 + (i * 61) % 300, r = 2 + (i % 3);
    stars += '<circle class="fz-star" data-i="' + i + '" cx="' + sx + '" cy="' + sy + '" r="' + r + '" style="fill:#fff"/>';
  }
  var dust = '';
  for (var j = 0; j < 26; j++) {
    dust += '<circle class="fz-dust" data-i="' + j + '" cx="' + ((j * 173) % 1080) + '" cy="' + ((j * 311) % 1920) + '" r="' + (2 + j % 3) + '" style="fill:#c4b5fd;opacity:.35"/>';
  }
  return '<svg viewBox="0 0 1080 1920" width="1080" height="1920" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0">' +
    '<defs>' +
      '<linearGradient id="fz-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1760"/><stop offset=".6" stop-color="#1f1147"/><stop offset="1" stop-color="#140b30"/></linearGradient>' +
      '<linearGradient id="fz-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset="1" stop-color="#5b21b6"/></linearGradient>' +
      '<radialGradient id="fz-lamp" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f472b6" stop-opacity=".55"/><stop offset="1" stop-color="#f472b6" stop-opacity="0"/></radialGradient>' +
      '<radialGradient id="fz-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#8b5cf6" stop-opacity=".6"/><stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="fz-desk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2378"/><stop offset="1" stop-color="#1a0f3a"/></linearGradient>' +
      '<clipPath id="fz-win"><rect x="660" y="290" width="340" height="380" rx="22"/></clipPath>' +
    '</defs>' +
    // Pared con franjas sutiles
    '<rect width="1080" height="1920" style="fill:url(#fz-wall)"/>' +
    '<g style="opacity:.06">' + Array.apply(null, Array(14)).map(function (_, k) { return '<rect x="' + (k * 80) + '" y="0" width="36" height="1920" style="fill:#fff"/>'; }).join('') + '</g>' +
    // Ventana con cielo, luna y estrellas
    '<g clip-path="url(#fz-win)"><rect x="660" y="290" width="340" height="380" style="fill:url(#fz-sky)"/>' + stars +
      '<circle cx="920" cy="370" r="44" style="fill:#fde68a;opacity:.9"/><circle cx="938" cy="358" r="40" style="fill:#2e1f6b"/>' +
      '<path d="M660 600 Q720 560 780 590 T900 580 T1000 600 V670 H660Z" style="fill:#140b30;opacity:.9"/></g>' +
    '<rect x="660" y="290" width="340" height="380" rx="22" style="fill:none;stroke:#3b2378;stroke-width:16"/>' +
    '<rect x="822" y="290" width="16" height="380" style="fill:#3b2378"/><rect x="660" y="472" width="340" height="16" style="fill:#3b2378"/>' +
    // Librero de pared (izquierda)
    '<g style="opacity:.85">' + _estante(40, 760, 360) + _estante(40, 1000, 360) + '</g>' +
    '<g transform="translate(330,640)" style="opacity:.8"><path d="M0 120 Q-30 60 10 0 Q30 60 20 120Z" style="fill:#16a34a"/><path d="M20 120 Q60 50 40 -10 Q10 60 10 120Z" style="fill:#22c55e"/><rect x="-8" y="112" width="44" height="40" rx="8" style="fill:#7c3aed"/></g>' +
    // Póster con control de videojuego (genérico)
    '<g transform="translate(470,760) rotate(-4)" style="opacity:.75"><rect width="190" height="150" rx="14" style="fill:#1e1147;stroke:#7c3aed;stroke-width:6"/>' +
      '<path d="M50 60 h90 a28 28 0 0 1 22 45 l-10 12 a16 16 0 0 1 -26 -4 l-6 -12 h-50 l-6 12 a16 16 0 0 1 -26 4 l-10 -12 a28 28 0 0 1 22 -45z" style="fill:#a78bfa"/>' +
      '<rect x="62" y="74" width="8" height="24" rx="2" style="fill:#1e1147"/><rect x="54" y="82" width="24" height="8" rx="2" style="fill:#1e1147"/>' +
      '<circle cx="124" cy="80" r="6" style="fill:#f472b6"/><circle cx="136" cy="92" r="6" style="fill:#22d3ee"/></g>' +
    // Brillo de la lámpara de lava
    '<ellipse cx="980" cy="1330" rx="240" ry="320" style="fill:url(#fz-lamp)"/>' +
    '<ellipse cx="540" cy="1250" rx="520" ry="420" style="fill:url(#fz-glow)"/>' +
    // Escritorio
    '<rect x="-20" y="1560" width="1120" height="400" style="fill:url(#fz-desk)"/>' +
    '<rect x="-20" y="1552" width="1120" height="22" rx="8" style="fill:#4c2c94"/>' +
    // Pila de libros con materias (izquierda, sobre el escritorio)
    '<g style="opacity:.95">' + _libros(64, 1556, [[330, 70, '#4338ca', 'MATE'], [310, 64, '#7c3aed', 'HISTORIA'], [300, 62, '#0f766e', 'BIOLOGÍA'], [280, 58, '#be185d', 'LITERATURA']]) + '</g>' +
    // Laptop (derecha) con logo de uva
    '<g transform="translate(780,1330)"><path d="M20 0 h250 a14 14 0 0 1 14 14 v196 h-278 v-196 a14 14 0 0 1 14 -14z" style="fill:#2e1f5e;stroke:#5b3fb0;stroke-width:6"/>' +
      '<g transform="translate(128,80)"><circle cx="10" cy="10" r="11" style="fill:#7c3aed"/><circle cx="28" cy="10" r="11" style="fill:#7c3aed"/><circle cx="19" cy="26" r="11" style="fill:#7c3aed"/><path d="M19 -4 q6 -10 14 -8" style="fill:none;stroke:#22c55e;stroke-width:5;stroke-linecap:round"/></g>' +
      '<path d="M-30 210 h350 l-20 18 h-310z" style="fill:#4c2c94"/></g>' +
    // Lámpara de lava
    '<g transform="translate(958,1180)"><path d="M-34 0 L34 0 L50 300 L-50 300Z" style="fill:#9d174d;opacity:.55"/>' +
      '<ellipse class="fz-lava" data-i="0" cx="0" cy="80" rx="22" ry="30" style="fill:#fb7185"/>' +
      '<ellipse class="fz-lava" data-i="1" cx="-6" cy="200" rx="28" ry="34" style="fill:#f472b6"/>' +
      '<path d="M-40 -30 h80 l-6 30 h-68z" style="fill:#4c2c94"/><path d="M-56 300 h112 l14 70 h-140z" style="fill:#4c2c94"/></g>' +
    // Notas adhesivas en la pared
    '<rect x="470" y="960" width="96" height="84" rx="6" transform="rotate(-8 518 1002)" style="fill:#facc15;opacity:.7"/>' +
    '<rect x="580" y="990" width="84" height="76" rx="6" transform="rotate(7 622 1028)" style="fill:#f472b6;opacity:.65"/>' +
    '<g>' + dust + '</g>' +
    '</svg>';
}


// ─── Piezas compartidas por las escenas ───────────────────────────────
var FZ_DEFS = '<defs>' +
  '<linearGradient id="fz-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1760"/><stop offset=".6" stop-color="#1f1147"/><stop offset="1" stop-color="#140b30"/></linearGradient>' +
  '<linearGradient id="fz-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e1b4b"/><stop offset="1" stop-color="#5b21b6"/></linearGradient>' +
  '<radialGradient id="fz-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#8b5cf6" stop-opacity=".6"/><stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/></radialGradient>' +
  '<radialGradient id="fz-pink" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#f472b6" stop-opacity=".5"/><stop offset="1" stop-color="#f472b6" stop-opacity="0"/></radialGradient>' +
  '<radialGradient id="fz-warm" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fbbf24" stop-opacity=".45"/><stop offset="1" stop-color="#fbbf24" stop-opacity="0"/></radialGradient>' +
  '<linearGradient id="fz-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2378"/><stop offset="1" stop-color="#1a0f3a"/></linearGradient>' +
  '</defs>';
function fzOpen() { return '<svg viewBox="0 0 1080 1920" width="1080" height="1920" xmlns="http://www.w3.org/2000/svg" style="position:absolute;inset:0">' + FZ_DEFS; }
function fzDust(color) {
  var out = '';
  for (var j = 0; j < 26; j++) out += '<circle class="fz-dust" data-i="' + j + '" cx="' + ((j * 173) % 1080) + '" cy="' + ((j * 311) % 1920) + '" r="' + (2 + j % 3) + '" style="fill:' + (color || '#c4b5fd') + ';opacity:.35"/>';
  return '<g>' + out + '</g>';
}
function fzStars(x, y, w, h, n) {
  var out = '';
  for (var i = 0; i < n; i++) out += '<circle class="fz-star" data-i="' + i + '" cx="' + (x + (i * 97) % w) + '" cy="' + (y + (i * 61) % h) + '" r="' + (2 + i % 3) + '" style="fill:#fff"/>';
  return out;
}
// Piso o superficie donde se para la Pasita (y = 1556)
function fzFloor(top) { return '<rect x="-20" y="1560" width="1120" height="400" style="fill:url(#fz-floor)"/><rect x="-20" y="1552" width="1120" height="22" rx="8" style="fill:' + (top || '#4c2c94') + '"/>'; }

// ─── Salón de clases: exposiciones, preguntar en clase, exámenes, maestros ───
function _fondoSalon() {
  var chalk = 'font:800 46px Nunito;fill:#e2e8f0;opacity:.4';
  return fzOpen() +
    '<rect width="1080" height="1920" style="fill:url(#fz-wall)"/>' +
    // Pizarrón
    '<rect x="90" y="560" width="900" height="560" rx="18" style="fill:#0f3b33;stroke:#6b4f2a;stroke-width:22"/>' +
    '<text x="170" y="690" style="' + chalk + '">a² + b² = c²</text>' +
    '<text x="620" y="700" style="' + chalk + '">H₂O</text>' +
    '<text x="170" y="820" style="' + chalk + '">1810 → 1821</text>' +
    '<path d="M640 800 q60 -80 120 0 t120 0" style="fill:none;stroke:#e2e8f0;stroke-width:6;opacity:.5;stroke-linecap:round"/>' +
    '<text x="170" y="960" style="' + chalk + ';font-size:40px">Tarea: pág. 42</text>' +
    '<rect x="160" y="1098" width="760" height="18" rx="6" style="fill:#6b4f2a"/><rect x="760" y="1086" width="60" height="14" rx="4" style="fill:#f8fafc;opacity:.8"/>' +
    // Reloj de pared
    '<g transform="translate(900,420)"><circle r="62" style="fill:#f5f3ff;stroke:#4c2c94;stroke-width:12"/><line class="fz-hand" x1="0" y1="0" x2="0" y2="-40" style="stroke:#1e1147;stroke-width:8;stroke-linecap:round"/><line x1="0" y1="0" x2="26" y2="10" style="stroke:#1e1147;stroke-width:8;stroke-linecap:round"/></g>' +
    // Banderines
    '<path d="M60 380 Q300 440 560 380" style="fill:none;stroke:#a78bfa;stroke-width:4;opacity:.6"/>' +
    [0,1,2,3,4].map(function (k) { var x = 100 + k * 95, y = 395 + Math.sin(k) * 10; return '<path d="M' + x + ' ' + y + ' l40 0 l-20 44z" style="fill:' + ['#f472b6','#22d3ee','#facc15','#a78bfa','#34d399'][k] + ';opacity:.7"/>'; }).join('') +
    '<ellipse cx="540" cy="1300" rx="560" ry="400" style="fill:url(#fz-glow)"/>' +
    // Escritorio del maestro con manzana y libros
    fzFloor('#6b4f2a') +
    '<g transform="translate(120,1470)"><circle cx="30" cy="40" r="42" style="fill:#e11d48"/><path d="M30 0 q8 -18 26 -18" style="fill:none;stroke:#16a34a;stroke-width:8;stroke-linecap:round"/></g>' +
    '<g style="opacity:.95">' + _libros(760, 1556, [[250, 56, '#4338ca', 'MATE'], [230, 52, '#0f766e', 'CIENCIAS']]) + '</g>' +
    fzDust('#e2e8f0') + '</svg>';
}

// ─── Recámara de noche: dormir, desvelos, celular antes de dormir, descanso ───
function _fondoRecamara() {
  return fzOpen() +
    '<rect width="1080" height="1920" style="fill:#160c33"/>' +
    '<rect width="1080" height="1920" style="fill:url(#fz-wall);opacity:.7"/>' +
    // Ventana grande con luna llena
    '<g><rect x="120" y="360" width="440" height="520" rx="26" style="fill:url(#fz-sky)"/>' + fzStars(140, 380, 400, 300, 18) +
      '<circle cx="430" cy="480" r="62" style="fill:#fde68a;opacity:.95"/>' +
      '<rect x="120" y="360" width="440" height="520" rx="26" style="fill:none;stroke:#3b2378;stroke-width:18"/>' +
      '<rect x="331" y="360" width="18" height="520" style="fill:#3b2378"/>' +
      '<path d="M100 340 h480 v40 q-120 160 -240 60 q-120 100 -240 -60z" style="fill:#7c3aed;opacity:.6"/></g>' +
    // Guirnalda de luces
    '<path d="M600 300 Q800 380 1060 300" style="fill:none;stroke:#4c2c94;stroke-width:4"/>' +
    [0,1,2,3,4,5].map(function (k) { var x = 630 + k * 75, y = 318 + Math.sin(k * .9) * 22 + (k > 2 ? 10 : 0); return '<circle class="fz-bulb" data-i="' + k + '" cx="' + x + '" cy="' + y + '" r="10" style="fill:' + ['#facc15','#f472b6','#22d3ee'][k % 3] + '"/>'; }).join('') +
    '<ellipse cx="760" cy="1350" rx="420" ry="360" style="fill:url(#fz-glow)"/>' +
    // Cama (derecha) con almohada y cobija
    '<g transform="translate(560,1250)"><rect x="0" y="80" width="560" height="230" rx="30" style="fill:#4c1d95"/>' +
      '<rect x="-10" y="-10" width="40" height="330" rx="14" style="fill:#3b2378"/>' +
      '<rect x="40" y="30" width="200" height="90" rx="40" style="fill:#ede9fe"/>' +
      '<path d="M160 110 h400 v200 h-420 q-20 -120 20 -200z" style="fill:#7c3aed"/>' +
      '<path d="M200 170 h360 M190 230 h370" style="stroke:#a78bfa;stroke-width:6;opacity:.5"/></g>' +
    // Buró con despertador y celular brillando
    '<g transform="translate(60,1360)"><rect width="220" height="200" rx="14" style="fill:#3b2378"/><rect x="20" y="60" width="180" height="10" rx="4" style="fill:#2a1a4d"/>' +
      '<rect x="30" y="-78" width="120" height="78" rx="16" style="fill:#1e1147;stroke:#7c3aed;stroke-width:5"/>' +
      '<text class="fz-clock" x="90" y="-26" text-anchor="middle" style="font:900 38px Nunito;fill:#f472b6">2:47</text>' +
      '<rect x="160" y="-20" width="44" height="20" rx="5" style="fill:#22d3ee;opacity:.9"/></g>' +
    '<ellipse cx="240" cy="1320" rx="130" ry="80" style="fill:url(#fz-pink)"/>' +
    fzFloor('#2a1a4d') +
    '<ellipse cx="420" cy="1640" rx="300" ry="50" style="fill:#7c3aed;opacity:.25"/>' +
    fzDust() + '</svg>';
}

// ─── Mundo de niveles: metas, retos, avanzar poco a poco, rachas, motivación ───
function _fondoNiveles() {
  var coins = [0,1,2,3].map(function (k) { return '<g class="fz-coin" data-i="' + k + '" transform="translate(' + (170 + k * 230) + ',' + (1010 - k * 40) + ')"><circle r="24" style="fill:#fbbf24"/><circle r="14" style="fill:none;stroke:#b45309;stroke-width:5"/></g>'; }).join('');
  function plat(x, y, w, label) {
    return '<g transform="translate(' + x + ',' + y + ')"><rect width="' + w + '" height="60" rx="10" style="fill:#5b3fb0"/><rect width="' + w + '" height="18" rx="8" style="fill:#34d399"/>' +
      '<rect x="0" y="56" width="' + w + '" height="18" rx="6" style="fill:#3b2378"/>' +
      (label ? '<text x="' + (w / 2) + '" y="46" text-anchor="middle" style="font:900 26px Nunito;fill:#ede9fe;letter-spacing:1px">' + label + '</text>' : '') + '</g>';
  }
  return fzOpen() +
    '<rect width="1080" height="1920" style="fill:url(#fz-sky)"/>' + fzStars(0, 200, 1080, 700, 30) +
    // Castillo a lo lejos
    '<g transform="translate(640,760)" style="opacity:.55"><rect x="0" y="120" width="320" height="260" style="fill:#2e1f6b"/>' +
      '<rect x="-30" y="40" width="90" height="340" style="fill:#2e1f6b"/><rect x="260" y="40" width="90" height="340" style="fill:#2e1f6b"/>' +
      [-30,0,30,260,290,320].map(function (x) { return '<rect x="' + x + '" y="20" width="22" height="30" style="fill:#2e1f6b"/>'; }).join('') +
      '<rect x="130" y="250" width="60" height="130" rx="30" style="fill:#1a0f3a"/>' +
      '<path d="M5 40 v-80" style="stroke:#a78bfa;stroke-width:5"/><path class="fz-flag" d="M5 -40 l60 16 l-60 16z" style="fill:#f472b6"/></g>' +
    '<g style="opacity:.35">' + [0,1,2].map(function (k) { return '<ellipse cx="' + (160 + k * 380) + '" cy="' + (560 + k * 60) + '" rx="120" ry="34" style="fill:#c4b5fd"/>'; }).join('') + '</g>' +
    '<ellipse cx="540" cy="1250" rx="560" ry="420" style="fill:url(#fz-glow)"/>' +
    // Plataformas escalonadas y trofeo
    plat(80, 1380, 260, 'NIVEL 1') + plat(420, 1240, 260, 'NIVEL 2') + plat(760, 1100, 260, 'NIVEL 3') +
    '<g transform="translate(890,1000)"><path d="M-40 -60 h80 v30 a40 40 0 0 1 -80 0z" style="fill:#fbbf24"/><rect x="-10" y="10" width="20" height="40" style="fill:#fbbf24"/><rect x="-34" y="46" width="68" height="16" rx="4" style="fill:#b45309"/></g>' +
    '<ellipse cx="890" cy="990" rx="120" ry="100" style="fill:url(#fz-warm)"/>' +
    coins +
    // Piso de bloques
    '<rect x="-20" y="1560" width="1120" height="400" style="fill:#4c2c94"/><rect x="-20" y="1552" width="1120" height="30" style="fill:#34d399"/>' +
    Array.apply(null, Array(12)).map(function (_, k) { return '<rect x="' + (k * 96) + '" y="1600" width="88" height="88" rx="6" style="fill:#3b2378"/>'; }).join('') +
    fzDust('#fde68a') + '</svg>';
}

// ─── Dentro del camión: estudiar en el trayecto, aprovechar tiempos muertos ───
function _fondoCamion() {
  var lights = '';
  for (var k = 0; k < 14; k++) {
    var x = k * 160, h = 120 + (k * 53) % 160;
    lights += '<rect x="' + x + '" y="' + (1080 - h) + '" width="120" height="' + h + '" style="fill:#1e1147"/>' +
      '<rect x="' + (x + 20) + '" y="' + (1080 - h + 24) + '" width="22" height="22" style="fill:#facc15;opacity:.7"/><rect x="' + (x + 70) + '" y="' + (1080 - h + 60) + '" width="22" height="22" style="fill:#f472b6;opacity:.6"/>';
  }
  return fzOpen() +
    '<clipPath id="fz-bus"><rect x="40" y="620" width="1000" height="470" rx="30"/></clipPath>' +
    '<rect width="1080" height="1920" style="fill:#1d1045"/>' +
    // Ventanas con la ciudad pasando
    '<g clip-path="url(#fz-bus)"><rect x="0" y="600" width="1080" height="500" style="fill:url(#fz-sky)"/>' + fzStars(40, 640, 1000, 160, 16) +
      '<g class="fz-city">' + lights + '</g><g class="fz-city" data-off="2240">' + lights + '</g></g>' +
    '<rect x="40" y="620" width="1000" height="470" rx="30" style="fill:none;stroke:#3b2378;stroke-width:22"/>' +
    '<rect x="523" y="620" width="34" height="470" style="fill:#3b2378"/>' +
    // Barra y agarraderas
    '<rect x="0" y="470" width="1080" height="20" rx="8" style="fill:#94a3b8;opacity:.6"/>' +
    [0,1,2,3,4].map(function (k) { var x = 110 + k * 210; return '<g class="fz-strap" data-i="' + k + '" transform="translate(' + x + ',490)"><rect x="-5" y="0" width="10" height="70" style="fill:#64748b"/><circle cy="96" r="30" style="fill:none;stroke:#a78bfa;stroke-width:10"/></g>'; }).join('') +
    '<rect x="1000" y="470" width="20" height="1100" rx="8" style="fill:#fbbf24;opacity:.7"/>' +
    '<ellipse cx="540" cy="1300" rx="560" ry="380" style="fill:url(#fz-glow)"/>' +
    // Asientos
    '<g transform="translate(40,1280)"><rect width="300" height="220" rx="30" style="fill:#be185d"/><rect x="0" y="200" width="320" height="80" rx="20" style="fill:#9d174d"/><path d="M40 40 h220 M40 90 h220" style="stroke:#f472b6;stroke-width:8;opacity:.5"/></g>' +
    '<g transform="translate(740,1280)"><rect width="300" height="220" rx="30" style="fill:#be185d"/><rect x="-20" y="200" width="320" height="80" rx="20" style="fill:#9d174d"/><path d="M40 40 h220 M40 90 h220" style="stroke:#f472b6;stroke-width:8;opacity:.5"/></g>' +
    fzFloor('#334155') +
    '<path d="M0 1700 h1080" style="stroke:#fbbf24;stroke-width:8;stroke-dasharray:40 30;opacity:.4"/>' +
    '</svg>';
}

var FONDOS = { cuarto: _fondoCuarto, salon: _fondoSalon, recamara: _fondoRecamara, niveles: _fondoNiveles, camion: _fondoCamion };

function buildFondo(el, escena, offsetY) {
  escena = escena || 'cuarto';
  el.style.top = (offsetY || 0) + 'px';
  if (escena.indexOf('imagen:') === 0) {
    el.innerHTML = '<img src="../fondos/' + escena.slice(7) + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">';
  } else {
    el.innerHTML = (FONDOS[escena] || _fondoCuarto)();
  }
  // Oscurece arriba (donde va el texto) y deja la escena visible abajo
  el.innerHTML += '<div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(15,10,30,.9) 0%, rgba(15,10,30,.8) 34%, rgba(15,10,30,.3) 58%, rgba(15,10,30,0) 70%, rgba(15,10,30,.35) 100%)"></div>';
}

function animFondo(t) {
  var root = document.querySelector('.fondo');
  if (!root) return;
  root.style.transform = 'scale(' + (1.04 + 0.02 * Math.sin(t * 0.25)) + ')';
  document.querySelectorAll('.fz-star').forEach(function (s) {
    var i = +s.dataset.i; s.style.opacity = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + i));
  });
  document.querySelectorAll('.fz-lava').forEach(function (b) {
    var i = +b.dataset.i; b.setAttribute('cy', (i ? 200 : 80) + Math.sin(t * 0.8 + i * 2) * 60);
  });
  document.querySelectorAll('.fz-city').forEach(function (g) {
    var off = +(g.dataset.off || 0), x = ((off - t * 140) % 4480 + 4480) % 4480 - 2240;
    g.setAttribute('transform', 'translate(' + x + ',0)');
  });
  document.querySelectorAll('.fz-strap').forEach(function (g) {
    var i = +g.dataset.i, x = 110 + i * 210;
    g.setAttribute('transform', 'translate(' + x + ',490) rotate(' + (Math.sin(t * 2.2 + i) * 6) + ')');
  });
  document.querySelectorAll('.fz-coin').forEach(function (c) {
    var i = +c.dataset.i; c.setAttribute('transform', 'translate(' + (170 + i * 230) + ',' + (1010 - i * 40 + Math.sin(t * 2 + i) * 14) + ') scale(' + Math.abs(Math.cos(t * 1.6 + i)) + ',1)');
  });
  document.querySelectorAll('.fz-bulb').forEach(function (b) {
    var i = +b.dataset.i; b.style.opacity = 0.45 + 0.55 * Math.abs(Math.sin(t * 1.1 + i * 1.7));
  });
  document.querySelectorAll('.fz-hand').forEach(function (h) { h.setAttribute('transform', 'rotate(' + (t * 30) + ')'); });
  document.querySelectorAll('.fz-clock').forEach(function (c) { c.textContent = Math.floor(t * 2) % 2 ? '2:47' : '2 47'; });
  document.querySelectorAll('.fz-dust').forEach(function (d) {
    var i = +d.dataset.i, y0 = (i * 311) % 1920;
    d.setAttribute('cy', ((y0 - t * (12 + i % 5 * 4)) % 1920 + 1920) % 1920);
  });
  if (typeof animMaterias === 'function') animMaterias(t);   // escenas de materias.js
}
