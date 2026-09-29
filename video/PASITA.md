# Videos con la Pasita ("carrusel animado")

Convierte una lista de pantallas en un reel vertical (1080×1920, MP4) con la
Pasita animada y el estilo del grid de @pasas.mx: marco neón que cambia de
color, títulos en Nunito Black con contorno, texto en Nunito ExtraBold y la
Pasita cambiando de pose en cada pantalla. Cada video sale con su **portada**
lista (PNG 1080×1920).

```bash
cd video
node src/pasita.mjs --data mi-video.json --revisar   # un PNG por pantalla, para aprobar (segundos)
node src/pasita.mjs --data mi-video.json             # el video completo (~10 s de render por cada segundo de video)
```

Deja en `salida/pasita/` el `.mp4`, **dos portadas** (`-portada-a.png` y
`-portada-b.png`) y un `.txt` con el texto del post.

### Las dos portadas

Se arman solas con el gancho, la pantalla `grande` (si existe) y la Pasita:

- **A** (la preferida): título grande arriba, promesa como etiqueta rosa y la
  Pasita abajo con la pose del gancho. Marco del color del gancho.
- **B**: la Pasita grande arriba con otra pose (la de la promesa, o celebrando),
  la promesa como etiqueta amarilla y el título en un panel neón abajo. Marco
  del color contrario, para que sean dos opciones de verdad.

Las dos llevan un indicador discreto con el ícono de play y la **duración real**
del video ("▶ 30 segundos"). Es la única llamada a verlo: dice qué es y cuánto
tiempo toma. **Nada de clickbait**: la portada no promete nada que el video no
entregue ni crea intriga artificial ("espera al final", "el 3 te va a
sorprender").

Todo lo importante queda en el centro 3:4 (1080×1440), que es lo que muestra
el grid de Instagram. Se sube al publicar: **Editar portada → Agregar desde la
galería**. Poses opcionales: `portada_pose` (A) y `portada_pose_b` (B).

Los títulos se achican solos si no caben: Nunito Black es ancha.

## El archivo

```jsonc
{
  "nombre": "no es que seas lento",        // nombre del archivo
  "pantallas": [ … ],                       // de 3 a 10
  "post": "texto para la publicación",      // opcional
  "fondo": "salon",                         // cuarto (por defecto), salon, recamara, niveles, camion o "imagen:archivo.png"
  "portada_pose": "celebrando",             // opcional: otra pose para la portada A
  "portada_pose_b": "confiada",             // opcional: otra pose para la portada B
  "portada_prompt": "prompt para ChatGPT"   // opcional: si quieren una portada ilustrada
}
```

### Fondo

Cada video lleva una escena ilustrada que dice **dónde pasa** el tip. Todas
tienen movimiento sutil, la parte de arriba oscurecida para que se lea el texto
y un piso donde se para la Pasita.

| fondo | La escena | Úsalo para |
|---|---|---|
| `cuarto` (por defecto) | Cuarto de estudio de noche: librero, libros de MATE/HISTORIA/BIOLOGÍA/LITERATURA, lámpara de lava, laptop | Estudiar en casa, tareas, organizarse, concentración, técnicas de estudio |
| `salon` | Salón de clases: pizarrón, reloj, banderines, escritorio con manzana | Exposiciones, preguntar en clase, exámenes, maestros, participar |
| `recamara` | Recámara de noche: ventana con luna, cama, buró con despertador (2:47) y celular | Dormir, desvelos, celular antes de dormir, descanso, estrés de noche |
| `niveles` | Mundo de videojuego: plataformas NIVEL 1-2-3, trofeo, monedas, castillo | Metas, retos, avanzar poco a poco, rachas, motivación, "estudiar como juego" |
| `camion` | Dentro del camión: ventanas con la ciudad pasando, agarraderas, asientos | Estudiar en el trayecto, aprovechar tiempos muertos, repasar en el celular |

Si el tema no encaja claro en ninguna, usa `cuarto`.

Para un fondo propio (por ejemplo, de ChatGPT), guárdalo en `video/fondos/` y
usa `"fondo": "imagen:archivo.png"`. Ver `fondos/LEEME.md`.

### Tipos de pantalla

| tipo | Para qué | Campos | Límite |
|---|---|---|---|
| `gancho` | Primera pantalla. La pregunta o frase que detiene el scroll | `lineas` (1 a 4) | 18 caracteres por línea |
| `grande` | Una promesa corta a pantalla completa: "3 trucos" | `titulo`, `texto` opcional | título 14 |
| `numero` | Un paso o truco numerado (el número y los puntos salen solos) | `titulo`, `texto` | título 30, texto 170 |
| `texto` | Una idea sin número | `titulo`, `texto` | título 30, texto 170 |
| `cierre` | Última pantalla: la acción que queremos | `titulo`, `texto` opcional | título 14 |

Todas llevan `pose` y `color`. Opcional: `"temblar": true` (la Pasita tiembla; va bien con nervios o miedo).

### Poses

| pose | Cuándo |
|---|---|
| `pensativa` | Preguntas, dudas, el problema |
| `celebrando` | Promesas, buenas noticias, "¡sí se puede!" |
| `aprobando` | Consejos, pasos, "haz esto" (pulgar arriba) |
| `confiada` | Afirmaciones tranquilas, manos en la cintura |
| `lapiz` | Estudiar, escribir, dibujar, hacer tarea |
| `flexionando` | Cierre con energía (lleva el aura de fuego) |

### Colores del marco

`cian`, `rosa`, `amarillo` (reservado para el cierre) y `morado`.

La duración de cada pantalla sale sola según el largo del texto (de 3.5 a 6.5 s).

## Reglas de contenido

- **Sin clickbait**: el gancho plantea el tema real del video; la portada y el texto del post prometen solo lo que el video entrega.

- **Ortografía impecable**: "¿" de apertura, acentos, sin errores. Es una marca educativa.
- **Tuteo y frases cortas**, como en los carruseles. Sin emojis dentro del video (en el post sí).
- **Nunca prometer resultados**: nada de "vas a pasar", "sacarás 10" o "se te quitan los nervios". Es terreno de PROFECO.
- **Nada de salud mental como diagnóstico**: los tips son hábitos, no tratamiento.
- **Marcas y personajes ajenos**, si se mencionan, solo como texto. Nunca imágenes, logos ni música.
- Datos de alumnos, siempre agregados y nunca de alguien en particular.

Ejemplos completos: `data/ejemplo-pasita-*.json`.
