# Videos por Google Drive (en lugar de adjuntos)

Los correos de **PASAS Arcade**, **Videos bodgar.dev**, **Carruseles** e **Historias** ya no
traen los archivos adjuntos: GitHub Actions los sube a Google Drive y el correo llega con
un recuadro arriba con los enlaces (ver / descargar / abrir la carpeta). Así el buzón de
Outlook no se llena.

- Todo queda en la carpeta **"Videos PASAS y bodgar.dev"** de tu Drive, una subcarpeta por
  correo (`2026-10-29 · Video de hoy · …`).
- Las carpetas son visibles para **cualquiera con el enlace** (así también le llega al equipo).
  Nadie las encuentra si no tiene el enlace.
- Cada entrega se manda sola a la **papelera de Drive a los 30 días** para no llenar los 15 GB
  gratis de Google (se puede recuperar 30 días más). Para cambiarlo, agrega en GitHub la
  variable `GDRIVE_DIAS` (Settings → Secrets and variables → Actions → Variables) (por ejemplo `60`, o `0` para no borrar nunca).
- **Si Drive falla** (token vencido, Google caído), el correo llega igual con los archivos
  **adjuntos** y una nota naranja al final que dice por qué.
- El permiso que se pide es `drive.file`: el código solo ve los archivos que él mismo crea,
  nada más de tu Drive.

Código: `src/drive.mjs` (subida) y `sendEmail` en `src/email.mjs` (lo usan todos los scripts).

## Configuración (una sola vez, ~10 minutos)

Mientras no estén los tres secretos `GDRIVE_*` en GitHub, todo sigue llegando con adjuntos
como antes.

### 1. Crear el acceso en Google Cloud

Con la cuenta de Google donde quieres guardar los videos:

1. Entra a <https://console.cloud.google.com> y crea un proyecto nuevo (por ejemplo
   "PASAS videos").
2. **APIs y servicios → Biblioteca**: busca **Google Drive API** y dale **Habilitar**.
3. **Google Auth Platform** (o "Pantalla de consentimiento de OAuth"): tipo **Externo**,
   nombre de la app "PASAS videos", tu correo como soporte y contacto. No hace falta agregar
   permisos ni usuarios.
4. En **Público** (Audience), dale **Publicar app** para que quede "En producción".
   **Importante:** si se queda en "Prueba", el token deja de servir a los 7 días.
5. **Clientes → Crear cliente** (o "Credenciales → Crear credenciales → ID de cliente de
   OAuth"): tipo **App de escritorio**, nombre "GitHub Actions". Copia el **ID de cliente**
   y el **Secreto del cliente**.

### 2. Sacar el token y guardarlo en GitHub (en tu Mac)

En la Terminal:

```bash
cd ~/Downloads
gh api repos/Bodgar10/pasas-mx/contents/video/tools/drive-token.mjs -H "Accept: application/vnd.github.raw" > drive-token.mjs
node drive-token.mjs "ID_DE_CLIENTE" "SECRETO_DEL_CLIENTE"
```

Se abre Google: elige tu cuenta y da permiso. Como la app no está verificada, Google avisa
"Google no verificó esta app": dale **Configuración avanzada → Ir a PASAS videos**
(es tu propia app). Al final la Terminal pregunta si guarda los tres secretos en GitHub;
contesta `s`. Si no tienes `gh`, te muestra los tres valores para pegarlos en
GitHub → pasas-mx → Settings → Secrets and variables → Actions:

- `GDRIVE_CLIENT_ID`
- `GDRIVE_CLIENT_SECRET`
- `GDRIVE_REFRESH_TOKEN`

### 3. Probar

Reenvía un día sin esperar la hora, por ejemplo:

```bash
gh api -X POST repos/Bodgar10/pasas-mx/actions/workflows/bodgar-videos.yml/dispatches -f ref=main -f "inputs[fecha]=AAAA-MM-DD"
```

El correo debe llegar sin adjuntos y con el recuadro azul de Google Drive arriba. En la
corrida de Actions, el paso "Generar y enviar" dice `N archivo(s) en Google Drive: <enlace>`.

## Si deja de funcionar

El correo llega con adjuntos y la nota naranja dice el motivo. Si dice `invalid_grant`, el
token se venció o se revocó (por ejemplo, la app quedó en "Prueba" o cambiaste la contraseña
de Google): repite el paso 2.
