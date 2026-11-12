import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, ensureDir, health, portOccupied, saveJson, waitForHealth, usageFailure } from './lib.mjs';

function openBrowser() {
  if (process.argv.includes('--sin-navegador')) return;
  const url = 'http://127.0.0.1:4173/';
  const command =
    process.platform === 'win32' ? 'cmd.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
    child.on('error', () => {});
    child.unref();
  } catch {
    console.log('Abre la dirección manualmente:', url);
  }
}

async function main() {
  const port = 4173;
  const existing = await health(port);
  if (existing) {
    console.log('AulaRaíz ya está ejecutándose en http://127.0.0.1:4173/');
    openBrowser();
    return;
  }
  if (await portOccupied(port)) throw new Error('El puerto 4173 está ocupado por otra aplicación.');

  const logsDir = resolve(ROOT, 'logs');
  await ensureDir(logsDir);
  const output = createWriteStream(resolve(logsDir, 'servidor.log'), { flags: 'a' });
  const errors = createWriteStream(resolve(logsDir, 'errores.log'), { flags: 'a' });
  const child = spawn(process.execPath, [resolve(ROOT, 'server/index.mjs')], {
    cwd: ROOT,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', output, errors],
    env: { ...process.env, PORT: String(port), HTTPS_CERT: '', HTTPS_KEY: '' }
  });
  const spawnError = new Promise((resolve) => child.once('error', resolve));
  output.end();
  errors.end();

  const result = await Promise.race([
    waitForHealth(port),
    spawnError.then((error) => {
      throw error;
    })
  ]);
  if (!result) {
    try {
      child.kill();
    } catch {
      /* El servidor ya terminó. */
    }
    throw new Error('No se pudo iniciar AulaRaíz. Revisa logs/errores.log.');
  }
  await saveJson(resolve(logsDir, 'servidor.pid'), {
    pid: child.pid,
    serverId: result.serverId,
    port,
    startedAt: new Date().toISOString()
  });
  child.unref();
  console.log('AulaRaíz disponible: http://127.0.0.1:4173/');
  openBrowser();
  console.log('Se ejecuta en segundo plano. Para detenerlo: npm run detener');
}

main().catch((error) => usageFailure(error.message));
