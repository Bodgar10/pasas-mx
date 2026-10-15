# Materias nuevas (s44) — contenido escrito a mano

Contenido de las 11 materias de la auditoría s44 (`claude/Pasas_Auditoria_Materias_Faltantes_s44.md`
en el proyecto). Lo escribe Claude tema por tema; **no se usan los scripts de generación con API**.

Las materias y sus 110 temas se dieron de alta con `supabase/migrations/063_materias_faltantes.sql`.
Nacen **ocultas** (`subjects.grades = '{}'`) y con los temas sin publicar.

## Un archivo = un tema completo

`<materia>/<NN>-<slug>.json`:

| Bloque | Qué lleva |
|---|---|
| `temas` × 4 temáticas | analogía, explicación, ejemplo resuelto, dato clave, tip, Resuélvelo conmigo (`steps`), Clasifica (`sort`), Memorama (`match`), Conecta (`connect`), Arma los pasos opcional por temática y 5 quiz (dificultades 1, 2, 2, 3, 3) |
| `order_steps` | Arma los pasos compartido por las 4 temáticas |
| `horde` | 30 preguntas neutras, 6 oleadas × 5, dificultad = ⌈oleada/2⌉ |
| `diagnostic` | 1 pregunta |

Resultado en la base por tema: 40 secciones, 20 quiz, 30 de horda, 1 diagnóstico, `horde_ready = true`.

## Flujo

1. **Escribir** el JSON del tema.
2. **Validar**: `npx tsx scripts/contenido-materias/cargar.ts <archivo>`. Usa las mismas reglas que
   la app (`src/lib/minijuegos.ts`) más las de los prompts de `generate-topic` y `generate-horde`:
   largos, 4 opciones, **la correcta nunca es la opción más larga**, sin letras en las explicaciones,
   memorama con 4 parejas y cartas distintas, barra de `steps` dentro de 0-100, etc.
3. **Revisión independiente ANTES de cargar** (un agente que no escribió el contenido): claves,
   ambigüedades, datos falsos de cultura pop, cosas no aptas para la edad. En Tecnología 1° la
   revisión se hizo después de cargar y corregir costó UPDATEs que piden confirmación.
4. **Generar SQL**: `... cargar.ts <archivos> --sql-dir .sql-carga` (carpeta ignorada por git).
   Un bloque `DO` atómico por tema, **solo inserta**: aborta si el tema no existe, si está
   publicado o si ya tiene contenido. Lleva el md5 del contenido: si se altera un carácter al
   pegarlo en el conector, no escribe nada. Las opciones se barajan con `barajarOpciones` al generar.
5. **Cargar** cada `.sql` con el conector de Supabase (`execute_sql`).
6. **Espejo de minijuegos**: `... cargar.ts --minijuegos <materia>` reescribe
   `scripts/minijuegos/contenido/<materia>.json` en el formato del cargador de s43.
7. **Publicar** con `publicar-<materia>.sql` (temas publicados, `grades`, backfill de `user_subjects`).

## Pendiente fuera de este flujo

- **Audio** de analogía, explicación y ejemplo: `generate-audio.ts --subject=<materia>` en la Mac
  con Voicebox abierto (las demás materias lo tienen; estas secciones nacen sin `audio_url`).
- La cifra de materias de la landing sale de `landing_stats()` y sube sola al publicar;
  `STATS_RESERVA` en `src/app/page.tsx` es solo el respaldo.

## Estado

| Materia | Temas cargados | Revisión | Publicada |
|---|---|---|---|
| tecnologia-sec-1 | 10/10 | ✅ todas aplicadas | ✅ 14 oct 2026 (falta audio) |
| tecnologia-sec-2 | 10/10 | ✅ antes de cargar | ✅ 14 oct 2026 (falta audio) |
| tecnologia-sec-3 | 10/10 | ✅ antes de cargar | ✅ 15 oct 2026 (falta audio) |
| introduccion-ciencias-sociales | 10/10 | ✅ antes de cargar | ✅ 15 oct 2026 (falta audio) |
| ciencias-salud-1 | 10/10 | ✅ antes de cargar | ✅ 15 oct 2026 (falta audio) |

## Ojo con el conector de Supabase
Algunos UPDATE llegan como `cancelled` sin que aparezca ningún aviso (filtro automático del
conector, no tuyo). Pasa más con bloques `DO` de varios UPDATE. Funciona mejor una sentencia por
llamada; lo que se siga cancelando se corre a mano en el SQL Editor del dashboard.

## Ojo al cargar con agentes (md5 no coincide)
El shell no llega a Supabase, así que el `.sql` (~60 KB) lo transcribe un agente al conector, y a
veces altera un carácter: parte palabras ("copiarlas" → "copiar las"), cambia "el" por "tu" o mete
`"hint":null`. El md5 lo frena y no se inserta nada, así que reintentar es seguro. Lo que funciona:
que el agente **primero escriba su copia a un archivo, la compare con `cmp` contra el original,
corrija hasta que sea idéntica, y solo entonces la mande**. Si una palabra se rompe siempre,
reescribe esa frase en el JSON y regenera el SQL.
