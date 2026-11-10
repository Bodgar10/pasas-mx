// Sube los archivos del correo a Google Drive y regresa sus enlaces, para que
// los correos lleguen ligeros (sin adjuntos) y no llenen el buzón.
//
// Usa la cuenta de Google de Bodgar con un token OAuth (permiso drive.file:
// solo ve y toca los archivos que crea este código). Variables:
//   GDRIVE_CLIENT_ID, GDRIVE_CLIENT_SECRET, GDRIVE_REFRESH_TOKEN  (obligatorias)
// Todo se guarda en la carpeta "Videos PASAS y bodgar.dev" de su Drive, una subcarpeta por correo.
//   GDRIVE_DIAS       días que se guarda cada entrega antes de ir a la papelera (default 30; 0 = nunca)
// Cómo sacarlas: video/DRIVE.md.
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';
const RAIZ = 'Videos PASAS y bodgar.dev';

const TIPOS = {
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.json': 'application/json', '.txt': 'text/plain', '.pdf': 'application/pdf',
};

export function driveConfigurado(env = process.env) {
  return Boolean(env.GDRIVE_CLIENT_ID && env.GDRIVE_CLIENT_SECRET && env.GDRIVE_REFRESH_TOKEN);
}

async function token(env) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GDRIVE_CLIENT_ID, client_secret: env.GDRIVE_CLIENT_SECRET,
      refresh_token: env.GDRIVE_REFRESH_TOKEN, grant_type: 'refresh_token',
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    const pista = body.error === 'invalid_grant'
      ? ' (el token caducó o se revocó: vuelve a correr tools/drive-token.mjs; ver DRIVE.md)' : '';
    throw new Error(`Google no dio acceso (${res.status} ${body.error || ''})${pista}`);
  }
  return body.access_token;
}

async function api(tk, url, init = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${tk}`, ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`Drive respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 ? {} : res.json();
}

const q = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function carpeta(tk, nombre, padre) {
  const filtro = `name = '${q(nombre)}' and mimeType = '${FOLDER}' and trashed = false` + (padre ? ` and '${q(padre)}' in parents` : '');
  const { files = [] } = await api(tk, `${API}/files?${new URLSearchParams({ q: filtro, fields: 'files(id)', pageSize: '1' })}`);
  if (files[0]) return files[0].id;
  return crearCarpeta(tk, nombre, padre);
}

async function crearCarpeta(tk, nombre, padre) {
  const { id } = await api(tk, `${API}/files?fields=id`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nombre, mimeType: FOLDER, ...(padre ? { parents: [padre] } : {}) }),
  });
  return id;
}

// Subida "resumable": sirve igual para un PNG que para un MP4 grande.
async function subir(tk, archivo, padre) {
  const nombre = path.basename(archivo);
  const tipo = TIPOS[path.extname(nombre).toLowerCase()] || 'application/octet-stream';
  const { size } = await stat(archivo);
  const ini = await fetch(`${UPLOAD}/files?uploadType=resumable&fields=id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': tipo, 'X-Upload-Content-Length': String(size),
    },
    body: JSON.stringify({ name: nombre, parents: [padre] }),
  });
  const destino = ini.headers.get('location');
  if (!ini.ok || !destino) throw new Error(`Drive no aceptó ${nombre} (${ini.status}): ${(await ini.text()).slice(0, 200)}`);
  const res = await fetch(destino, { method: 'PUT', headers: { 'Content-Type': tipo }, body: await readFile(archivo) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.id) throw new Error(`No se subió ${nombre} (${res.status})`);
  return { nombre, id: body.id };
}

// Manda a la papelera de Drive las entregas con más de `dias` días (se pueden recuperar 30 días más).
async function limpiar(tk, raiz, dias) {
  if (!(dias > 0)) return 0;
  const corte = new Date(Date.now() - dias * 864e5).toISOString();
  const filtro = `'${q(raiz)}' in parents and mimeType = '${FOLDER}' and trashed = false and createdTime < '${corte}'`;
  const { files = [] } = await api(tk, `${API}/files?${new URLSearchParams({ q: filtro, fields: 'files(id)', pageSize: '100' })}`);
  for (const f of files) {
    await api(tk, `${API}/files/${f.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
  }
  return files.length;
}

function hoyMx() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date());
}

// Sube `files` a una carpeta nueva "AAAA-MM-DD · <titulo>" y la deja visible con el enlace.
// Regresa { carpeta, archivos: [{ nombre, ver, descargar }] }.
export async function subirADrive(files, titulo, env = process.env) {
  const tk = await token(env);
  const raiz = await carpeta(tk, RAIZ);
  const nombre = `${hoyMx()} · ${String(titulo).replace(/\s+/g, ' ').trim()}`.slice(0, 120);
  const dir = await crearCarpeta(tk, nombre, raiz);
  // Cualquiera con el enlace puede verla (así también le llega al equipo); los archivos lo heredan.
  await api(tk, `${API}/files/${dir}/permissions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });
  const archivos = [];
  for (const f of files) {
    const { nombre: n, id } = await subir(tk, f, dir);
    archivos.push({
      nombre: n,
      ver: `https://drive.google.com/file/d/${id}/view`,
      descargar: `https://drive.google.com/uc?export=download&id=${id}`,
    });
  }
  try {
    const dias = env.GDRIVE_DIAS == null || env.GDRIVE_DIAS === '' ? 30 : Number(env.GDRIVE_DIAS);
    const n = await limpiar(tk, raiz, dias);
    if (n) console.log(`  Drive: ${n} entrega(s) viejas a la papelera`);
  } catch (e) { console.warn(`  aviso: no se limpiaron entregas viejas de Drive (${e.message})`); }
  return { carpeta: `https://drive.google.com/drive/folders/${dir}`, archivos };
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Pone los enlaces arriba del correo y cambia "archivos adjuntos" por "archivos en Google Drive".
export function conEnlaces(html, { carpeta: url, archivos }) {
  const bloque = `<div style="background:#eef6ff;border:1px solid #cfe3fb;border-radius:10px;padding:12px 14px;margin:0 0 16px;font-family:system-ui,sans-serif;line-height:1.5">
<p style="margin:0 0 6px"><b>📁 Archivos en Google Drive</b> · <a href="${esc(url)}">abrir la carpeta</a></p>
<ul style="padding-left:20px;margin:0">
${archivos.map(a => `<li><b>${esc(a.nombre)}</b> · <a href="${esc(a.ver)}">ver</a> · <a href="${esc(a.descargar)}">descargar</a></li>`).join('\n')}
</ul>
</div>`;
  const cuerpo = html.replace(/archivos adjuntos/g, 'archivos en Google Drive').replace(/archivo adjunto/g, 'archivo en Google Drive');
  const m = cuerpo.match(/^\s*<div[^>]*>/);
  return m ? m[0] + '\n' + bloque + cuerpo.slice(m[0].length) : bloque + cuerpo;
}
