// Identidad visual de cada día del reto diario ("¿Cuál sobra?").
// Calendario (migración 056): lun Historia · mar Biología · mié Geografía ·
// jue Química y Física · vie Español · sáb papás · dom Historia.
//
// Cada materia tiene su escena ilustrada, su color, su ícono y su pose de la
// Pasita, para que el grid y las stories no se vean iguales dos días seguidos.
// Historia sale dos veces por semana: el lunes con la pirámide y el domingo con
// el templo de columnas.
//
// Se carga DESPUÉS de fondo.js (registra escenas nuevas en FONDOS).

// ─── Íconos (viewBox 0 0 100 100) ─────────────────────────────────────
var ICONOS_MATERIA = {
  historia: '<rect x="8" y="78" width="84" height="14" rx="2" style="fill:currentColor"/><rect x="18" y="62" width="64" height="14" rx="2" style="fill:currentColor;opacity:.85"/><rect x="28" y="46" width="44" height="14" rx="2" style="fill:currentColor;opacity:.7"/><rect x="38" y="26" width="24" height="18" rx="2" style="fill:currentColor"/><rect x="45" y="32" width="10" height="12" style="fill:#0f0a1e;opacity:.6"/>',
  historia2: '<path d="M10 30 L50 8 L90 30Z" style="fill:currentColor"/><rect x="10" y="32" width="80" height="8" style="fill:currentColor;opacity:.8"/><rect x="18" y="42" width="10" height="38" style="fill:currentColor"/><rect x="45" y="42" width="10" height="38" style="fill:currentColor"/><rect x="72" y="42" width="10" height="38" style="fill:currentColor"/><rect x="8" y="82" width="84" height="10" rx="2" style="fill:currentColor"/>',
  biologia: '<path d="M30 6 C30 30 70 30 70 50 C70 70 30 70 30 94" style="fill:none;stroke:currentColor;stroke-width:8;stroke-linecap:round"/><path d="M70 6 C70 30 30 30 30 50 C30 70 70 70 70 94" style="fill:none;stroke:currentColor;stroke-width:8;stroke-linecap:round;opacity:.6"/><path d="M38 18 h24 M42 36 h16 M42 64 h16 M38 82 h24" style="stroke:currentColor;stroke-width:6;stroke-linecap:round"/>',
  geografia: '<circle cx="50" cy="50" r="40" style="fill:none;stroke:currentColor;stroke-width:8"/><ellipse cx="50" cy="50" rx="17" ry="40" style="fill:none;stroke:currentColor;stroke-width:6"/><path d="M12 50 h76 M18 30 h64 M18 70 h64" style="stroke:currentColor;stroke-width:6"/>',
  ciencias: '<path d="M38 8 h24 M42 8 v28 L16 84 a6 6 0 0 0 6 8 h56 a6 6 0 0 0 6 -8 L58 36 v-28" style="fill:none;stroke:currentColor;stroke-width:7;stroke-linejoin:round;stroke-linecap:round"/><path d="M26 66 h48 l8 18 h-64z" style="fill:currentColor;opacity:.75"/><circle cx="44" cy="54" r="5" style="fill:currentColor"/><circle cx="56" cy="44" r="3.5" style="fill:currentColor"/>',
  espanol: '<path d="M50 24 C38 14 20 14 6 18 V84 C20 80 38 80 50 90 C62 80 80 80 94 84 V18 C80 14 62 14 50 24Z" style="fill:none;stroke:currentColor;stroke-width:7;stroke-linejoin:round"/><path d="M50 24 V90" style="stroke:currentColor;stroke-width:6"/><path d="M16 36 h24 M16 50 h24 M60 36 h24 M60 50 h24 M60 64 h16" style="stroke:currentColor;stroke-width:5;stroke-linecap:round;opacity:.7"/>',
  papas: '<circle cx="34" cy="22" r="13" style="fill:currentColor"/><path d="M14 92 V58 a20 20 0 0 1 40 0 V92z" style="fill:currentColor"/><circle cx="72" cy="44" r="10" style="fill:currentColor;opacity:.8"/><path d="M58 92 V72 a14 14 0 0 1 28 0 V92z" style="fill:currentColor;opacity:.8"/>',
};
function iconoMateria(key, color, px, extra) {
  return '<svg viewBox="0 0 100 100" width="' + px + '" height="' + px + '" style="color:' + color + ';' + (extra || '') + '">' + (ICONOS_MATERIA[key] || ICONOS_MATERIA.historia) + '</svg>';
}

