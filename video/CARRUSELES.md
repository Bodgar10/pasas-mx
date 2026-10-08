# Carruseles "con hobby"

Un tema real de PASAS explicado a fondo con **un** hobby, en láminas 1080×1350
para Instagram (carrusel) y TikTok (modo foto). La idea: que alguien que no
entiende sin analogías diga "wow, ya entendí", lo guarde para su examen y vea
que en PASAS todo se aprende así.

```bash
cd video
node src/carrusel.mjs --data data/carruseles/AAAA-MM-tema-hobby.json            # PNG para revisar
```

Al hacer push a `main` de un JSON nuevo en `data/carruseles/` (que no empiece con
`ejemplo-`), el workflow **Carruseles de PASAS** genera las láminas y las manda
por correo con el texto para publicar. No hay que hacer nada más.

## De dónde sale el contenido

De la lección real en Supabase (proyecto `uxtmdhbqiphvmixtxlox`), nunca inventado:

```sql
-- Lecciones con su analogía por temática
select t.slug, t.name, s.slug materia, th.name tema, se.type, se.title, se.content, se.data
from sections se
join topics t on t.id = se.topic_id
join subjects s on s.id = t.subject_id
join themes th on th.id = se.theme_id
where se.user_id is null and t.published
  and t.slug = '<slug>' and th.name = '<Videojuegos | Anime & Manga | K-pop & K-dramas | Fútbol>'
  and se.type::text in ('analogy','explanation','example','key_fact','tip','steps','solve')
order by se.display_order;
```

La analogía (`analogy`) es el corazón: de ahí salen la situación, los números y
los nombres. `explanation`, `example`, `key_fact` y `tip` dan el concepto, el
ejemplo resuelto y la regla para el examen. **Revisa cada cuenta y cada dato
histórico antes de publicar**; si la lección trae un error, corrígelo en el
carrusel y avísalo en el resumen para que se arregle en la base.

## Cómo elegir el tema

- Rota materia y hobby: no repitas materia ni hobby de los últimos 3 carruseles
  (mira los nombres de archivo en `data/carruseles/`). Nunca repitas un tema.
