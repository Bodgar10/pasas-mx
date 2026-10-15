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

## Escenarios ya usados en Tecnología 2° (no repetir)
Anime: animación a mano de Dragon Ball, ramen de Teuchi (Naruto), maratón de Frieren, gasto en convención,
encuesta del mejor personaje, episodios de My Hero Academia, rutina de Saitama (One Punch Man), cofres mímicos
de Frieren, Hinata y Kageyama (Haikyuu!!), Goku en Scratch, portada de fanfic de Solo Leveling, sticker de
Anya en Ibis Paint, cajas sorpresa de Spy x Family, cosplay de Deku, fanart de Isagi y Rin (Blue Lock), cartel
de expo del club, fanfic grupal de Blue Lock, cosplay de Sailor Scouts, espada de Asta (Black Clover), varita
de Sailor Moon. Fútbol: balón antiguo vs moderno, jersey estampado de la Selección, tabla de goleo, puntos de
Liga MX, estadísticas de Santi, goles por jugador, falta del minuto 85, penales en pseudocódigo, La Masia y
Lamine Yamal, juego de penales en Scratch, póster del torneo escolar, publicación de la final, jerseys nuevos
cada temporada, consumo de energía viendo Champions, jersey pirata de Chivas en el tianguis, escudo de la liga
de la colonia, álbum de estampas compartido, estadios del Mundial 2026, maqueta del Estadio Azteca, pizarra
táctica. K-pop: casete de los noventa, SEVENTEEN en el estudio, concierto de SEVENTEEN en CDMX, reproducciones
del MV de aespa, reacción al comeback de IVE, votación de HUNTR/X, coreografía de «Supernova», ramyeon de
K-drama, Hoshi coreografiando a SEVENTEEN, Rumi en Scratch, edit de Kazuha (LE SSERAFIM), póster de Lovely
Runner, photocards de ATEEZ, pilas del lightstick, edit de Lovely Runner, reseña de Business Proposal, regalo
de cumpleaños a Hongjoong (ATEEZ), compra grupal de LE SSERAFIM, organizador de photocards, soporte para ver
Weverse. Videojuegos: Game Boy de 1989, Overcooked, torneo de Brawl Stars, nabos de Animal Crossing, horas de
Roblox, oro de Stardew Valley, Ender Dragon de Minecraft, pesca en Animal Crossing, granja de Stardew Valley,
crewmate de Among Us en Scratch, miniatura de Fortnite, banner Pokémon en GIMP, consola vieja en el cajón,
drift del control, juego de Pokémon hecho por un fan, recursos con licencia, guerra de Clash of Clans, video de
Free Fire, controles de Fortnite pisados, control arcade de Street Fighter.

## Escenarios ya usados en Tecnología 3° (no repetir)
Anime: Corporación Cápsula y la nave a Namek (Dragon Ball), Pokédex de Ash, página de fans de Kaiju No. 8
(Kafka, Mina, Tercera División), medidor de Mob (Mob Psycho 100), clones de Naruto, tienda de Sakamoto Days,
Doraemon despertando a Nobita, recomendaciones «porque viste Jujutsu Kaisen», traductor de un tomo de Sakamoto
Days, AMV de Jujutsu Kaisen, fandub de One Piece, vitrina de Bakugo y Todoroki (MHA), marcapáginas de Bleach.
Fútbol: fuera de lugar semiautomático y Estadio 974 (Qatar 2022), mercado de Ultimate Team, torneo femenil de la
escuela, página de Pumas, Clásico Regio femenil, minutos por gol, utilero de la Selección, 17 jornadas de Liga MX,
RoboCup, máquina lanzabalones, portera que estudia tiros de esquina, cámara con IA que siguió una cabeza calva,
chilena en cámara lenta, partido grabado con el celular, boleto digital con QR, cronograma de la copa escolar,
marcador de la liga escolar, tablero de cambios. K-pop: Weverse Albums, concierto en línea de BTS 2020,
discografía de Stray Kids, nacionalidades de TWICE (MiSaMo), fan site de TXT, Inkigayo/Music Bank, reto de MIDZY,
setlist de TWICE, lista de BTS, luz que sigue a Nayeon, lightsticks con control central, cover de IA de Winter,
chatbot y aespa, calidad de audio de Stray Kids, MV en 4K, fila virtual de BLACKPINK, slogans de BLINK,
lightstick casero para ENHYPEN, fan event de IVE. Videojuegos: Switch 2 y Xbox Adaptive Controller, Compendio de
Hyrule, Geometry Dash, torneo de Fall Guys, efectividad de tipos y caramelos de Magikarp (Pokémon GO), Salmon Run
(Splatoon 3), Mario Kart World, redstone de Minecraft (lámparas, granja de caña), jefe generado con IA en Roblox
Studio, Creeper vs Drivatar (Forza), clip de Rocket League y stream de Twitch, obby en Roblox Studio con
cronograma, servidor de Minecraft rentado, nivel de Super Mario Maker 2, control adaptado.