// ─── Temas ───────────────────────────────────────────────────────────
// c: color principal (brilla sobre fondo oscuro) · sobre: texto encima de c
// fondo: escena · pose: la Pasita en portada y reel
var TEMAS_RETO = {
  historia:  { nombre: 'Historia', lineas: ['Historia'], c: '#a78bfa', sobre: '#1a1035', fondo: 'm-historia', icono: 'historia', pose: 'pensativa',
               tags: '#historia #historiademexico #secundaria #prepa #retodiario' },
  historia2: { nombre: 'Historia', lineas: ['Historia'], c: '#fb923c', sobre: '#1a1035', fondo: 'm-historia2', icono: 'historia2', pose: 'confiada',
               tags: '#historia #historiauniversal #secundaria #prepa #retodiario' },
  biologia:  { nombre: 'Biología', lineas: ['Biología'], c: '#2dd4bf', sobre: '#0f0a1e', fondo: 'm-biologia', icono: 'biologia', pose: 'aprobando',
               tags: '#biologia #ciencia #secundaria #prepa #retodiario' },
  geografia: { nombre: 'Geografía', lineas: ['Geografía'], c: '#38bdf8', sobre: '#0f0a1e', fondo: 'm-geografia', icono: 'geografia', pose: 'celebrando',
               tags: '#geografia #mapas #secundaria #prepa #retodiario' },
  ciencias:  { nombre: 'Química y Física', lineas: ['Química', 'y Física'], c: '#fbbf24', sobre: '#1a1035', fondo: 'm-ciencias', icono: 'ciencias', pose: 'flexionando',
               tags: '#quimica #fisica #ciencia #secundaria #prepa #retodiario' },
  espanol:   { nombre: 'Español', lineas: ['Español'], c: '#f472b6', sobre: '#1a1035', fondo: 'm-espanol', icono: 'espanol', pose: 'lapiz',
               tags: '#espanol #ortografia #lectura #secundaria #prepa #retodiario' },
  papas:     { nombre: 'papás', lineas: ['Papás'], c: '#fde047', sobre: '#1a1035', fondo: 'm-papas', icono: 'papas', pose: 'celebrando',
               tags: '#papas #mamas #secundaria #tareas #retodiario' },
};
var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
var MATERIA_DEL_DIA = ['historia', 'historia', 'biologia', 'geografia', 'ciencias', 'espanol', 'papas'];

// El tema del reto: la materia real (data.materia_key) manda; si no viene
// (datos de ejemplo), sale del calendario. El domingo de historia usa la variante 2.
function temaReto(data) {
  var dia = new Date((data.fecha || '2026-10-05') + 'T12:00:00Z').getUTCDay();
  var key = data.materia_key || MATERIA_DEL_DIA[dia];
  var variante = key === 'historia' && dia === 0 ? 'historia2' : key;
  var t = Object.assign({}, TEMAS_RETO[variante] || TEMAS_RETO.historia);
  t.key = key; t.variante = variante; t.dia = DIAS[dia];
  t.esPapas = key === 'papas';
  // "Viernes de" / "Español" · "Reto para" / "Papás"
  t.arriba = t.esPapas ? 'Reto para' : DIAS[dia].charAt(0).toUpperCase() + DIAS[dia].slice(1) + ' de';
  return t;
}
function nombreMateriaRonda(key) {
  var t = TEMAS_RETO[key];
  return t && key !== 'papas' ? t.nombre : '';
}

// ─── Escenas (1080×1920, piso en y = 1556, arriba se oscurece sola) ───
function fzFloat(inner, x, y, i, amp) {
  return '<g class="fz-float" data-x="' + x + '" data-y="' + y + '" data-i="' + i + '" data-a="' + (amp || 14) + '" transform="translate(' + x + ',' + y + ')">' + inner + '</g>';
}
function fzIcon(key, color, px, op) {
  return '<g style="color:' + color + ';opacity:' + (op || 1) + '"><svg x="' + (-px / 2) + '" y="' + (-px / 2) + '" width="' + px + '" height="' + px + '" viewBox="0 0 100 100">' + ICONOS_MATERIA[key] + '</svg></g>';
}
function fzGrad(id, a, b, c) {
  return '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset=".55" stop-color="' + b + '"/><stop offset="1" stop-color="' + c + '"/></linearGradient></defs>';
}
function fzRadial(id, color, op) {
  return '<defs><radialGradient id="' + id + '" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="' + color + '" stop-opacity="' + op + '"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></radialGradient></defs>';
}