- Prefiere temas que estén viendo en clase este mes (calendario SEP) o de examen.
- Prefiere analogías con una situación concreta y números que se puedan dibujar.
- **La protagonista es siempre la Pasita, dentro del universo del hobby.** No
  usamos personajes ni personas reales: la Pasita es la ninja, la idol, la
  jugadora o la delantera. El universo se reconoce por sus elementos y su
  vocabulario (aldea ninja, chakra, jutsu, sellos; zona segura, tormenta, botín;
  concierto, fandom, beat drop, comeback; vestidor, cantera, jornada), no por
  nombres propios. **Nunca** nombres de series, juegos, personajes, grupos,
  idols, jugadores, clubes ni marcas en láminas, post o hashtags (en hashtags,
  solo genéricos: #anime #kpop #videojuegos #futbol). La lección de la base
  puede traer nombres (Naruto, Fortnite, BTS…): se traducen al universo con la
  Pasita. Modelo: `2026-10-ecuaciones-pasita-ninja.json`.

## Ilustraciones con OpenAI (dirección aprobada el 4-oct-2026)

**OpenAI dibuja la lámina completa, con sus textos** (`arte.modo` = `completa`, el
valor por defecto): ilustración, títulos, paneles, opciones y acordeón, con libertad
para acomodarlos en cada lámina. Nosotros le damos el texto **exacto** de cada
lámina (sale de los campos `titulo`, `texto`, `pasos`, `pares`, `reglas`,
`opciones`… del JSON), el color de acento y la escena. Las referencias que recibe:
las dos láminas aprobadas (`arte/referencias/aprobada-1.jpg` y `aprobada-2.jpg`,
el nivel a mantener), la hoja de ejemplo (`estilo-lamina.png`) y la Pasita oficial.
Si una ilustración falla, esa lámina sale con el diseño HTML de respaldo. Con
`"modo": "fondo"` se vuelve al esquema anterior (imagen sin texto + HTML encima).

Reglas que ya van en el prompt (`src/ilustrar.mjs`): la imagen enseña aunque se le
quite el texto; las cantidades de la escena se dibujan exactas; la Pasita es
idéntica en todas las láminas; solo símbolos originales PASAS (la silueta de una
pasa dentro de un círculo), nunca espirales ni símbolos parecidos a franquicias.

**Revisión obligatoria:** OpenAI escribe bien, pero no siempre. Después de generar,
alguien (la tarea automática) mira las 9 láminas y compara cada texto y cada
cantidad contra el JSON; la que salga mal se rehace sola con `solo` = su número.

**Filosofía: la escena enseña, no decora.** Cada lámina es una composición
ilustrada distinta con un **objeto pedagógico protagonista** (la puerta con 28
huecos y solo 4 sellos, los 4 sellos en la mano, el pergamino con el plan, los 6
clones, la balanza, el foco del reveal). La Pasita es protagonista y **cambia de
pose, escala y posición** en cada lámina; nunca "Pasita chiquita abajo" por
defecto. Se alternan planos: primer plano, plano medio, personaje lateral, objeto
gigante, grupo, plano abierto. Siempre hay profundidad: foreground, midground y
background, con luz integrada al escenario (linternas, pantallas, luces de
estadio, luna), humo y partículas.

En el JSON:

```jsonc
"hobby": { …, "color": "#fb923c" },   // UN color de acento por carrusel (borde y resaltados); cambia entre publicaciones
"arte": { "universo": "El mundo en inglés: lugar, época, luz, paleta, vestuario de la Pasita, objetos clave" },
"slides": [{ …, "arte": {
  "zona_texto": "izquierda",          // arriba | arriba-grande | abajo | izquierda | derecha
  "escena": {                          // en inglés, todo concreto
    "accion": "qué pasa",
    "protagonista": "la Pasita: dónde está, de qué tamaño, pose y gesto",
    "objeto": "el objeto que enseña la idea de esta lámina",
    "foreground": "…", "midground": "…", "background": "…",
    "iluminacion": "fuentes de luz y colores",
    "emocion": "…",
    "composicion": "tipo de plano y dónde va cada cosa"
  }
}}]
```

- `zona_texto` es el lugar que la ilustración deja tranquilo para el texto; el
  renderer pone ahí el texto y oscurece **solo esa zona** (no hay velo en toda la
  imagen). Elige según la composición y la cantidad de texto: láminas con mucho
  texto (pasos, reveal, acordeón) → `arriba-grande`; escenas con objeto grande a un
  lado → `izquierda` o `derecha`; escenas abiertas → `arriba`. Varíala.
- El color de acento **no es fucsia por regla**: es uno por carrusel, el que
  combine con el universo (ninja: naranja; el mundo conserva morados y azules).
- Prohibido en `arte`: texto, números, letras, logos, nombres de franquicias o
  personas. El estilo y las referencias de la Pasita (`arte/referencias/`) los
  agrega `src/ilustrar.mjs`.
- Antes de ilustrar las 9 de un universo nuevo, conviene probar 2 o 3 láminas
  (`solo`) y revisarlas.
- Las ilustraciones se guardan en `video/arte/<carrusel>/NN.jpg` con
  `estado.json`; si una falla, el correo lo dice y se rehace con "solo" en el
  workflow sin pagar las demás. Modelo y calidad: variables de GitHub
  `OPENAI_IMAGE_MODEL` (por defecto `gpt-image-2`) y `OPENAI_IMAGE_QUALITY`
  (por defecto `medium`; `high` si se quiere más detalle).

## La fórmula PASAS

**ENTRA POR EL HOBBY → ENTIENDE CON UNA HISTORIA → DESCUBRE EL CONCEPTO REAL → PRACTICA → LLÉVATE TU ACORDEÓN.**

> En el código la última lámina se llama `chuleta`, pero **en todo texto que vea el público se dice "acordeón"** (así se le dice en México). Nunca escribas "chuleta" en láminas, posts ni reels.

Cada carrusel tiene que dar **dos recompensas**:

1. **"Ahora lo entendí"**: la primera mitad, 100% dentro del hobby.
2. **"Esto me sirve después"**: la segunda mitad, contenido real que vale la pena
   guardar y consultar una semana después.

No pedimos "guárdalo": damos **una razón** para guardarlo. La última lámina es
un acordeón que el alumno quiere tener el día del examen.

Lo que nunca cambia: empezamos con una historia ("La trampa de los 28 sellos"),
no con una definición ("¿Qué es una ecuación?"). La historia despierta "¿qué
pasó?"; la definición se la salta cualquiera. No queremos ser una versión morada
de las cuentas de "matemáticas básicas": tomamos de ellas lo práctico y
guardable, y lo sumamos a lo nuestro: narrativa, analogías y mundos de interés.

## Estructura: siempre 9 láminas

**Láminas 1 a 5: el hobby al 100%.** Ahí no aparecen palabras de escuela
(cateto, ecuación, tilde, criollos, x). Se habla como en el juego, la serie, el
concierto o el partido, y el alumno resuelve el problema **sin sentir que lee
una explicación de la escuela**. Las cuentas y los datos sí son los reales.

1. `portada`: título del tema + "explicado con" + el hobby + un dibujo (svg).
2. `escena` — la situación, con sus nombres, números y un dibujo. La etiqueta
   habla como el hobby ("Partida en curso", "Misión rango C", "En el concierto", "El club").
3. `escena` — el problema o la decisión ("¿Rodeas o cortas?", "¿Cuántos clones crea?").
4. `ejemplo` o `escena` — cómo se resuelve dentro del hobby ("El truco de los
   pros", "El plan de Shikamaru"), con las cuentas reales.
5. `escena` — el resultado y el momento wow ("Le ganaste a la tormenta",
   "6 clones, ni uno más").

**Lámina 6: EL REVEAL.** `mapa` con etiqueta "El reveal" o "Ahora, en el
examen": "Lo que acabas de resolver es esto". Cada cosa del hobby → su nombre
real, y la fórmula o el concepto (`formula`). Es el momento "¡ah, era una ecuación!".

**Lámina 7: LA REGLA GENERAL.** `reglas` (o `mapa` en historia): la regla que
sirve para cualquier problema, no solo el del hobby ("Lo que le haces a un lado,
se lo haces al otro", "¿Sumo o resto?").

**Lámina 8: RETO.** `reto`: otro problema del mismo hobby, ahora **con menos
ayuda** (sin pasos ni pistas), con 3 opciones. Pie: "La respuesta, en la última lámina →".

**Lámina 9: CHULETA PARA EL EXAMEN.** `chuleta`, etiqueta "Acuérdate así en tu
examen". Es la más importante para que lo guarden:

- `titulo`: el nombre del tema, tal como viene en el examen.
- `formula`: el caso modelo (opcional en temas sin fórmula).
- `pasos`: de 3 a 4 pasos del procedimiento, en lenguaje de escuela, cada uno
  con su cuenta (`f`) cuando aplique. Ejemplo:
  ① Quita lo que está sumando → 4x = 28 − 4 ·
  ② Deshaz lo que multiplica a x → x = 24 ÷ 4 ·
  ③ Comprueba → 4(6) + 4 = 28 ✓.
  En historia: las etapas con año y protagonista; en español: los pasos para decidir.
- `recuerdo`: una frase que une la regla con la historia del hobby, para que el
  recuerdo narrativo traiga la regla ("Los sellos que ya puso Naruto salen
  primero. Después repartes los que quedan entre los clones.").
- `atajo` (opcional): el dato extra que ahorra tiempo (ternas pitagóricas, causas).
- `respuesta_reto`: la respuesta del reto de la lámina 8, con su cuenta.

La lámina ya trae "📌 Guarda esta lámina para repasar" y pasas.mx al pie.
Prueba de calidad: **si alguien solo viera la lámina 9 una semana después, ¿le
serviría para resolver un ejercicio del examen?** Si no, rehazla.

`src/carrusel.mjs` rechaza el carrusel si la lámina 6 no es el reveal (`mapa`),
si la última no es la chuleta o si la chuleta no trae la respuesta del reto.

Modelo: `data/carruseles/2026-10-ecuaciones-pasita-ninja.json` (completo, con
ilustraciones y la Pasita como protagonista). `2026-10-pitagoras-fortnite.json`,
`2026-10-acentuacion-kpop.json` y `2026-10-independencia-futbol.json` sirven solo
de referencia de estructura: son anteriores a la regla de la Pasita y todavía
usan nombres propios; **no copies esos nombres**. Tipos de lámina: `portada`, `escena`
(texto + svg), `mapa` (pares hobby → concepto), `ejemplo` (pasos), `reglas`,
`reto`, `chuleta` (y para otros formatos: `lista`, `idea`, `tematicas`, `cierre`).

### Dibujos (svg)

Un svg simple por lámina que lo necesite, escrito a mano: `viewBox` de unos
600×300 a 660×500, comillas simples en los atributos, texto con
`font-family='Nunito' font-weight='900'` y los colores de PASAS (`#22d3ee`,
`#fb923c`, `#f472b6`, `#22c55e`, `#fbbf24`, `#a78bfa`, `#e2d9f3`, fondo
`#1a1035`). Deben explicar: el mapa con la diagonal, los clones y los sellos,
la onda con la sílaba fuerte. Nada de decoración sin función.

### Colores por hobby

Videojuegos `#22d3ee` 🎮 · Anime `#fb923c` (ícono acorde a la serie) ·
K-pop `#f472b6` 🎤 · Fútbol `#22c55e` ⚽.

## Reglas de texto

- Ortografía impecable con "¿" y acentos; tuteo; frases cortas.
- Títulos de máximo 18 caracteres por línea (2 líneas).
- Sin clickbait ni promesas de calificación. pasas.mx aparece solo al pie de la chuleta.
- `post`: 3 o 4 líneas + hashtags (tema, materia, nivel, hobby, #pasasmx). Que
  diga que la última lámina es su acordeón para guardar.

## Revisar antes de subir

Genera los PNG, míralos todos: nada cortado ni encimado, cuentas correctas, las
láminas 1 a 5 sin palabras de escuela, la chuleta legible y útil por sí sola, y
la respuesta del reto en la chuleta. Luego commit del JSON a `main`.

## Reel del mismo tema (va en el mismo correo)

**Reel = me descubre. Carrusel = me enseña y lo guardo.** El reel (20-30 s) cuenta la
microhistoria del carrusel con UN momento de revelación ("¿eso era una ecuación?") y
manda al carrusel del día. No enseña todas las reglas.

Se define en el mismo JSON, en `"reel"` (modelo: `2026-10-mrua-pasita-piloto.json`):

```jsonc
"reel": {
  "post": "texto para publicar el reel",
  "portada": { "titulo": [["¿Qué tan rápido",""],["va a los",""],["6 segundos?","k"]], "sub": "Física explicada con **carreras de karts**", "fondo": 3 },
  "escenas": [   // 7 u 8 escenas, 25-30 s en total
    { "tipo": "texto",    "dur": 3.0, "lineas": [["La Pasita arranca","s"],["desde cero","k"]], "arte": { "escena": { … como en las láminas … } } },
    { "tipo": "contador", "dur": 4.4, "lineas": […], "contador": { "etiquetas": ["Segundo 1","Segundo 2","Segundo 3"], "valores": ["4 m/s","8 m/s","12 m/s"] }, "arte": { … } },
    { "tipo": "pregunta", "dur": 3.4, "lineas": [["¿Qué tan rápido va","s"],["a los 6 segundos?","k"]], "arte": { … } },
    { "tipo": "texto",    "dur": 2.4, "lineas": [["Parece un juego…","s"],["pero es física","k"]], "arte": { … } },
    { "tipo": "formula",  "dur": 5.0, "fondo_de": 4, "lineas": […], "formula": { "terminos": [{ "t": "vf", "cls": "k", "l": "lo que marca el velocímetro" }, { "t": "=", "cls": "op" }, …], "resultado": "0 + 4 × 6 = 24 m/s", "resultado_texto": "Eso es un MRUA" } },
    { "tipo": "cta",      "dur": 3.6, "lineas": [["¿Quieres el","s"],["acordeón?","k"]], "cta": { "linea": "El paso a paso para tu examen está en el **carrusel de hoy**", "sub": "Guárdalo y practica" }, "arte": { … } }
  ]
}
```

- Arco fijo: situación del hobby → el dato que cambia (contador) → pregunta con 3 s
  para pensar → la respuesta → "parece X… pero es [materia]" → la fórmula o el
  concepto armándose → cierre al carrusel.
- Cada escena con `arte.escena` lleva un fondo de OpenAI **sin texto** (9:16); el texto,
  el contador, el anillo y la fórmula los anima `templates/reel-ilustrado.html`.
  `fondo_de` reutiliza el fondo de otra escena (índice desde 0).
- Líneas cortas: `s` = línea chica, `k` = línea grande en el color de acento. Valores
  del contador cortos (máx. ~12 caracteres).
- Portada: `templates/portada-reel.html` con el gancho grande sobre el fondo
  `portada.fondo`. Va sin clickbait: una pregunta real del reel.
- **Lo que aprendimos del video del 2 de octubre** (el mejor orgánico; ver `HISTORIAS.md`): el
  gancho de la escena 1 se ve completo desde el cuadro 0 (ya lo hace la plantilla), le habla a
  quien lo ve ("tenían tu edad", "tu hijo", "tú también…") y el reel dura 20-30 s. En el post,
  las palabras que la gente busca (el tema tal cual) y una pregunta que se conteste en una línea.
- Envíos ya hechos: `data/programados.json` (fecha → JSON) los manda al equipo la tarea de Claude
  (lun/mié/vie ~6:50 am) con workflow_dispatch, sin volver a llamar a OpenAI.
