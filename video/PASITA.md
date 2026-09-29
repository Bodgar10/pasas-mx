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

Deja en `salida/pasita/` el `.mp4`, la portada `-portada.png` y un `.txt` con
el texto del post.

### La portada

Se arma sola con el gancho (título grande), la pantalla `grande` si existe
(etiqueta rosa) y la Pasita en la pose del gancho. Todo lo importante queda en
el centro 3:4 (1080×1440), que es lo que muestra el grid de Instagram. Se sube
al publicar: **Editar portada → Agregar desde la galería**.

Los títulos se achican solos si no caben: Nunito Black es ancha.

## El archivo

```jsonc
{
  "nombre": "no es que seas lento",        // nombre del archivo
  "pantallas": [ … ],                       // de 3 a 10
  "post": "texto para la publicación",      // opcional
  "portada_pose": "celebrando",             // opcional: otra pose para la portada
  "portada_prompt": "prompt para ChatGPT"   // opcional: si quieren una portada ilustrada
}
```

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

- **Ortografía impecable**: "¿" de apertura, acentos, sin errores. Es una marca educativa.
- **Tuteo y frases cortas**, como en los carruseles. Sin emojis dentro del video (en el post sí).
- **Nunca prometer resultados**: nada de "vas a pasar", "sacarás 10" o "se te quitan los nervios". Es terreno de PROFECO.
- **Nada de salud mental como diagnóstico**: los tips son hábitos, no tratamiento.
- **Marcas y personajes ajenos**, si se mencionan, solo como texto. Nunca imágenes, logos ni música.
- Datos de alumnos, siempre agregados y nunca de alguien en particular.

Ejemplos completos: `data/ejemplo-pasita-*.json`.