// Lunes · Historia: pirámide mesoamericana de noche
function _fondoMHistoria() {
  var steps = '';
  for (var k = 0; k < 5; k++) {
    var w = 860 - k * 150, y = 1250 - (k + 1) * 74;
    steps += '<rect x="' + (540 - w / 2) + '" y="' + y + '" width="' + w + '" height="74" style="fill:' + (k % 2 ? '#4c2c94' : '#5b3fb0') + '"/>' +
      '<rect x="' + (540 - w / 2) + '" y="' + y + '" width="' + w + '" height="10" style="fill:#7c5cd6;opacity:.6"/>';
  }
  var stair = '';
  for (var s = 0; s < 18; s++) stair += '<rect x="485" y="' + (880 + s * 20.5) + '" width="110" height="7" style="fill:#2a1a5e;opacity:.55"/>';
  var bush = [[60, 1250, 150], [210, 1270, 110], [900, 1250, 160], [1040, 1270, 120]].map(function (b) {
    return '<ellipse cx="' + b[0] + '" cy="' + b[1] + '" rx="' + b[2] + '" ry="' + (b[2] * .7) + '" style="fill:#14532d;opacity:.8"/>';
  }).join('');
  return fzOpen() + fzGrad('mh-sky', '#140b30', '#3b1d7a', '#6d28d9') + fzRadial('mh-moon', '#fde68a', .55) +
    '<rect width="1080" height="1920" style="fill:url(#mh-sky)"/>' + fzStars(0, 120, 1080, 700, 34) +
    '<circle cx="780" cy="700" r="300" style="fill:url(#mh-moon)"/><circle cx="780" cy="700" r="92" style="fill:#fef3c7;opacity:.95"/>' +
    '<path d="M0 1120 Q200 1040 380 1110 T760 1090 T1080 1110 V1300 H0Z" style="fill:#1e1147"/>' +
    steps + '<rect x="485" y="880" width="110" height="370" style="fill:#6d4fc4"/>' + stair +
    // Templo en la cima
    '<rect x="420" y="770" width="240" height="110" style="fill:#5b3fb0"/><rect x="408" y="752" width="264" height="26" style="fill:#7c5cd6"/>' +
    '<rect x="510" y="800" width="60" height="80" rx="4" style="fill:#140b30"/>' +
    [0, 1, 2, 3, 4, 5].map(function (k) { return '<rect x="' + (430 + k * 38) + '" y="736" width="22" height="16" style="fill:#7c5cd6"/>'; }).join('') +
    bush + fzFloor('#6b5b95') +
    '<path d="M0 1640 h1080 M0 1740 h1080 M180 1574 v66 M520 1574 v66 M860 1574 v66 M340 1640 v100 M700 1640 v100" style="stroke:#2a1a5e;stroke-width:6;opacity:.6"/>' +
    // Vasija y códice
    '<g transform="translate(150,1440)"><path d="M-50 0 q-30 60 10 112 h80 q40 -52 10 -112z" style="fill:#c2410c"/><rect x="-44" y="-14" width="88" height="20" rx="6" style="fill:#9a3412"/>' +
      '<path d="M-58 50 h116" style="stroke:#fde68a;stroke-width:8;stroke-dasharray:14 10"/></g>' +
    '<g transform="translate(860,1490) rotate(-6)"><rect width="190" height="64" rx="8" style="fill:#fde68a"/>' +
      [0, 1, 2, 3].map(function (k) { return '<rect x="' + (14 + k * 44) + '" y="14" width="34" height="34" rx="4" style="fill:' + ['#dc2626', '#0d9488', '#1d4ed8', '#c2410c'][k] + ';opacity:.75"/>'; }).join('') + '</g>' +
    fzDust('#fde68a') + '</svg>';
}

// Domingo · Historia: templo de columnas al atardecer
function _fondoMHistoria2() {
  var cols = [0, 1, 2, 3, 4].map(function (k) {
    var x = 250 + k * 145;
    return '<rect x="' + x + '" y="900" width="70" height="380" style="fill:#e9d5ff"/>' +
      '<rect x="' + (x + 14) + '" y="900" width="10" height="380" style="fill:#c4b5fd;opacity:.8"/><rect x="' + (x + 44) + '" y="900" width="10" height="380" style="fill:#c4b5fd;opacity:.8"/>' +
      '<rect x="' + (x - 10) + '" y="884" width="90" height="22" rx="4" style="fill:#f5f3ff"/><rect x="' + (x - 10) + '" y="1272" width="90" height="22" rx="4" style="fill:#f5f3ff"/>';
  }).join('');
  return fzOpen() + fzGrad('mh2-sky', '#1e1147', '#7c2d92', '#f97316') + fzRadial('mh2-sun', '#fdba74', .7) +
    '<rect width="1080" height="1920" style="fill:url(#mh2-sky)"/>' + fzStars(0, 100, 1080, 500, 20) +
    '<circle cx="540" cy="1200" r="460" style="fill:url(#mh2-sun)"/><circle cx="540" cy="1230" r="170" style="fill:#fed7aa;opacity:.8"/>' +
    '<path d="M0 1250 Q270 1180 540 1240 T1080 1220 V1320 H0Z" style="fill:#4c1d95;opacity:.8"/>' +
    '<g style="opacity:.95"><path d="M200 860 L540 720 L880 860Z" style="fill:#f5f3ff"/><path d="M290 840 L540 740 L790 840Z" style="fill:#ddd6fe"/>' +
    '<rect x="200" y="858" width="680" height="30" style="fill:#ede9fe"/>' + cols +
    '<rect x="170" y="1292" width="740" height="30" style="fill:#ddd6fe"/><rect x="140" y="1320" width="800" height="30" style="fill:#c4b5fd"/></g>' +
    fzFloor('#a16207') +
    '<path d="M0 1620 h1080" style="stroke:#713f12;stroke-width:6;opacity:.5"/>' +
    // Reloj de arena y ánfora
    '<g transform="translate(140,1400)"><rect x="-60" y="0" width="120" height="16" rx="6" style="fill:#92400e"/><rect x="-60" y="140" width="120" height="16" rx="6" style="fill:#92400e"/>' +
      '<path d="M-44 16 h88 q0 50 -38 62 q38 12 38 62 h-88 q0 -50 38 -62 q-38 -12 -38 -62z" style="fill:#e0f2fe;opacity:.5;stroke:#fde68a;stroke-width:5"/>' +
      '<path d="M-26 128 q26 -30 52 0 v12 h-52z" style="fill:#fbbf24"/><path d="M-20 40 h40 q-6 22 -20 30 q-14 -8 -20 -30z" style="fill:#fbbf24"/></g>' +
    '<g transform="translate(930,1400)"><path d="M-34 0 h68 v18 q46 30 30 90 q-20 46 -64 48 q-44 -2 -64 -48 q-16 -60 30 -90z" style="fill:#c2410c"/>' +
      '<path d="M-58 70 h116" style="stroke:#1a1035;stroke-width:10;opacity:.5"/><path d="M-36 20 q-40 10 -40 40 M36 20 q40 10 40 40" style="fill:none;stroke:#9a3412;stroke-width:10"/></g>' +
    fzDust('#fed7aa') + '</svg>';
}

