import { fileURLToPath } from 'node:url';
import { dirname, resolve, sep } from 'node:path';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import net from 'node:net';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DATA = resolve(process.env.AULARAIZ_DATA_DIR || resolve(ROOT, 'data'));

export function within(parent, target) {
  const a = resolve(parent);
  const b = resolve(target);
  return a === b || b.startsWith(a + sep);
}

export async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

export async function saveJson(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
}

export async function loadJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function portOccupied(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(1000, () => finish(false));
  });
}

export async function health(port = 4173) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(1500),
      cache: 'no-store'
    });
    const result = await response.json();
    return response.ok && result.ok === true && typeof result.serverId === 'string' ? result : null;
  } catch {
    return null;
  }
}

export async function waitForHealth(port, retries = 40) {
  for (let i = 0; i < retries; i++) {
    const result = await health(port);
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

export function usageFailure(message) {
  console.error('Error:', message);
  process.exitCode = 1;
}