## Escenarios ya usados en Introducción a las Ciencias Sociales (no repetir)
Anime: proyección pública de Dragon Ball Super (2018), Cells at Work! y la gripe del salón, convención de anime en
CDMX, Caballeros del Zodiaco en México, Dr. STONE (aldea Ishigami), Haikyuu!! (Karasuno vs Shiratorizawa, colecta),
My Hero Academia (Dones y licencias), Komi-san, Kimi ni Todoke, tomos de One Piece en el club, club de anime de la
prepa, Mob y su club, investigación del club sobre por qué ven anime. Fútbol: festejo en el Ángel (México 1-0
Alemania 2018), partido en la tiendita, tiro libre y fisiología, liga juvenil al mediodía, inauguración del Mundial
2026, Liga MX Femenil, Manchester y Newton Heath, equipo que no gana en casa, carne asada tras el título, abono caro,
Clásico Nacional, roja y Comisión Disciplinaria, cascarita que se vuelve institución, Selección en Estados Unidos y
remesas, fuerzas básicas, cancha recuperada, equipo femenil de la prepa, entrevistas en la fila de Pumas, porra.
K-pop: cumpleaños de Stray Kids con STAY, fans de ENHYPEN, concierto y sonido de Stray Kids, CARAT y versiones de
álbum, Hallyu en casa, Extraordinary Attorney Woo, trainee de Busan, K-drama de fábrica en los setenta, debut de un
grupo nuevo, contrato de siete años, servicio militar de BTS, península de Corea, comeback de aespa, HYBE/Weverse,
live de BTS y brecha digital, fanbase de TXT, ATINY que dona, admin de fanbase, dance cover de ITZY, ONCE en el cine.
Videojuegos: Brookhaven con los primos, escuadras de Fortnite, Pokémon GO (huevo de 10 km, Día de la Comunidad),
Free Fire en el recreo, Among Us 2020, Stardew Valley y JojaMart, mascotas de Roblox, Animal Crossing (Nook Inc.),
Liga Pokémon de Kanto y Alola, Fortnite y ciberacoso, Discord de Roblox, club de Brawl Stars, encuesta de juego y sueño.

## Escenarios ya usados en Ciencias de la Salud I (no repetir)
Anime: Chigiri y su rodilla (Blue Lock), Centro Pokémon y Enfermera Joy, brote en el festival de Kaguya-sama,
Senshi y el estofado (Delicious in Dungeon), Maomao y el pozo (The Apothecary Diaries), Kafka y la memoria de kaiju
(Kaiju No. 8), Luffy contra Enel (One Piece), Shoko Ieiri y el tabaco (Jujutsu Kaisen), Bocchi en la caja de mangos,
campamento de vóley con desmayo. Fútbol: rodilla y calentamiento FIFA 11+, lateral lesionado en liga amateur e IMSS,
lesiones por temporada, desayuno en la visoria, pie de atleta, sarampión antes del torneo, barrera del tiro libre,
cerveza en Qatar 2022, nervios antes de la final sub-18, Eriksen y la RCP. K-pop: idol que pausa, fan enferma en CDMX
y Hospital Playlist, gripe tras fan meeting, «dieta de idol», Candybong de TWICE, fanchant de BABYMONSTER y cartilla
para Corea, plan de comeback y filtración, pijamada con vapeador, trainee Ha-eun, desmayo en la fila y tteokbokki.
Videojuegos: Silksong y la postura, curación en Zelda TotK, Corrupted Blood, hambre de Minecraft, Plague Inc.,
infectados en Roblox y Smash (entrenamiento), proteger tu cuenta, deseos de Genshin, Celeste, quemadura en Mario Party.

Ideas frescas que casi no se han usado: Jujutsu Kaisen (sin escenas gráficas), Kaiju No. 8, Oshi no Ko
(sin el crimen), Pokémon anime, Mob Psycho 100, Sakamoto Days, Bleach, Dragon Ball Daima, Attack on Titan
(sin violencia); Pumas, Cruz Azul, Tigres, Rayados, Santiago Giménez, Messi en el Inter Miami, Real Madrid,
Mundial femenil / Liga MX Femenil, Club América femenil, apps de resultados; Stray Kids (fuera de fan account),
TWICE (fuera de backstage), BTS en solitario, ENHYPEN, TXT, ITZY, BABYMONSTER, Crash Landing on You,
Extraordinary Attorney Woo, Weverse/Bubble; Zelda: Tears of the Kingdom, Mario Kart World, Nintendo Switch 2,
Splatoon, Rocket League, Geometry Dash, Hollow Knight: Silksong, Valorant (sin violencia), Pokémon GO,
Minecraft redstone, Roblox Studio.

## Proceso
1. Escribe el JSON en `scripts/contenido-materias/<materia>/<NN>-<slug>.json` (subject y topic = los slugs exactos).
2. Valida: `npx tsx scripts/contenido-materias/cargar.ts <archivo>` y corrige hasta **0 errores**
   (los avisos de "carta de más de 4 palabras" se toleran).