// Martes · Biología: ADN, células y hojas
function _fondoMBiologia() {
  var rungs = '';
  for (var k = 0; k < 20; k++) {
    rungs += '<g class="fz-rung" data-k="' + k + '" data-cx="850" data-y="' + (420 + k * 54) + '" data-a="110">' +
      '<line style="stroke:#a78bfa;stroke-width:8;opacity:.7"/><circle r="17" style="fill:#2dd4bf"/><circle r="17" style="fill:#f472b6"/></g>';
  }
  var cells = [[150, 760, 66], [330, 980, 42], [110, 1130, 50], [620, 690, 36], [480, 1180, 30]].map(function (c, i) {
    return fzFloat('<circle r="' + c[2] + '" style="fill:#2dd4bf;opacity:.18;stroke:#5eead4;stroke-width:5"/><circle cx="' + (c[2] * .2) + '" cy="' + (-c[2] * .15) + '" r="' + (c[2] * .38) + '" style="fill:#a78bfa;opacity:.8"/>', c[0], c[1], i, 18);
  }).join('');
  function hoja(x, y, r, s, col) {
    return '<g transform="translate(' + x + ',' + y + ') rotate(' + r + ') scale(' + s + ')"><path d="M0 0 C60 -120 220 -130 300 -40 C220 40 80 60 0 0Z" style="fill:' + col + '"/><path d="M0 0 C100 -40 200 -50 300 -40" style="fill:none;stroke:#0f2a2a;stroke-width:6;opacity:.5"/></g>';
  }
  return fzOpen() + fzGrad('mb-bg', '#0b1f33', '#0f3b45', '#1a1446') + fzRadial('mb-glow', '#2dd4bf', .35) +
    '<rect width="1080" height="1920" style="fill:url(#mb-bg)"/>' +
    '<ellipse cx="760" cy="1000" rx="420" ry="620" style="fill:url(#mb-glow)"/>' +
    '<g style="opacity:.08">' + Array.apply(null, Array(9)).map(function (_, k) { return '<circle cx="' + ((k * 263) % 1080) + '" cy="' + (300 + (k * 197) % 1200) + '" r="' + (60 + k * 9) + '" style="fill:none;stroke:#5eead4;stroke-width:4"/>'; }).join('') + '</g>' +
    rungs + cells +
    hoja(-60, 1380, -30, 1.1, '#0f766e') + hoja(-40, 1500, -5, .9, '#115e59') + hoja(1140, 1420, 200, 1.0, '#0d9488') +
    fzFloor('#115e59') +
    // Microscopio y maceta
    '<g transform="translate(170,1556)"><rect x="-80" y="-24" width="160" height="24" rx="8" style="fill:#e2e8f0"/><path d="M30 -24 q40 -90 0 -170" style="fill:none;stroke:#94a3b8;stroke-width:26;stroke-linecap:round"/>' +
      '<rect x="-30" y="-110" width="80" height="14" rx="5" style="fill:#64748b"/>' +
      '<g transform="rotate(-24 0 -190)"><rect x="-22" y="-260" width="44" height="130" rx="10" style="fill:#e2e8f0"/><rect x="-28" y="-272" width="56" height="22" rx="6" style="fill:#2dd4bf"/><rect x="-14" y="-140" width="28" height="30" rx="4" style="fill:#475569"/></g></g>' +
    '<g transform="translate(960,1556)"><path d="M-60 -100 h120 l-14 100 h-92z" style="fill:#c2410c"/><rect x="-66" y="-112" width="132" height="22" rx="6" style="fill:#9a3412"/>' +
      '<path d="M0 -110 q-10 -90 -70 -130 M0 -110 q10 -100 60 -150 M0 -110 q0 -80 0 -170" style="fill:none;stroke:#22c55e;stroke-width:10;stroke-linecap:round"/>' +
      '<ellipse cx="-70" cy="-240" rx="34" ry="16" style="fill:#22c55e"/><ellipse cx="60" cy="-260" rx="34" ry="16" style="fill:#16a34a"/><ellipse cx="0" cy="-286" rx="18" ry="34" style="fill:#4ade80"/></g>' +
    fzDust('#99f6e4') + '</svg>';
}

