# Mostrar PASAS: "Así se explica"

Un reel que enseña cómo se aprende en PASAS: una **lección real** con su
temática (Anime & Manga, Videojuegos, K-pop & K-dramas o Fútbol), con
subtítulos y, si se puede descargar, la voz de la lección. Portada con **solo
el título** ("FÍSICA / CON NARUTO").

```bash
cd video
node src/tematica.mjs --data mi-leccion.json --revisar   # portada + 4 cuadros para aprobar
node src/tematica.mjs --data mi-leccion.json             # video completo (~45 s, unos 7 min de render)
```

Deja en `salida/tematica/` el `.mp4`, la portada `-portada.png` y el texto del post.

## Elegir la lección con más potencial

Cuando no piden una lección concreta ("queremos mostrar qué es PASAS"), no
elijas al azar: revisa varias y quédate con las que tienen más posibilidades de
compartirse.

### 1. Sacar candidatas variadas

Una consulta que trae hasta 3 lecciones por cada combinación de materia y
temática (unas 40), para comparar entre todas:

```sql
with c as (
  select sec.id, th.name as tematica, s.name as materia, s.education_level, t.grade,
         t.name as tema, sec.content, sec.audio_url, sec.audio_duration,
         row_number() over (partition by s.name, th.name order by random()) as n
  from sections sec
  join topics t   on t.id = sec.topic_id
  join subjects s on s.id = t.subject_id
  join themes th  on th.id = sec.theme_id
  where sec.type = 'explanation' and t.published
    and sec.audio_duration between 20 and 42
    and s.name !~* 'ingl|formaci|tutor|orientaci'   -- materias donde la temática lucirá menos
)
select * from c where n <= 3 order by random() limit 40;
```

### 2. Calificar cada una (0 a 10)

| Criterio | Puntos | Qué buscar |
|---|---|---|
| **Referencia muy reconocida** por jóvenes de 13 a 18 en México | 0–3 | Minecraft, Roblox, Fortnite, Naruto, Demon Slayer (Tanjiro), One Piece, Dragon Ball, My Hero Academia, BLACKPINK, BTS, Stray Kids, el Mundial, el VAR. Menos puntos a referencias de nicho. |
| **Contraste**: materia "difícil" + referencia divertida | 0–2 | Física, química, matemáticas, historia y biología suman más. "Química con Minecraft" sorprende; "Español con K-pop", menos. |
| **Se entiende solo, con un ejemplo concreto** | 0–2 | Que la referencia explique el concepto de verdad (el Rasengan = movimiento circular), no que la mencione de paso. |
| **Se puede dibujar** en un diagrama simple | 0–1 | Movimiento, fuerzas, células, átomos, líneas de tiempo, mapas. |
| **Lo están viendo en clase** este mes | 0–1 | Temas de inicio de ciclo en septiembre–octubre; de examen final en noviembre y mayo. |
| **Variedad** frente a lo ya publicado | 0–1 | Revisa `data/publicados/`: no repetir materia ni referencia de las últimas 5 lecciones. |

Si la sesión tiene búsqueda web, un punto extra a referencias en tendencia este
mes (estreno de temporada, juego nuevo, gira, torneo).

### 3. No elegir

- Lecciones centradas en **personas reales** (futbolistas, idols con nombre
  propio como protagonista): usar a una persona real para promocionar un
  producto es más delicado que un personaje de ficción. Si la temática es
  fútbol, mejor las que hablan del juego (el VAR, un penal, el Mundial).
- Temas sensibles (violencia, guerra explícita, salud mental, sexualidad).
- Lecciones cuyo título de portada no quepa en 2 líneas de 14 caracteres.

### 4. Proponer

Presenta las **3 mejores** con su puntaje y una línea de por qué cada una, y
di cuál harías. Ejemplo:

