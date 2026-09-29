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

## Buscar la lección

Las secciones con temática son contenido general (no pertenecen a ningún
alumno). Las que sirven son las de tipo `explanation`: explican el tema con la
referencia. Consulta en Supabase (proyecto `uxtmdhbqiphvmixtxlox`):

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