// Miércoles · Geografía: globo terráqueo, montañas y mapa
function _fondoMGeografia() {
  var mer = '';
  for (var k = 0; k < 6; k++) mer += '<ellipse class="fz-mer" data-k="' + k + '" cx="0" cy="0" rx="180" ry="180" style="fill:none;stroke:#e0f2fe;stroke-width:4;opacity:.45"/>';
  var pins = [[820, 980], [960, 1150], [700, 1180]].map(function (p, i) {
    return fzFloat('<path d="M0 0 C-36 -40 -36 -90 0 -90 C36 -90 36 -40 0 0Z" style="fill:' + ['#f43f5e', '#fbbf24', '#a78bfa'][i] + '"/><circle cy="-60" r="12" style="fill:#fff"/>', p[0], p[1], i, 12);
  }).join('');
  return fzOpen() + fzGrad('mg-sky', '#0b1640', '#1e3a8a', '#312e81') + fzRadial('mg-glow', '#38bdf8', .35) +
    '<clipPath id="mg-globe"><circle cx="0" cy="0" r="180"/></clipPath>' +
    '<rect width="1080" height="1920" style="fill:url(#mg-sky)"/>' + fzStars(0, 100, 1080, 600, 24) +
    // Rosa de los vientos
    '<g transform="translate(880,720)" style="opacity:.35"><g class="fz-spin" data-v="6"><path d="M0 -130 L18 -18 L130 0 L18 18 L0 130 L-18 18 L-130 0 L-18 -18Z" style="fill:#bae6fd"/><circle r="36" style="fill:none;stroke:#bae6fd;stroke-width:6"/></g></g>' +
    // Montañas
    '<path d="M-40 1330 L180 1010 L330 1180 L520 940 L720 1200 L860 1060 L1120 1330Z" style="fill:#3730a3"/>' +
    '<path d="M180 1010 L230 1082 L200 1070 L170 1094 L140 1068Z M520 940 L580 1028 L540 1012 L510 1040 L470 1010Z M860 1060 L905 1124 L870 1112 L840 1130Z" style="fill:#e0f2fe"/>' +
    '<path d="M-40 1380 Q300 1290 540 1360 T1120 1340 V1600 H-40Z" style="fill:#155e75"/>' +
    '<ellipse cx="300" cy="1250" rx="360" ry="320" style="fill:url(#mg-glow)"/>' +
    // Ruta punteada
    '<path d="M120 900 Q420 760 700 940" style="fill:none;stroke:#fde68a;stroke-width:6;stroke-dasharray:18 16;opacity:.6"/>' +
    // Globo en su base
    '<g transform="translate(270,1270)"><circle r="180" style="fill:#0284c7"/>' +
      '<g clip-path="url(#mg-globe)"><g class="fz-land"><path d="M-150 -90 q60 -50 120 -10 q30 40 -10 70 q-40 10 -60 60 q-40 10 -60 -40z M40 -130 q70 -10 110 40 q-20 50 -70 40 q-50 -30 -40 -80z M20 40 q50 -10 80 30 q0 60 -50 90 q-40 -20 -30 -120z" style="fill:#34d399"/>' +
      '<path d="M-510 -90 q60 -50 120 -10 q30 40 -10 70 q-40 10 -60 60 q-40 10 -60 -40z M-320 -130 q70 -10 110 40 q-20 50 -70 40 q-50 -30 -40 -80z M-340 40 q50 -10 80 30 q0 60 -50 90 q-40 -20 -30 -120z" style="fill:#34d399"/></g></g>' +
      mer + '<path d="M-180 0 h360" style="stroke:#e0f2fe;stroke-width:4;opacity:.5"/>' +
      '<circle r="180" style="fill:none;stroke:#0c4a6e;stroke-width:8"/>' +
      '<path d="M-205 40 A210 210 0 0 0 150 160" style="fill:none;stroke:#a78bfa;stroke-width:14;stroke-linecap:round"/>' +
      '<rect x="-14" y="180" width="28" height="80" style="fill:#7c3aed"/><rect x="-90" y="260" width="180" height="26" rx="10" style="fill:#a78bfa"/></g>' +
    pins + fzFloor('#0369a1') +
    // Mapa doblado
    '<g transform="translate(880,1500) rotate(-4)"><path d="M-110 0 L-40 -20 L40 0 L110 -20 V60 L40 80 L-40 60 L-110 80Z" style="fill:#fef3c7"/>' +
      '<path d="M-40 -20 V60 M40 0 V80" style="stroke:#d6b97a;stroke-width:4"/><path d="M-90 40 q40 -40 80 -10 t80 -10" style="fill:none;stroke:#dc2626;stroke-width:5;stroke-dasharray:10 8"/></g>' +
    fzDust('#bae6fd') + '</svg>';
}

