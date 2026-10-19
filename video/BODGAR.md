# Videos de bodgar.dev

Un video al día, de lunes a viernes, para las redes de bodgar.dev. Plataformas a la medida en español (clínicas de fisioterapia y bodegas) y, en su propia cuenta, mantenimiento de apps en inglés. Viven en este repo porque reutilizan la maquinaria de Pasas: Playwright, ffmpeg, Resend y GitHub Actions.

## Cómo llega cada mañana

1. El workflow **"Videos de bodgar.dev"** (`.github/workflows/bodgar-videos.yml`) corre de lunes a viernes a las ~06:47, hora de México.
2. Lee `data/bodgar/AAAA-MM-DD.json` (fecha de hoy) y su plantilla en `templates/bodgar/`.
3. Genera el reel **sin voz** (con pista de audio en silencio), su **portada** y la **story** del día, y los manda por correo a `BODGAR_EMAIL_TO` (si no existe, a `ARCADE_EMAIL_TO`). El correo trae la descripción para copiar, los comandos de la Terminal para la voz, la dirección del sticker de enlace de la story y el guion de voz.
4. Bodgar le pone la voz en su Mac con `tools/ponvoz.py` y publica a las **12:30 PM**.

Si no hay JSON para ese día, llega un correo corto avisando. Cada correo dice cuántos videos quedan programados; con 3 o menos, toca pedir el lote de la siguiente semana.

**Para rehacer o probar** sin esperar la hora: Actions → "Videos de bodgar.dev" → Run workflow (fecha opcional; `enviar` en falso para solo bajar los archivos de la corrida).

## Calendario

| Día | Publicación | Ejemplo de gancho |
|---|---|---|
| Lunes | Fisioterapia: pérdida de dinero | "Tu terapeuta está ahí, pero la camilla está vacía." |
| Martes | Bodegas: pérdida de dinero | "Hiciste el trabajo, pero nadie lo facturó." |
| Miércoles | Fisioterapia: crecimiento / ingreso | "Ya tienes pacientes. ¿Cómo haces que vuelvan cuando tiene sentido?" |
| Jueves | Bodegas: crecimiento / eficiencia | "Tus clientes podrían consultar su inventario sin escribirte por WhatsApp." |
| Viernes | Caso práctico: cálculo y "lo primero que construiría" | "8 cancelaciones × $700 = $5,600. Así intentaría recuperar parte." |

- Una sola hora para empezar: **12:30 PM**, 4 semanas, para comparar tema y gancho sin la variable de la hora. Después se prueba el ganador a las 7:00 PM.
- Mezcla aproximada: **70% "estás perdiendo dinero aquí", 30% "podrías ganar o crecer haciendo esto"**.
- El viernes es el más importante: números, flujo o "esto es lo primero que construiría". Es lo que hace pensar "quiero que este tipo revise mi negocio".
- Ninguna publicación repite el problema de las 3 anteriores del mismo sector.

## La fórmula de cada video

"Esto te pasa" → cuánto te puede costar → cómo lo resolvería → qué ganas → bodgar.dev

- **Un solo problema por video.** Nada de "5 funcionalidades de mi software".
- Contado como **historia**, con una persona o una situación concreta (Sofía, "son las 10:15").
- **Escenas recreadas e ilustradas**, como en Pasas: chat, agenda, factura, portal, notificación. Nunca capturas de la landing.
- **Una frase corta por escena** en pantalla (título de 2 a 6 palabras). Sin subtítulos largos.
- Cifras siempre **marcadas como ejemplo**, en el título o en la tarjeta. Al cierre: "Las cifras del video son un ejemplo, no un resultado."
- Sin testimonios, sin clientes inventados, sin logos ajenos. Nombres de personas y negocios genéricos (Sofía M., Moda Luna, Café Tierra).
- Nada que prometa resultados; en salud, la decisión clínica es del terapeuta ("tu equipo decide cuándo").
- Sin WhatsApp como canal automático del producto; se dice "mensaje" o "aviso".
- Cierre: la landing del sector (`bodgar.dev/plataformas/fisioterapia`, `bodgar.dev/plataformas/bodegas`; apps: `bodgar.dev`) y "Diagnóstico sin costo" o "Revisión sin costo".
- 8 a 10 escenas, 40 a 55 segundos.

## Hacer un video

### 1. El JSON (`data/bodgar/AAAA-MM-DD.json`)