3. No cargues nada a la base, no toques otros archivos.

## Código y etiquetas (Tecnología 3°: HTML, Python, bases de datos)
- Desde el 15 oct 2026 la app **sí respeta los saltos de línea** (`\n`) en las secciones, pero **no las sangrías**
  y solo interpreta `**negritas**`; las comillas invertidas salen tal cual, así que **no uses backticks**.
  El código va en texto normal o en negritas, en línea y corto: `if vidas > 0: print("Sigue")`, `<h1>Mi página</h1>`.
  Un bloque de varias líneas se explica por pasos («Paso 3: dentro del if, con sangría de 4 espacios, va print("Ganaste")»).
- 🔴 **Nunca uses `**` para potencias de Python** (choca con las negritas). Usa `pow(2, 3)` o multiplica.
- En horda y diagnóstico **no hay Markdown**: nada de backticks ni `**`. El código va tal cual en el texto
  (`print(3 + 4)` sin comillas invertidas). Evita guiones bajos dobles (`__`).
- Python 3 real y exacto: `print()`, `input()` devuelve texto, `int()`, `if / elif / else` con dos puntos,
  sangría de 4 espacios, `range(1, 5)` da 1-4, listas empiezan en índice 0, `len()`, `def`, `return`,
  `=` asigna y `==` compara. Cada salida que pongas debe ser la que de verdad imprime Python.
- HTML real: `<!DOCTYPE html>`, `<html>`, `<head>`, `<title>`, `<body>`, `<h1>`-`<h6>`, `<p>`, `<a href="">`,
  `<img src="" alt="">` (sin cierre), `<ul>/<ol>/<li>`. No inventes etiquetas.
- Bases de datos: tabla, campo (columna), registro (fila), clave primaria, tipos de dato, filtro/consulta.
  Si usas SQL, solo `SELECT … FROM … WHERE …` sencillo y correcto.

## Bachillerato y ciencias sociales (ICS y siguientes de prepa)
- Alumnos de 15-17 años: vocabulario de prepa, conceptos con nombre técnico, autores y fechas cuando el temario los pide.
- 🔴 **Equilibrio político**: presenta teorías (positivismo, marxismo, funcionalismo, Weber) y problemas sociales con
  precisión y sin tomar partido. Nada de opiniones sobre partidos, gobiernos o políticos actuales. Si hay debate,
  muestra las posturas. Nunca atribuyas frases inventadas a personas reales.
- **Cifras oficiales** (INEGI, CONEVAL, CONAPO, Banco Mundial): úsalas solo si estás seguro del dato y del año, y di el
  año y la fuente («según CONEVAL, en 2022…»). Si dudas, describe la tendencia sin número o usa un caso hipotético.
- **Temas delicados** (violencia, migración, pobreza, discriminación): con respeto y sin morbo; nada de detalles
  gráficos ni de glorificar al crimen organizado o la narcocultura. Las personas afectadas no son el chiste ni el
  villano de la analogía.
- Los fandoms, los clubes, los equipos y las comunidades gamer son grupos sociales reales: úsalos como objeto de
  estudio (normas, roles, identidad, instituciones, poder) sin burlarte de ellos.

## Ciencias de la Salud (prepa 3°, 17-18 años)
- 🔴 **Exactitud médica y vigente**: usa definiciones y guías oficiales (OMS, Secretaría de Salud, NOM). Si un dato
  pudo cambiar (esquema de vacunación, instituciones, cifras), dilo de forma general o con su año y fuente.
  Instituciones: IMSS, ISSSTE, IMSS-Bienestar (atiende a quien no tiene seguridad social en los estados adheridos;
  el INSABI desapareció en 2023), Pemex, Sedena y Semar, Secretaría de Salud, servicios privados.
- 🔴 **Nada de dosis ni indicaciones de medicamentos o drogas**, nada de cómo conseguir o consumir sustancias, nada
  de métodos de autolesión. Teléfonos reales y seguros: **911** (emergencias) y **Línea de la Vida 800 911 2000**
  (adicciones y salud mental, gratis, 24 h).
- **Salud mental y trastornos alimentarios**: con empatía, sin estigma y sin cifras de peso, calorías o metas
  corporales; siempre con la salida de pedir ayuda a un adulto de confianza o a un profesional.
- **Salud sexual**: informativa, científica y respetuosa, sin escenas sexuales ni romantizar a idols o personajes
  reales. La temática entra con metáforas (planear, prevenir, contagio en un juego), no con relaciones de personajes.
- **Primeros auxilios**: protocolos actuales (seguridad de la escena, llamar al 911, RCP de alta calidad en adultos:
  100-120 compresiones por minuto, 5-6 cm de profundidad). Nunca sustituye un curso; dilo.
- La temática no trivializa enfermedades ni sufrimiento: nadie se burla de un paciente.
