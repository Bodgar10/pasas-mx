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
- **Nombres**: con su nombre real y sin miedo: series, juegos, personajes,
  grupos, clubes y también personas (BTS, Stray Kids, Lamine Yamal, Fortnite,
  Naruto). Es lo que hace que funcione. Condiciones: solo como texto (nunca
  fotos, logos, capturas ni su música); nada que suene a que nos patrocinan o
  recomiendan ("BTS estudia con PASAS", "oficial"); nada que los ridiculice o
  les atribuya algo falso o polémico. Las situaciones son claramente
  imaginarias ("imagina que…", "en un concierto de…").

## Estructura: primero el universo, al final lo real

La regla de oro: **las primeras láminas viven 100% dentro del hobby**. Ahí no
aparecen palabras de escuela (cateto, ecuación, tilde, criollos): se habla como
se habla en el juego, la serie, el concierto o el partido, y aun así se entiende
la idea completa. **Después** viene el puente ("eso que hiciste tiene nombre") y
al final las reglas reales para guardar.

1. `portada`: título del tema + "explicado con" + el hobby + un dibujo (svg).
2. `escena` — **universo**: la situación, con sus nombres, números y un dibujo.
   La etiqueta habla como el hobby ("Partida en curso", "Misión rango C",
   "En el concierto", "El club").
3. `escena` — **universo**: el problema o la decisión ("¿Rodeas o cortas?").
4. `ejemplo` o `escena` — **universo**: cómo se resuelve dentro del hobby
   ("El truco de los pros", "El plan de Shikamaru"), con las cuentas reales.
5. `escena` — **universo**: el resultado y el momento wow ("Le ganaste a la tormenta").
6. `mapa` "Ahora, en el examen": cada cosa del hobby → su nombre real, con la
   fórmula o el concepto.
7. `reglas` (y si hace falta `mapa` o `ejemplo`): la regla real para el examen.
8. `reto`: una pregunta con 3 opciones, otra vez dentro del hobby.
9. `cierre`: la respuesta explicada, "Guárdalo para tu examen" y pasas.mx.

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