// Jueves · Química y Física: laboratorio con átomo y matraces
function _fondoMCiencias() {
  var orb = [0, 60, 120].map(function (r, i) {
    return '<ellipse rx="190" ry="66" transform="rotate(' + r + ')" style="fill:none;stroke:#fde68a;stroke-width:6;opacity:.75"/>' +
      '<circle class="fz-orb" data-i="' + i + '" data-r="' + r + '" r="15" style="fill:#22d3ee"/>';
  }).join('');
  var bubbles = '';
  for (var b = 0; b < 8; b++) bubbles += '<circle class="fz-rise" data-i="' + b + '" data-x="' + (150 + (b % 3) * 22 - 22) + '" data-y="1380" data-h="260" r="' + (8 + b % 3 * 4) + '" style="fill:#86efac;opacity:.8"/>';
  function matraz(x, y, s, col) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')"><path d="M-16 -110 h32 v40 l46 86 a10 10 0 0 1 -9 14 h-106 a10 10 0 0 1 -9 -14 l46 -86z" style="fill:#e0f2fe;opacity:.25;stroke:#e0f2fe;stroke-width:5"/>' +
      '<path d="M-36 -26 h72 l22 40 a8 8 0 0 1 -7 12 h-102 a8 8 0 0 1 -7 -12z" style="fill:' + col + ';opacity:.9"/></g>';
  }
  function tubo(x, col, h) {
    return '<g transform="translate(' + x + ',1030)"><rect x="-14" y="-150" width="28" height="150" rx="14" style="fill:#e0f2fe;opacity:.25;stroke:#e0f2fe;stroke-width:4"/><rect x="-11" y="' + (-h) + '" width="22" height="' + (h - 3) + '" rx="11" style="fill:' + col + '"/></g>';
  }
  function elem(x, y, sim, n, col) {
    return '<g transform="translate(' + x + ',' + y + ')"><rect width="110" height="120" rx="12" style="fill:' + col + ';opacity:.85"/><text x="12" y="34" style="font:800 24px Nunito;fill:#fff;opacity:.85">' + n + '</text>' +
      '<text x="55" y="96" text-anchor="middle" style="font:900 56px Nunito;fill:#fff">' + sim + '</text></g>';
  }
  return fzOpen() + fzGrad('mc-bg', '#140b30', '#24164f', '#1a1035') + fzRadial('mc-glow', '#fbbf24', .4) +
    '<rect width="1080" height="1920" style="fill:url(#mc-bg)"/>' +
    '<g style="opacity:.07">' + Array.apply(null, Array(12)).map(function (_, k) { return '<path d="M' + (k * 96) + ' 0 V1920 M0 ' + (k * 160) + ' H1080" style="stroke:#fff;stroke-width:3"/>'; }).join('') + '</g>' +
    // Repisa con tubos de ensayo
    '<rect x="40" y="1030" width="420" height="20" rx="6" style="fill:#3b2378"/>' + tubo(90, '#f472b6', 90) + tubo(150, '#22d3ee', 60) + tubo(210, '#fbbf24', 110) +
    matraz(330, 1030, 1, '#a78bfa') +
    // Elementos de la tabla periódica
    elem(70, 760, 'H', 1, '#0e7490') + elem(196, 760, 'O', 8, '#be185d') + elem(322, 760, 'Fe', 26, '#a16207') +
    // Átomo
    '<ellipse cx="800" cy="1130" rx="330" ry="330" style="fill:url(#mc-glow)"/>' +
    '<g transform="translate(800,1130)"><g class="fz-spin" data-v="10">' + orb + '</g><circle r="34" style="fill:#fbbf24"/><circle cx="-10" cy="-8" r="12" style="fill:#fde68a"/></g>' +
    // Rayo
    '<path d="M980 760 l-60 110 h46 l-40 100 l100 -130 h-50 l40 -80z" style="fill:#fde047;opacity:.7"/>' +
    fzFloor('#475569') +
    matraz(150, 1556, 1.4, '#22c55e') + bubbles +
    // Imán
    '<g transform="translate(930,1556)"><path d="M-70 0 v-90 a70 70 0 0 1 140 0 v90 h-44 v-90 a26 26 0 0 0 -52 0 v90z" style="fill:#ef4444"/>' +
      '<rect x="-70" y="-30" width="44" height="30" style="fill:#e2e8f0"/><rect x="26" y="-30" width="44" height="30" style="fill:#e2e8f0"/></g>' +
    fzDust('#fde68a') + '</svg>';
}

