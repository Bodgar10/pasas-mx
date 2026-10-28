#!/usr/bin/env node
// Saca el "refresh token" de Google Drive para que GitHub Actions suba los videos a tu Drive.
// Se corre UNA vez, en tu Mac (pasos completos en video/DRIVE.md):
//
//   node tools/drive-token.mjs <CLIENT_ID> <CLIENT_SECRET>
//
// Abre Google en el navegador, eliges tu cuenta y das permiso. Al final te ofrece guardar
// los tres secretos en GitHub con `gh` (si lo tienes); si no, te dice cuáles pegar a mano.
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import readline from 'node:readline/promises';

const [clientId, clientSecret] = process.argv.slice(2);
const REPO = 'Bodgar10/pasas-mx';
if (!clientId || !clientSecret) {
  console.error('Uso: node tools/drive-token.mjs <CLIENT_ID> <CLIENT_SECRET>\n(los dos salen de Google Cloud; ver video/DRIVE.md)');
  process.exit(1);
}

const server = http.createServer();
await new Promise(r => server.listen(0, '127.0.0.1', r));
const redirect = `http://127.0.0.1:${server.address().port}`;
const auth = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: clientId, redirect_uri: redirect, response_type: 'code',
  scope: 'https://www.googleapis.com/auth/drive.file', access_type: 'offline', prompt: 'consent',
});

console.log('\nAbre esta dirección (si no se abrió sola), elige tu cuenta de Google y da permiso:\n\n' + auth + '\n');
spawnSync(process.platform === 'darwin' ? 'open' : 'xdg-open', [auth], { stdio: 'ignore' });

const code = await new Promise((resolve, reject) => {
  server.on('request', (req, res) => {
    const u = new URL(req.url, redirect);
    const c = u.searchParams.get('code'), err = u.searchParams.get('error');
    if (!c && !err) { res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(c ? '<h2>Listo ✓</h2><p>Ya puedes cerrar esta pestaña y volver a la Terminal.</p>' : `<h2>No se dio permiso (${err})</h2>`);
    server.close();
    c ? resolve(c) : reject(new Error(`Google respondió: ${err}`));
  });
});

const res = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: 'authorization_code' }),
});
const t = await res.json();
if (!t.refresh_token) { console.error('Google no regresó el token:', t.error_description || t.error || t); process.exit(1); }

const secretos = { GDRIVE_CLIENT_ID: clientId, GDRIVE_CLIENT_SECRET: clientSecret, GDRIVE_REFRESH_TOKEN: t.refresh_token };
const hayGh = spawnSync('gh', ['auth', 'status'], { stdio: 'ignore' }).status === 0;
if (hayGh) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const r = (await rl.question(`\n¿Guardo los 3 secretos en GitHub (${REPO})? [s/n] `)).trim().toLowerCase();
  rl.close();
  if (r.startsWith('s') || r.startsWith('y')) {
    for (const [k, v] of Object.entries(secretos)) {
      const p = spawnSync('gh', ['secret', 'set', k, '-R', REPO], { input: v, stdio: ['pipe', 'inherit', 'inherit'] });
      if (p.status !== 0) { console.error(`No se pudo guardar ${k}`); process.exit(1); }
    }
    console.log('\n✓ Listo. Desde el próximo correo, los videos llegan como enlaces de Google Drive.');
    process.exit(0);
  }
}
console.log('\nPega estos tres en GitHub → pasas-mx → Settings → Secrets and variables → Actions → New repository secret:\n');
for (const [k, v] of Object.entries(secretos)) console.log(`${k}\n${v}\n`);