```jsonc
{
  "fecha": "2026-10-20",
  "dia": "martes",
  "linea": "Bodegas · pérdida",               // aparece en el asunto del correo
  "plantilla": "bodegas-sin-facturar.html",   // en templates/bodgar/
  "nombre": "bodegas-sin-facturar",           // nombre del archivo
  "url": "bodgar.dev/plataformas/bodegas",
  "idioma": "es-MX",                          // apps: "en-US"
  "portada": {                                // portada del reel (templates/bodgar/portada.html)
    "etiqueta": "Bodegas y 3PL",
    "titulo": "Hiciste el trabajo. *Nadie lo facturó.*",   // *énfasis* en terracota
    "dato": { "num": "≈ $8,600", "texto": "al mes en servicios sin cobrar", "tipo": "perd" }   // "gana" en verde; opcional
  },
  "story": {                                  // story del día (templates/bodgar/story.html); sin dato, usa el de la portada
    "chip": "Nuevo reel",                     // opcional
    "titulo": "¿Cuánto trabajo *no cobraste* este mes?",
    "texto": "Una línea que invite a ver el reel."
  },
  "post": "Texto para publicar, con hashtags al final",
  "escenas": [
    { "id": "trabajo", "voz": "Lo que se dice en esta escena.", "titulo": "Tu equipo hizo el trabajo" }
  ]
}
```

Cada escena dura lo que tarda en decirse su `voz` (15.5 letras por segundo + medio segundo), mínimo 2.2 s; la última, 1.8 s más. El texto de voz y los tiempos van dentro del MP4 para la voz.

### 2. La plantilla (`templates/bodgar/<nombre>.html`)

Carga `base.css` y `base.js`. La base ya trae: lienzo 1080×1920, colores y letras de bodgar.dev, títulos por escena (`id="t-<id>"`, el texto en `<h1>` con la parte importante en `<em>`), tarjetas (`.card`, `.ccab`, `.fila`, `.total`), teléfono (`.phone`, `.scr`, `.pant`), el rayo del giro (`.giro`), el cierre (`#fin`, `#url`) y el dedo que toca (`#tap`, `#ripple`).

La plantilla define `window.escena(t)`: anima lo suyo con `S[id]`/`E[id]` (inicio y fin de cada escena, en segundos) y devuelve `true` mientras el dedo esté tocando. Ayudas: `bloque(el, desde, hasta, t)`, `aparece(id, t, segundo)`, `pop(el, t, segundo)`, `cuenta(t, inicio, dur, hasta)`, `pesos(n)`, `toque(t, segundo, el)`, `giro(el, t, id)`. Si necesita armar algo al inicio, `window.prepara()`.

Zona segura: nada importante debajo de y=1560 (botones de Reels y TikTok). La portada pone lo importante dentro del recorte 4:5 del perfil (y 285–1635); la story deja libre arriba de y=260 y abajo de y=1640, y trae un hueco punteado para el sticker de enlace. Ejemplos: `bodegas-sin-facturar.html`, `fisio-despues-alta.html`, `caso-aseguradoras.html`.

### 3. Revisar y generar

```bash
cd video
node src/bodgar.mjs --fecha 2026-10-20 --revisar   # un PNG por escena en salida/bodgar/
node src/bodgar.mjs --fecha 2026-10-20             # el MP4 sin voz (~2 min)
```

Revisa los PNG antes de dar por bueno un video: que nada se salga de la tarjeta, que los números cuadren entre escenas y que ninguna cifra quede sin "ejemplo".

### 4. Subir

Plantillas nuevas: rama y PR (como todo el código de `video/`). Los JSON de `data/bodgar/` pueden ir directo a `main`.

## La voz, en la Mac

`tools/ponvoz.py` lee del MP4 el texto y los tiempos de cada escena, genera la voz de cada una, la coloca al inicio de su escena (acelerándola hasta 1.3x si no cabe) y saca `<video>-voz.mp4` sin volver a codificar la imagen.

Una sola vez:

```bash
brew install ffmpeg
python3 -m pip install edge-tts
mkdir -p ~/Movies/bodgar-videos   # y copia ahí ponvoz.py
```

Cada mañana: guarda el MP4 del correo en `~/Movies/bodgar-videos` y corre

```bash
cd ~/Movies/bodgar-videos && python3 ponvoz.py
```

- Voz por omisión: **Jorge** (`es-MX-JorgeNeural`). Mujer: `--voz dalia`. Apps en inglés: `--voz en-US-GuyNeural` (o cualquier voz de `edge-tts --list-voices`).
- Sin internet: `--motor say` usa las voces de México de la Mac (Paulina o Juan; mejor la versión mejorada, que se baja en Configuración → Accesibilidad → Contenido leído → Voz del sistema → Administrar voces).
- edge-tts usa el servicio de lectura en voz alta de Microsoft Edge; no es un servicio oficial con contrato. Si algún día deja de funcionar, `--motor say` sigue funcionando, o se graba la voz con el guion que trae el correo.
