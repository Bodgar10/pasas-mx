# Guía para escribir un tema (materias nuevas s44)

Lee esto completo antes de escribir. El formato exacto está en `cargar.ts` (tipo `ArchivoTema`) y
el mejor ejemplo es cualquier archivo de `tecnologia-sec-1/` (léete al menos `01-…` y `09-…` completos).

## Qué es Pasas
App de estudio para secundaria y prepa en México. Cada alumno elige una **temática** (hobby) y
TODA la lección vive dentro de ese mundo: Anime & Manga, Fútbol, K-pop & K-dramas, Videojuegos.
La temática no es un adorno: la analogía, el ejemplo, el steps, el sort, el memorama, Conecta y
el quiz ocurren dentro de ese universo. La horda y el diagnóstico son **neutros** (simulan el examen
de la escuela, sin temática).

## Cada temática lleva
| Sección | Qué es | Reglas |
|---|---|---|
| analogy | Historia concreta del hobby donde el concepto aparece solo, sin nombrarlo formalmente. Cierra con "…es la lección de hoy." | 550-1150 caracteres, sin negritas. Situación real y reconocible para un adolescente mexicano de 2026. |
| explanation | Abre con "Lo que acabas de ver en/con … es exactamente …" y da el concepto formal con **negritas**. | 350-800 caracteres |
| example | Ejemplo resuelto DISTINTO a la analogía, dentro del hobby, con `**Paso 1:**`…`**Paso 5:**` y un cierre. | 350-850 |
| key_fact | Definición formal para memorizar, con **negritas**. Puede ser igual en las 4 temáticas. | 140-400 |
| tip | Truco para el examen, con imagen del hobby. | 80-280 |
| steps | "Resuélvelo conmigo": `visual: "bar"` (start + delta por paso, el valor nunca sale de 0-100, delta ≠ 0) o `"chain"` (sin delta). 3-5 pasos de ≤220 caracteres, `intro` obligatorio. | |
| sort | 2-4 cubetas cortas (≤34), 4-6 items (≤48) bien repartidos, sin repetir. | |
| match | Memorama de **exactamente 4 parejas**, cartas ≤26 caracteres, las 8 cartas distintas. **Ninguna carta puede emparejar razonablemente con otra pareja** (si el alumno la empareja distinto "con razón", el juego le marca error). | |
| connect | 2-4 parejas analogía→concepto, ≤42 caracteres por tarjeta, `left_label` y `right_label` ≤18, `completion_feedback` ≤220 que lleve a la explicación. | |
| quiz | 5 preguntas: dificultades 1, 2, 3, 2, 3. 4 opciones A-D. Explicación ≤60 palabras. | |

Más: `order_steps` compartido (3-5 pasos de ≤80 caracteres, sin números al inicio, en orden correcto y con
UN solo orden defendible), `horde` (30 preguntas, oleadas 1-6 × 5, difficulty = ⌈oleada/2⌉, texto plano sin
Markdown, enunciado ≤200, opción ≤80, hint ≤140 que oriente sin regalar, explicación ≤240) y `diagnostic` (1 pregunta,
explicación ≤60 palabras, que NO repita una pregunta de la horda).

## Reglas de las preguntas (las que más fallan)
- 🔴 **La respuesta correcta NUNCA puede ser la opción más larga** (estrictamente). Escribe primero la correcta lo más corta
  posible y luego distractores de igual o mayor largo. El validador lo bloquea.
- Distractores = errores típicos reales, nunca absurdos. Prohibido "todas/ninguna de las anteriores".
- Nunca menciones opciones por letra ("la B", "inciso C"): se barajan.
- Una sola respuesta defendible. Si un distractor también es correcto con buena voluntad, cámbialo.
- Las pistas (hint) orientan el método; no listan la respuesta.

## Contenido
- Español de México, directo, para 12-15 años (secundaria) o 15-18 (prepa). Nada de groserías.
- Datos exactos. Si no estás seguro de un dato de cultura pop (fecha, nombre, quién hizo qué), NO lo uses.
  Hoy es octubre de 2026: el Mundial 2026 ya se jugó; no escribas en futuro cosas que ya pasaron.
- Nada no apto para la edad (series con violencia gráfica o contenido sexual: Chainsaw Man, Squid Game,
  Dandadan, etc.). Nada que presente piratería como modelo a seguir. No inventes correos ni dominios de
  empresas reales (usa nombres genéricos como tiendadejuegos.com).
- Usa lo más famoso y reconocible de cada mundo, y VARÍA: no repitas los escenarios ya usados en
  materias anteriores (lista abajo).
- Las 4 temáticas enseñan el MISMO concepto con la misma profundidad.

## Escenarios ya usados en Tecnología 1° (no repetir)
Anime: espada de Tanjiro, fanart de Gojo en Clip Studio, laptop de Loid (Spy x Family), ficha de los Sombrero
de Paja, rumor del final de One Piece, cuenta de Crunchyroll, club de anime, Studio Ghibli, Dr. STONE,
colección de manga. Fútbol: banda de Raúl Jiménez, VAR, analista del América, torneo relámpago, rumor
Mbappé, portero que falla el penal, inscripción a la liga, charla del medio tiempo, equipo del estadio,
balones a la calle. K-pop: ARMY Bomb, live de Jungkook, subtítulos de Queen of Tears, reporte de BLACKPINK,
boletos falsos de BTS, fan account de Stray Kids, dance cover de NewJeans, teasers de comeback, backstage
de TWICE, club de dance cover (ILLIT). Videojuegos: primera noche de Minecraft, Mario Kart, resource pack,
guía Pokémon, truco falso de Minecraft, Robux gratis, soporte de compra, Nintendo Direct, inventario de
Minecraft, cables del setup.
Ideas frescas: Blue Lock, Haikyuu!!, Frieren, My Hero Academia, Naruto, Dragon Ball, Solo Leveling;
Liga MX, Selección, Champions, Lamine Yamal, EA SPORTS FC / Ultimate Team; SEVENTEEN, aespa, IVE,
LE SSERAFIM, ATEEZ, KPop Demon Hunters (HUNTR/X), Lovely Runner, Business Proposal; Fortnite, Zelda,
Roblox, Free Fire, Brawl Stars, Animal Crossing, Among Us, Stardew Valley, Pokémon (no repetir guía).

## Proceso
1. Escribe el JSON en `scripts/contenido-materias/<materia>/<NN>-<slug>.json` (subject y topic = los slugs exactos).
2. Valida: `npx tsx scripts/contenido-materias/cargar.ts <archivo>` y corrige hasta **0 errores**
   (los avisos de "carta de más de 4 palabras" se toleran).
3. No cargues nada a la base, no toques otros archivos.
