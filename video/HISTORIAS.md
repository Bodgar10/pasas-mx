# Historias y efemérides (martes, jueves y fechas icónicas)

Reel de **25-35 s** que cuenta la historia real detrás de un tema, en el formato del video del
**2 de octubre de 1968**, el que mejor le ha ido a @pasas.mx sin pagar (730 vistas, 135 likes =
18 %, cuando lo normal es 4-8 %).

| Día | Qué sale |
|---|---|
| Fecha de `data/efemerides.json` (cualquier día) | **Efeméride**: lo que pasó ese día, publicado ese mismo día |
| Martes y jueves sin fecha icónica | **Historia detrás de un tema** del temario: cómo se descubrió, quién lo inventó, por qué existe (la célula, el cero, la vacuna, la tabla periódica…) |

Lo hace la tarea automática de Claude (diario a las 6:12 am) y le llega por correo al equipo
(`CARRUSELES_EMAIL_TO`) hacia las 6:40 am, con el video, la portada y el texto para publicar.

## Por qué funcionó el del 2 de octubre (y qué copiamos)

1. **La fecha.** Casi todas las vistas llegaron ese mismo día: la gente buscaba "2 de octubre
   de 1968". El tema del día empuja solo. → Las efemérides se publican **el mismo día, temprano**,
   y la fecha va escrita tal cual en el primer cuadro y en el post.
2. **El gancho le habla a quien lo ve.** "TENÍAN TU EDAD." No es "¿Qué pasó el 2 de octubre?".
   → La escena 1 conecta la historia con la vida del alumno o con algo cotidiano
   ("Antes de 1492, la pizza no tenía jitomate.").
3. **Personas, no fechas.** "Detrás de palabras como víctimas había personas." → Contar lo que
   vivieron y sintieron, con datos exactos, sin lenguaje de libro de texto.
4. **Un look que no parece clase.** Ilustración oscura y documental, la Pasita como testigo
   (de espaldas, con su mochila), títulos condensados con marcatexto verde lima. Se ve distinto a
   todo lo demás del feed.

## Qué corregimos

- **Duraba 1:45 y el promedio de vista fue 6 s (0.5 % lo terminó).** El texto se escribía letra
  por letra: en el segundo 2 solo decía "TENÍAN" y ahí se iba casi todo el mundo.
  → El gancho se ve **completo desde el cuadro 0**, cada escena dura 3-4.5 s y el total, 25-35 s.
- **0 comentarios.** → El cierre hace una pregunta honesta que se contesta en una línea
  ("¿Qué no comerías hoy sin esa fecha?").
- **La Pasita del original no era la oficial** (salió rosa y peluda). → Las escenas usan la hoja
  de personaje oficial; el video solo da el ambiente (`arte/referencias/estilo-documental.jpg`).

## El archivo

`data/historias/AAAA-MM-DD-<tema>.json` (la fecha es el día en que se publica). Modelo:
`data/historias/2026-10-12-12-de-octubre-1492.json`.

```jsonc
{
  "nombre": "12 de octubre de 1492",       // también nombra la carpeta de arte
  "tipo": "efemeride",                      // o "historia"
  "fecha_iconica": "12 de octubre de 1492", // solo efemérides
  "materia": "Historia", "nivel": "Secundaria 1°",
  "tono": "con debate: …",                  // de efemerides.json; "delicado" o "debate" → música tranquila
  "hobby": { "color": "#c6f432" },          // verde lima, el color de la serie (no cambiarlo)
  "arte": { "estilo": "documental", "universo": "época y lugar, en inglés, con lo que se ve" },
  "reel": { "escenas": [ … ] },
  "post": "texto para publicar (con la fecha tal cual si es efeméride)"
}
```

Cada escena:

```jsonc
{
  "dur": 3.8,                                   // 3-4.5 s; la 1 máximo 3.4
  "titulo": ["Pero también", "**llegó la viruela.**"],  // 1-3 líneas, máx. 18 caracteres; ** = verde
  "marcador": "Se encontraron.",                // opcional: marcatexto verde, máx. 26
  "fecha": "12 de octubre de 1492",             // opcional: línea chica espaciada
  "cuerpo": ["Millones de personas… **no tenían defensas**…"],  // máx. 130 en total; [[x]] = resaltado
  "arte": { "escena": { … campos de CARRUSELES.md … }, "carteles": ["ESTUDIANTES UNIDOS"] },
  "fondo_de": 3                                 // en vez de "arte": reusa la imagen de otra escena (ahorra)
}
```

- **Escena 1 = portada.** Solo título (y fecha o marcador). Es el primer cuadro del video y la
  portada del perfil: tiene que entenderse en un vistazo.
- **La última** es `"tipo": "cierre"`: pregunta para comentarios, `firma` ("Historia que sí se
  entiende") y PASAS.MX. Va con `fondo_de` (no se dibuja).
- **Estructura:** gancho → contexto (qué, cuándo, dónde) → lo que vivieron las personas → el
  giro o la consecuencia → por qué importa hoy → cierre con pregunta. 7-8 escenas.
- **Escenas de arte** (en inglés): la Pasita testigo en el lugar y la época, con mochila; gente
  anónima de espaldas o a lo lejos; arriba 42 % oscuro y tranquilo (ahí va el título). `carteles`
  solo si un letrero con texto le da verdad a la escena (frases cortas, exactas, de la época).
- **Gasto:** ~$0.09 USD por escena dibujada. 6-7 escenas por video; reusa con `fondo_de` cuando
  dos escenas pasan en el mismo lugar.

## Reglas de contenido

- **Datos exactos.** Fechas, cifras y nombres verificados (búsqueda web si la sesión la tiene).
  Si un dato es discutido, se dice "se calcula", "según…" o se omite.
- **Temas delicados** (masacres, sismos, epidemias, conquista): respeto, nada gráfico ni en texto
  ni en imagen, sin opinar de política actual. Sí se nombra lo que pasó.
- **Personas reales:** sus nombres sí, como texto. Nunca se dibujan (ni retratos ni caricaturas).
- **Sin clickbait.** El gancho es un dato real y sorprendente, no intriga artificial.
- **Nunca "chuleta":** se dice "acordeón".
- La historia sale de un tema real de PASAS cuando se pueda (Supabase, solo lectura), para que el
  cierre pueda decir de qué materia y grado es.

## Revisar y mandar

```bash
node src/historia.mjs --data data/historias/<archivo>.json --revisar   # un PNG por escena (sin gastar)
```

Push del JSON a `main` → el workflow "Historias de PASAS" dibuja las escenas y, si la fecha del
archivo es hoy, manda el correo. Si es de un día futuro, solo dibuja; ese día la tarea lo manda con:

```bash
gh api -X POST repos/Bodgar10/pasas-mx/actions/workflows/historias.yml/dispatches -f ref=main \
  -f "inputs[data]=data/historias/<archivo>.json"
```

(Las escenas ya dibujadas no se vuelven a pagar.) Para rehacer escenas: `-F "inputs[forzar]=true"`
cobra todas de nuevo; mejor cambia la `escena` de la que salió mal (cambia su prompt y solo esa
se redibuja).