> 1. **Física con Naruto** (9/10): Naruto es muy conocido, el Rasengan explica el movimiento circular de verdad y se puede dibujar. Es el que haría.
> 2. **Química con Minecraft** (8/10): muchísimo alcance; la explicación es buena, pero el diagrama es más difícil.
> 3. **Historia con One Piece** (7/10): buen contraste, aunque el tema es menos visual.

## Buscar una lección concreta

Cuando piden algo concreto ("física con Naruto"). Las secciones con temática
son contenido general (no pertenecen a ningún alumno). Las que sirven son las de
tipo `explanation`: explican el tema con la referencia. Consulta en Supabase
(proyecto `uxtmdhbqiphvmixtxlox`):

```sql
select sec.id, th.name as tematica, s.name as materia, s.education_level, t.grade,
       t.name as tema, sec.content, sec.audio_url, sec.audio_duration
from sections sec
join topics t   on t.id = sec.topic_id
join subjects s on s.id = t.subject_id
join themes th  on th.id = sec.theme_id
where sec.type = 'explanation' and t.published
  and sec.audio_duration between 20 and 45
  and th.name = 'Anime & Manga'            -- o la temática que pidan
  and s.name ilike 'Física%'               -- o la materia
  and sec.content ilike '%naruto%'         -- si piden una referencia concreta
order by random() limit 5;
```

Elige la que se entienda sola y tenga un ejemplo claro. Materias que suelen
funcionar mejor: física, biología, química, historia, matemáticas.

## El archivo

```jsonc
{
  "nombre": "fisica con naruto",
  "materia": "Física", "nivel": "Secundaria",         // nivel: Secundaria o Prepa
  "tema": "Movimiento circular y parabólico",          // nombre del tema en PASAS
  "tematica": "Anime & Manga",
  "gancho": ["¿Física", "con Naruto?"],                // video: 1 a 3 líneas, máx. 16 caracteres
  "subgancho": "Así explica PASAS el movimiento circular y el parabólico.",
  "portada_titulo": ["Física", "con Naruto"],          // portada: SOLO esto, máx. 14 por línea
  "portada_pose": "celebrando",                        // opcional
  "portada_color": "rosa",                             // opcional: rosa, cian o amarillo
  "fondo": "cuarto",                                   // mismo catálogo que PASITA.md
  "audio": 35.84,                                      // audio_duration de la sección
  "audio_url": "https://…/sections/<id>.mp3",          // audio_url de la sección
  "texto_audio": "…",                                  // content TAL CUAL (se usa si hay voz)
  "texto": "…",                                        // content con la primera frase ajustada (se usa sin voz)
  "diagrama": "<svg …>",                               // opcional
  "post": "…"
}
```

### El texto

- `texto_audio` es el `content` de la sección **sin tocar**: si el video lleva
  voz, los subtítulos tienen que decir exactamente lo mismo.
- `texto` es el mismo contenido con **solo la primera frase** ajustada cuando
  dice "Lo que acabas de ver en…" (en la plataforma viene después de otra
  sección; en un video suelto no hay nada antes). Ejemplo: "Lo que acabas de
  ver en Naruto son exactamente…" → "En Naruto aparecen justo…".
- Las palabras entre `**` se resaltan en amarillo.

### El diagrama (opcional)

Un SVG de `viewBox="0 0 900 450"` que ilustre el concepto (formas simples,
colores de la marca: `#a78bfa`, `#ec4899`, `#22d3ee`, `#fbbf24`, texto
`#e2d9f3` en Nunito). Clases que se animan solas: `anim-spin` (gira),
`anim-pulse` (late), `anim-float` (flota). Si no aporta, no lo pongas: el
recuadro del texto ocupa su lugar.

### Reglas

- Mismas reglas de contenido que `PASITA.md` (sin clickbait, ortografía
  impecable, sin prometer resultados).
- Personajes y marcas **solo como texto**: nunca imágenes, logos ni música de
  la serie, el juego o el grupo.
