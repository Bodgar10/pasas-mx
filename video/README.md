# Videos de PASAS Arcade

Genera cada día el reel y las tres stories del reto y los manda por correo,
listos para publicar.

```
templates/   reel.html y story.html (diseño; reciben los datos del reto)
fonts/       Nunito y Orbitron locales (no se descargan en cada corrida)
src/         run.mjs (entrada) · render.mjs (captura + ffmpeg) · data.mjs · email.mjs
data/        JSON de ejemplo
CONTRATO.md  de dónde sale cada dato y las reglas para escribir rondas
```

## Correrlo en tu computadora

Necesitas Node 20+ y `ffmpeg` (`brew install ffmpeg`).

```bash
cd video
npm install
npx playwright install chromium
npm run ejemplo                       # genera el reto #12 de ejemplo en salida/
```

Con tus propios datos:

```bash
node src/run.mjs --data data/mi-reto.json --parte manana
node src/run.mjs --data data/mi-reto.json --parte noche
```

Sin `--data`, lee el reto de Supabase (`--fecha AAAA-MM-DD`, o hoy en hora de México).

Variables:

- `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` — para leer de Supabase
- `RESEND_API_KEY` — para `--enviar`
- `ARCADE_EMAIL_TO` — a quién mandar el correo (varios separados por coma)
- `ARCADE_EMAIL_FROM` — opcional, por defecto `PASAS Arcade <hola@pasas.mx>`

En GitHub van como secrets del repo (Settings → Secrets and variables → Actions).

## Qué revisa antes de generar

- Que cada ronda tenga 4 opciones y una respuesta válida.
- Que la ronda extra de la story no sea la misma del reto.
- Que carguen las 6 tipografías. Si no, se detiene: nunca sale un video con
  letra de sistema.

Un reel tarda unos 2 minutos en generarse (480 cuadros a 1080×1920).
