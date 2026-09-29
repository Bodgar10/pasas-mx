# Datos que usan los videos de PASAS Arcade

El generador (`video/`) lee las tablas de la migración `051_arcade.sql` con la
llave de service role. **No escribe nada**, con una excepción: si a las 00:10
el día todavía no tiene reto, llama a `arcade_reto()`, que lo arma igual que
cuando alguien abre `/arcade`.

Todo esto vive en `src/data.mjs → loadFromSupabase()`.

## De dónde sale cada pieza

| Pieza | Fuente |
|---|---|
| Número del reto | `arcade_challenges.number` |
| Ronda del reel | `round_ids[1]` del reto de hoy (la más fácil) |
| Respuesta de ayer | `round_ids[1]` del reto de ayer |
| Motivo de ayer | **última oración** de `arcade_rounds.explanation` |
| "Solo el X% le atinó" | `arcade_cifras(ayer).per_round[0]` |
| Ronda extra (sticker de quiz) | una ronda de un reto **ya pasado** (últimos 180 días) |
| Story de resultados | `arcade_cifras(hoy)`: la ronda con menor % de aciertos |

## Reglas que dependen de cómo se escriban las rondas

1. **La explicación debe terminar con la oración sobre la opción que sobra.**
   Ejemplo: *"…son logros de la Reforma liberal. La expropiación petrolera la
   hizo Cárdenas en 1938."* El reel muestra solo esa última oración. Las 38
   rondas de la tanda 01 ya cumplen. Si una tanda nueva no lo hace, el reel
   dirá algo sin sentido.
2. **Porcentajes solo desde 20 jugadores**, igual que la página
   (`MIN_JUGADORES_CIFRAS`). Con menos, el reel muestra el motivo sin cifra y
   esa noche no hay story de resultados (llega un correo avisándolo).
3. **La ronda extra nunca sale de un reto de hoy o futuro**, porque el sticker
   de quiz revela la respuesta. Solo en los primeros días, cuando aún no hay
   retos pasados, se toma del banco sin programar; eso deja un riesgo pequeño
   de que esa ronda salga después en un reto.

## Horarios (GitHub corre en UTC)

| Parte   | Hora México | Cron UTC      | Qué genera                          |
|---------|-------------|---------------|-------------------------------------|
| mañana  | 00:10       | `10 6 * * *`  | reel + story aviso + story extra    |
| noche   | 20:30       | `30 2 * * *`  | story de resultados                 |

La corrida de la noche cae a las 02:30 UTC **del día siguiente**. Por eso la
fecha se calcula con la zona `America/Mexico_City`, nunca con UTC.

## El objeto que arma

Los JSON de `data/ejemplo-*.json` muestran la forma completa. Se puede
generar a mano con `--data archivo.json` en lugar de leer la base.