// Viernes · Español: libro abierto y letras flotando
function _fondoMEspanol() {
  var lines = '';
  for (var k = 0; k < 8; k++) lines += '<path d="M' + (300) + ' ' + (1090 + k * 34) + ' h200 M580 ' + (1090 + k * 34) + ' h200" style="stroke:#c4b5fd;stroke-width:8;stroke-linecap:round;opacity:.6"/>';
  var letras = [['Ñ', 150, 820, 150, '#f472b6'], ['¿?', 900, 860, 120, '#22d3ee'], ['á', 110, 1150, 120, '#fbbf24'], ['“ ”', 960, 1110, 120, '#a78bfa'],
    ['A', 300, 930, 96, '#5eead4'], ['é', 760, 940, 96, '#f9a8d4'], ['Z', 960, 1330, 90, '#fde68a']].map(function (l, i) {
    return fzFloat('<text text-anchor="middle" style="font:900 ' + l[3] + 'px Nunito;fill:' + l[4] + ';opacity:.9">' + l[0] + '</text>', l[1], l[2], i, 16);
  }).join('');
  return fzOpen() + fzGrad('me-bg', '#1a0f3a', '#3b0f3a', '#1a1035') + fzRadial('me-glow', '#f472b6', .4) +
    '<rect width="1080" height="1920" style="fill:url(#me-bg)"/>' +
    '<g style="opacity:.5">' + _estante(20, 700, 360) + _estante(700, 700, 360) + '</g>' +
    '<ellipse cx="540" cy="1200" rx="520" ry="380" style="fill:url(#me-glow)"/>' +
    // Libro abierto
    '<g><path d="M540 1030 C440 980 320 980 240 1000 V1420 C320 1400 440 1400 540 1450Z" style="fill:#fdf4ff"/>' +
    '<path d="M540 1030 C640 980 760 980 840 1000 V1420 C760 1400 640 1400 540 1450Z" style="fill:#f5f3ff"/>' +
    '<path d="M240 1420 C320 1400 440 1400 540 1450 C640 1400 760 1400 840 1420 V1450 C760 1430 640 1430 540 1480 C440 1430 320 1430 240 1450Z" style="fill:#be185d"/>' +
    '<path d="M540 1030 V1450" style="stroke:#d8b4fe;stroke-width:6"/>' + lines + '</g>' +
    letras + fzFloor('#9d174d') +
    '<g style="opacity:.95">' + _libros(70, 1556, [[260, 54, '#be185d', 'CUENTOS'], [230, 50, '#4338ca', 'POEMAS'], [250, 46, '#0f766e', 'RAE']]) + '</g>' +
    // Lápiz
    '<g transform="translate(840,1530) rotate(-14)"><rect width="190" height="28" rx="4" style="fill:#fbbf24"/><rect x="-22" width="26" height="28" rx="6" style="fill:#f472b6"/><path d="M190 0 l36 14 l-36 14z" style="fill:#fde68a"/><path d="M216 10 l10 4 l-10 4z" style="fill:#1a1035"/></g>' +
    fzDust('#fbcfe8') + '</svg>';
}

// Sábado · papás: sala de la casa, con una materia de cada lado
function _fondoMPapas() {
  var iconos = [['historia', '#a78bfa'], ['biologia', '#2dd4bf'], ['geografia', '#38bdf8'], ['ciencias', '#fbbf24'], ['espanol', '#f472b6']].map(function (c, i) {
    var x = 140 + i * 200, y = 880 + (i % 2) * 70;
    return fzFloat('<circle r="74" style="fill:#1a1035;opacity:.75;stroke:' + c[1] + ';stroke-width:6"/>' + fzIcon(c[0], c[1], 84), x, y, i, 14);
  }).join('');
  function cuadro(x, y, w, h, col) {
    return '<g transform="translate(' + x + ',' + y + ')"><rect width="' + w + '" height="' + h + '" rx="6" style="fill:#fde68a"/><rect x="12" y="12" width="' + (w - 24) + '" height="' + (h - 24) + '" style="fill:' + col + '"/>' +
      '<circle cx="' + (w * .38) + '" cy="' + (h * .45) + '" r="' + (h * .14) + '" style="fill:#fde68a;opacity:.85"/><circle cx="' + (w * .62) + '" cy="' + (h * .55) + '" r="' + (h * .1) + '" style="fill:#fde68a;opacity:.85"/>' +
      '<path d="M' + (w * .2) + ' ' + (h - 12) + ' q' + (w * .18) + ' -' + (h * .35) + ' ' + (w * .36) + ' 0 M' + (w * .5) + ' ' + (h - 12) + ' q' + (w * .12) + ' -' + (h * .25) + ' ' + (w * .24) + ' 0" style="fill:#fde68a;opacity:.85"/></g>';
  }
  return fzOpen() + fzGrad('mp-bg', '#1e1147', '#3b1f6b', '#2a1446') + fzRadial('mp-lamp', '#fde047', .5) +
    '<rect width="1080" height="1920" style="fill:url(#mp-bg)"/>' +
    '<g style="opacity:.07">' + Array.apply(null, Array(14)).map(function (_, k) { return '<rect x="' + (k * 80) + '" y="0" width="36" height="1920" style="fill:#fff"/>'; }).join('') + '</g>' +
    cuadro(110, 1040, 170, 130, '#7c3aed') + cuadro(800, 1020, 150, 180, '#be185d') +
    iconos +
    '<ellipse cx="120" cy="1150" rx="300" ry="300" style="fill:url(#mp-lamp)"/>' +
    // Sofá
    '<g transform="translate(200,1250)"><rect x="0" y="0" width="680" height="200" rx="50" style="fill:#6d28d9"/>' +
      '<rect x="-40" y="90" width="110" height="220" rx="40" style="fill:#5b21b6"/><rect x="610" y="90" width="110" height="220" rx="40" style="fill:#5b21b6"/>' +
      '<rect x="60" y="150" width="270" height="140" rx="30" style="fill:#7c3aed"/><rect x="350" y="150" width="270" height="140" rx="30" style="fill:#7c3aed"/>' +
      '<rect x="80" y="40" width="130" height="110" rx="26" style="fill:#f472b6;transform:rotate(-8deg);transform-origin:145px 95px"/></g>' +
    // Lámpara de pie
    '<g transform="translate(90,1556)"><rect x="-6" y="-420" width="12" height="420" style="fill:#94a3b8"/><rect x="-50" y="-12" width="100" height="12" rx="6" style="fill:#94a3b8"/>' +
      '<path d="M-70 -400 h140 l-30 -110 h-80z" style="fill:#fde047"/></g>' +
    fzFloor('#92400e') +
    '<path d="M0 1640 h1080 M0 1740 h1080" style="stroke:#78350f;stroke-width:6;opacity:.6"/>' +
    // Mesita con taza y cuaderno
    '<g transform="translate(900,1556)"><rect x="-130" y="-110" width="260" height="22" rx="8" style="fill:#b45309"/><rect x="-110" y="-90" width="20" height="90" style="fill:#92400e"/><rect x="90" y="-90" width="20" height="90" style="fill:#92400e"/>' +
      '<rect x="-100" y="-150" width="110" height="40" rx="4" style="fill:#22d3ee"/><rect x="-100" y="-150" width="110" height="10" style="fill:#0e7490"/>' +
      '<rect x="40" y="-170" width="50" height="60" rx="8" style="fill:#f5f3ff"/><path d="M90 -158 q24 6 0 30" style="fill:none;stroke:#f5f3ff;stroke-width:8"/>' +
      '<path class="fz-steam" d="M54 -186 q-10 -16 0 -32 M74 -186 q-10 -16 0 -32" style="fill:none;stroke:#fff;stroke-width:5;stroke-linecap:round;opacity:.5"/></g>' +
    fzDust('#fde68a') + '</svg>';
}

