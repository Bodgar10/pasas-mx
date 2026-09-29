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

function buildFondo(el, escena, offsetY) {
  escena = escena || 'cuarto';
  el.style.top = (offsetY || 0) + 'px';
  if (escena.indexOf('imagen:') === 0) {
    el.innerHTML = '<img src="../fondos/' + escena.slice(7) + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">';
  } else {
    el.innerHTML = _fondoCuarto();
  }
  // Oscurece arriba (donde va el texto) y deja la escena visible abajo
  el.innerHTML += '<div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(15,10,30,.88) 0%, rgba(15,10,30,.72) 28%, rgba(15,10,30,.25) 55%, rgba(15,10,30,0) 70%, rgba(15,10,30,.35) 100%)"></div>';
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
  document.querySelectorAll('.fz-dust').forEach(function (d) {
    var i = +d.dataset.i, y0 = (i * 311) % 1920;
    d.setAttribute('cy', ((y0 - t * (12 + i % 5 * 4)) % 1920 + 1920) % 1920);
  });
}
