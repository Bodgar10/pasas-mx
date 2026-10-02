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
- **Nombres**: series, juegos, personajes, grupos y clubes, sí y con su nombre
  (Fortnite, Naruto, Stray Kids, Barça); es lo que hace que funcione. Solo como
  texto: nunca logos, capturas ni imágenes de ellos.
- **Personas reales**: si la analogía gira alrededor de un futbolista o idol en
  particular, cámbialo por el equipo, el grupo o "un delantero", o escoge otra
  temática para ese tema.

## Estructura (8 o 9 láminas)

1. `portada`: título del tema + "explicado con" + el hobby + un dibujo (svg).
2. `escena`: la situación del hobby, con sus números, y su dibujo.
3. `escena` o `mapa`: la pregunta / qué representa cada cosa del hobby en el tema.
4. `ejemplo`: se resuelve paso a paso con los números del hobby.
5. `escena` "¡Ya lo entendiste!": el momento wow; qué significa y cómo se usa en el examen.
6. `reglas`: la regla o el error típico del examen.
7. `reto`: una pregunta con 3 opciones, también con el hobby.
8. `cierre`: la respuesta explicada, "Guárdalo para tu examen" y pasas.mx.

Formato completo en `data/carruseles/2026-10-pitagoras-fortnite.json` (y los
otros tres de octubre 2026). Tipos de lámina: `portada`, `escena` (texto + svg),
`mapa` (pares hobby → concepto), `ejemplo` (pasos), `reglas`, `lista`, `idea`,
`tematicas`, `reto`, `cierre`.

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
- Sin clickbait ni promesas de calificación. El cierre invita a guardar y menciona
  pasas.mx una sola vez.
- `post`: 3 o 4 líneas + hashtags (tema, materia, nivel, hobby, #pasasmx).

## Revisar antes de subir

Genera los PNG, míralos todos: nada cortado ni encimado, cuentas correctas,
la respuesta del reto aparece en el cierre. Luego commit del JSON a `main`.