FONDOS['m-historia'] = _fondoMHistoria;
FONDOS['m-historia2'] = _fondoMHistoria2;
FONDOS['m-biologia'] = _fondoMBiologia;
FONDOS['m-geografia'] = _fondoMGeografia;
FONDOS['m-ciencias'] = _fondoMCiencias;
FONDOS['m-espanol'] = _fondoMEspanol;
FONDOS['m-papas'] = _fondoMPapas;

// Movimiento de las escenas de materias (se llama desde animFondo)
function animMaterias(t) {
  document.querySelectorAll('.fz-float').forEach(function (g) {
    var i = +g.dataset.i, a = +g.dataset.a;
    g.setAttribute('transform', 'translate(' + g.dataset.x + ',' + (+g.dataset.y + Math.sin(t * 1.4 + i * 1.3) * a) + ') rotate(' + (Math.sin(t * 0.9 + i) * 4) + ')');
  });
  document.querySelectorAll('.fz-spin').forEach(function (g) { g.setAttribute('transform', 'rotate(' + (t * +g.dataset.v) + ')'); });
  document.querySelectorAll('.fz-rung').forEach(function (g) {
    var k = +g.dataset.k, cx = +g.dataset.cx, y = +g.dataset.y, a = +g.dataset.a, ph = t * 1.6 + k * 0.42;
    var x1 = cx + a * Math.sin(ph), x2 = cx - a * Math.sin(ph), front = Math.cos(ph) > 0;
    var l = g.children[0], c1 = g.children[1], c2 = g.children[2];
    l.setAttribute('x1', x1); l.setAttribute('x2', x2); l.setAttribute('y1', y); l.setAttribute('y2', y);
    c1.setAttribute('cx', x1); c1.setAttribute('cy', y); c2.setAttribute('cx', x2); c2.setAttribute('cy', y);
    c1.setAttribute('r', front ? 19 : 13); c2.setAttribute('r', front ? 13 : 19);
  });
  document.querySelectorAll('.fz-mer').forEach(function (e) {
    var k = +e.dataset.k; e.setAttribute('rx', Math.abs(180 * Math.cos(t * 0.5 + k * Math.PI / 6)));
  });
  document.querySelectorAll('.fz-land').forEach(function (g) {
    var x = ((t * 26) % 360); g.setAttribute('transform', 'translate(' + x + ',0)');
  });
  document.querySelectorAll('.fz-orb').forEach(function (c) {
    var i = +c.dataset.i, r = +c.dataset.r * Math.PI / 180, a = t * 2.4 + i * 2.1;
    var x = 190 * Math.cos(a), y = 66 * Math.sin(a);
    c.setAttribute('cx', x * Math.cos(r) - y * Math.sin(r)); c.setAttribute('cy', x * Math.sin(r) + y * Math.cos(r));
  });
  document.querySelectorAll('.fz-rise').forEach(function (c) {
    var i = +c.dataset.i, h = +c.dataset.h, p = ((t * 0.5 + i / 8) % 1);
    c.setAttribute('cx', +c.dataset.x + Math.sin(t * 3 + i) * 6); c.setAttribute('cy', +c.dataset.y - p * h);
    c.style.opacity = 0.85 * (1 - p);
  });
  document.querySelectorAll('.fz-steam').forEach(function (s) { s.style.opacity = 0.25 + 0.3 * Math.abs(Math.sin(t * 1.2)); });
}
